#!/usr/bin/env node

import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HISTORY_VERSION,
  checkApplicationHistory,
} from "./check-application-history.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT_ROOT = "applications";
const WORKFLOW_VERSION = 2;
const JOB_ANALYSIS_TEMPLATE = path.join(ROOT, "templates/job-analysis-template.md");
const ARTIFACT_NAMES = ["job-posting.txt", "job-analysis.md", "workflow-state.json"];

main().catch((error) => {
  console.error(`Import failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.source) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const applicationDate = args.date || localDate();
  const fetched = await loadSource(args.source, args);
  const extracted = extractJobPosting(fetched.html, fetched.finalUrl, {
    companyOverride: args.company,
    roleOverride: args.role,
    visibleText: fetched.visibleText,
    fetchedVia: fetched.fetchedVia,
  });

  const companySlug = slugify(extracted.company || "unknown-company");
  const roleSlug = slugify(extracted.title || "unknown-role");
  const taskSlug = `${applicationDate}-${companySlug}-${roleSlug}`;
  const taskDir = path.resolve(ROOT, args.outRoot || DEFAULT_OUT_ROOT, taskSlug);
  const analysisPath = path.join(taskDir, "job-analysis.md");
  const sourcePath = path.join(taskDir, "job-posting.txt");
  const statePath = path.join(taskDir, "workflow-state.json");
  const historyCheck = await checkApplicationHistory({
    logPath: path.join(ROOT, "application-log.md"),
    company: extracted.company,
    role: extracted.title,
    currentSource: fetched.finalUrl || args.source,
    checkedAt: applicationDate,
  });

  const existingOutput = await firstExistingPath([analysisPath, sourcePath, statePath]);
  if (!args.force && existingOutput) {
    throw new Error(
      `${path.basename(existingOutput)} already exists at ${existingOutput}. Re-run with --force to replace this v2 import.`,
    );
  }

  // Complete every source/template read, render, and validation before touching
  // the destination folder. This keeps template failures side-effect free,
  // including when --force targets an existing application.
  const sourceText = `${extracted.sourceDescription || extracted.description || ""}`.trim();
  const sourceContent = sourceText ? `${sourceText}\n` : "";
  const sourceSha256 = sha256(sourceContent);
  const analysisTemplate = await readFile(JOB_ANALYSIS_TEMPLATE, "utf8");
  const taskRelativePath = path.relative(ROOT, taskDir);
  const analysisContent = renderJobAnalysis({
    template: analysisTemplate,
    applicationDate,
    taskDir: taskRelativePath,
    source: args.source,
    fetched,
    extracted,
    sourceSha256,
    historyCheck,
  });
  const stateContent = `${JSON.stringify(
    renderWorkflowState({
      applicationDate,
      taskDir: taskRelativePath,
      source: args.source,
      extracted,
      sourceSha256,
      historyCheck,
    }),
    null,
    2,
  )}\n`;

  validateArtifactSet({ sourceContent, analysisContent, stateContent, sourceSha256 });

  await replaceArtifactSet(taskDir, [
    { name: "job-posting.txt", content: sourceContent },
    { name: "job-analysis.md", content: analysisContent },
    // Publish state last so a failed process never advertises newer checks or
    // outputs before the human-readable source and analysis are in place.
    { name: "workflow-state.json", content: stateContent },
  ]);

  console.log(`Created ${path.relative(ROOT, analysisPath)}`);
  console.log(`Created ${path.relative(ROOT, sourcePath)}`);
  console.log(`Created ${path.relative(ROOT, statePath)}`);

  if (historyCheck.status !== "complete") {
    console.log(`Historical application check incomplete: ${historyCheck.error}`);
    console.log("Stop before analysis and resolve the history-check input.");
  } else if (historyCheck.matches.length > 0) {
    console.log(`Historical application match found: ${historyCheck.matches.length} prior record(s).`);
    console.log("Stop before analysis and ask the user whether to stop or continue.");
  }

  if (extracted.status !== "complete") {
    console.log(
      "Extraction is partial. Review job-analysis.md and paste missing JD details before resume analysis.",
    );
  }
}

function parseArgs(argv) {
  const args = {
    source: "",
    date: "",
    outRoot: DEFAULT_OUT_ROOT,
    company: "",
    role: "",
    browserText: "",
    force: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg.startsWith("--date=")) {
      args.date = arg.slice("--date=".length);
    } else if (arg === "--date") {
      args.date = argv[++index] || "";
    } else if (arg.startsWith("--out-root=")) {
      args.outRoot = arg.slice("--out-root=".length);
    } else if (arg === "--out-root") {
      args.outRoot = argv[++index] || "";
    } else if (arg.startsWith("--company=")) {
      args.company = arg.slice("--company=".length);
    } else if (arg === "--company") {
      args.company = argv[++index] || "";
    } else if (arg.startsWith("--role=")) {
      args.role = arg.slice("--role=".length);
    } else if (arg === "--role") {
      args.role = argv[++index] || "";
    } else if (arg.startsWith("--browser-text=")) {
      args.browserText = arg.slice("--browser-text=".length);
    } else if (arg === "--browser-text") {
      args.browserText = argv[++index] || "";
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.source) {
      args.source = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error("--date must use YYYY-MM-DD format.");
  }

  if (!args.outRoot) {
    throw new Error("--out-root cannot be empty.");
  }

  if (args.browserText && !/^https?:\/\//i.test(args.source)) {
    throw new Error("--browser-text requires the original job URL as the source argument.");
  }

  if (/^https?:\/\//i.test(args.source) && !args.browserText) {
    throw new Error(
      "Direct URL fetching is disabled for job imports. Open the job in the Codex in-app browser, save the visible job-detail text, then rerun with --browser-text FILE.",
    );
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/import-job.mjs <job-url> --browser-text <visible-job-text-file> [options]
  node scripts/import-job.mjs <local-visible-text-or-html-file> [options]

Options:
  --date YYYY-MM-DD       Application/import date. Defaults to today's local date.
  --company "Name"        Override extracted company name.
  --role "Title"          Override extracted job title.
  --browser-text FILE     Required for job URLs. Use visible job text copied from the Codex in-app browser.
  --out-root DIR          Output root. Defaults to applications.
  --force                 Replace all three v2 import artifacts in an existing folder.
  --help                  Show this help.

Examples:
  node scripts/import-job.mjs https://www.linkedin.com/jobs/view/123 --browser-text tmp/job-visible.txt
  node scripts/import-job.mjs ./tmp/job-visible.txt --company "Acme" --role "Product Designer"

For job URLs, direct fetching is disabled. Always open the posting in the Codex in-app browser,
copy/save the visible job-detail text, and import with the original URL plus --browser-text.
If the browser view is incomplete or unavailable, ask the user to paste the visible posting text.
`);
}

async function loadSource(source, args = {}) {
  if (args.browserText) {
    const filePath = args.browserText.startsWith("file://")
      ? fileURLToPath(args.browserText)
      : path.resolve(ROOT, args.browserText);
    const visibleText = normalizeBrowserText(await readFile(filePath, "utf8"));

    return {
      html: textToHtml(visibleText),
      visibleText,
      finalUrl: source,
      sourceType: classifySource(source),
      fetchedVia: "in-app-browser",
    };
  }

  if (/^https?:\/\//i.test(source)) {
    throw new Error(
      "Direct URL fetching is disabled for job imports. Use --browser-text with visible text captured from the Codex in-app browser.",
    );
  }

  const filePath = source.startsWith("file://")
    ? fileURLToPath(source)
    : path.resolve(ROOT, source);

  return {
    html: await readFile(filePath, "utf8"),
    finalUrl: source,
    sourceType: "local-file",
    fetchedVia: "file",
  };
}

function extractJobPosting(html, finalUrl, overrides = {}) {
  const cleanedHtml = stripDangerousBlocks(html);
  const structuredJobs = extractStructuredJobs(cleanedHtml);
  const structured = structuredJobs[0];
  const visibleHtml = cleanedHtml.replace(/<script\b[\s\S]*?<\/script>/gi, " ");
  const rawText = overrides.visibleText
    ? normalizeBrowserText(overrides.visibleText)
    : htmlToText(visibleHtml);
  const meta = extractMeta(cleanedHtml);
  const sourceType = classifySource(finalUrl);
  const text = cleanJobTextForSource(rawText, sourceType);
  const linkedInTitle = sourceType === "linkedin"
    ? parseLinkedInTitle(meta["og:title"] || firstLine(rawText) || firstLine(text))
    : null;

  const title =
    normalizeText(overrides.role || overrides.roleOverride) ||
    normalizeText(structured?.title) ||
    normalizeText(linkedInTitle?.title) ||
    normalizeText(meta["og:title"]) ||
    normalizeText(firstLine(rawText)) ||
    normalizeText(firstLine(text));

  const company =
    normalizeText(overrides.company || overrides.companyOverride) ||
    normalizeText(structured?.hiringOrganization?.name) ||
    normalizeText(linkedInTitle?.company) ||
    inferCompanyFromText(rawText) ||
    inferCompanyFromText(text) ||
    normalizeText(meta["og:site_name"]);

  const location =
    formatLocation(structured?.jobLocation) ||
    valueAfterLabel(rawText, ["Location", "Job location", "Work location"]) ||
    valueAfterLabel(text, ["Location", "Job location", "Work location"]) ||
    "";

  const employmentType =
    formatEmploymentType(structured?.employmentType) ||
    valueAfterLabel(rawText, ["Employment type", "Job type", "Type"]) ||
    valueAfterLabel(text, ["Employment type", "Job type", "Type"]) ||
    "";

  const salary =
    formatSalary(structured?.baseSalary) ||
    valueAfterLabel(rawText, ["Salary", "Pay range", "Compensation", "Base pay range"]) ||
    valueAfterLabel(text, ["Salary", "Pay range", "Compensation", "Base pay range"]) ||
    "";

  const datePosted =
    normalizeText(structured?.datePosted) ||
    valueAfterLabel(rawText, ["Date posted", "Posted"]) ||
    valueAfterLabel(text, ["Date posted", "Posted"]) ||
    "";

  const validThrough =
    normalizeText(structured?.validThrough) ||
    valueAfterLabel(rawText, ["Valid through", "Closing date", "Application deadline"]) ||
    valueAfterLabel(text, ["Valid through", "Closing date", "Application deadline"]) ||
    "";

  const descriptionFromStructured = structured?.description
    ? htmlToText(String(structured.description))
    : "";
  const descriptionResult = chooseDescription(descriptionFromStructured, text, sourceType);
  const description = descriptionResult.text;
  const sections = extractSections(description || text);
  const keywords = inferKeywords(`${title}\n${description}`);
  const status = computeStatus({
    title,
    company,
    description,
    truncated: descriptionResult.truncated,
  });

  return {
    status,
    sourceType,
    title,
    company,
    location,
    employmentType,
    salary,
    datePosted,
    validThrough,
    seniority:
      valueAfterLabel(rawText, ["Seniority level", "Seniority"]) ||
      valueAfterLabel(text, ["Seniority level", "Seniority"]) ||
      "",
    jobFunction:
      valueAfterLabel(rawText, ["Job function", "Function"]) ||
      valueAfterLabel(text, ["Job function", "Function"]) ||
      "",
    industry:
      valueAfterLabel(rawText, ["Industry", "Industries"]) ||
      valueAfterLabel(text, ["Industry", "Industries"]) ||
      "",
    workplaceType:
      valueAfterLabel(rawText, ["Workplace type", "Work model", "Remote"]) ||
      valueAfterLabel(text, ["Workplace type", "Work model", "Remote"]) ||
      "",
    sections,
    description,
    sourceDescription: descriptionResult.fullText,
    descriptionTruncated: descriptionResult.truncated,
    keywords,
    extractionNotes: buildExtractionNotes({
      structuredJobs,
      status,
      truncated: descriptionResult.truncated,
      sourceType,
      fetchedVia: overrides.fetchedVia,
    }),
  };
}

function parseLinkedInTitle(value) {
  const title = normalizeText(value).replace(/\s+\|\s+LinkedIn$/i, "");
  const match = title.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+.+$/i);

  if (!match) {
    return null;
  }

  return {
    company: match[1],
    title: match[2],
  };
}

function stripDangerousBlocks(html) {
  return html
    .replace(/<script\b(?![^>]*type=["']application\/ld\+json["'])[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
}

function extractStructuredJobs(html) {
  const blocks = [];
  const regex =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html))) {
    const rawJson = decodeEntities(match[1].trim());
    const parsed = parseJsonLd(rawJson);
    if (parsed) {
      blocks.push(...findJobPostingNodes(parsed));
    }
  }

  return blocks;
}

function parseJsonLd(rawJson) {
  const candidates = [
    rawJson,
    rawJson.replace(/^\s*<!--/, "").replace(/-->\s*$/, ""),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function findJobPostingNodes(value) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const type = node["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((item) => String(item).toLowerCase() === "jobposting")) {
      found.push(node);
    }

    if (node["@graph"]) {
      visit(node["@graph"]);
    }
  };

  visit(value);
  return found;
}

function extractMeta(html) {
  const meta = {};
  const regex = /<meta\b([^>]*)>/gi;
  let match;

  while ((match = regex.exec(html))) {
    const attrs = parseAttrs(match[1]);
    const key = attrs.property || attrs.name;
    if (key && attrs.content) {
      meta[key.toLowerCase()] = decodeEntities(attrs.content);
    }
  }

  return meta;
}

function parseAttrs(source) {
  const attrs = {};
  const regex = /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match;

  while ((match = regex.exec(source))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attrs;
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|section|article|tr|ul|ol)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textToHtml(text) {
  return normalizeBrowserText(text)
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
}

function normalizeBrowserText(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanJobTextForSource(text, sourceType) {
  if (sourceType === "linkedin") {
    return cleanLinkedInText(text);
  }

  return normalizeBrowserText(text);
}

function cleanLinkedInText(text) {
  const lines = normalizeBrowserText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const aboutIndex = lines.findIndex((line) => /^about the job$/i.test(line));
  if (aboutIndex >= 0) {
    const body = [];

    for (const line of lines.slice(aboutIndex + 1)) {
      if (isLinkedInDescriptionTerminator(line)) {
        break;
      }

      if (!isLinkedInNoise(line)) {
        body.push(line);
      }
    }

    const bodyText = dedupeConsecutiveLines(body).join("\n").trim();
    if (bodyText.length > 50) {
      return bodyText;
    }
  }

  return dedupeConsecutiveLines(lines.filter((line) => !isLinkedInNoise(line)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLinkedInDescriptionTerminator(line) {
  return [
    /^seniority level$/i,
    /^employment type$/i,
    /^job function$/i,
    /^industr(y|ies)$/i,
    /^referrals increase your chances/i,
    /^see who you know/i,
    /^get notified about new/i,
    /^similar jobs/i,
    /^people also viewed/i,
    /^looking for a job/i,
    /^sign in to create job alert/i,
    /^you(?:'|’)ve viewed all jobs/i,
  ].some((pattern) => pattern.test(line.trim()));
}

function isLinkedInNoise(line) {
  return [
    /^linkedin$/i,
    /^linkedin logo$/i,
    /^join now$/i,
    /^sign in$/i,
    /^welcome back$/i,
    /^save$/i,
    /^apply$/i,
    /^easy apply$/i,
    /^show more$/i,
    /^show less$/i,
    /^home$/i,
    /^my network$/i,
    /^jobs$/i,
    /^messaging$/i,
    /^notifications$/i,
    /^learning$/i,
    /^new to linkedin/i,
    /^by clicking continue/i,
    /^agree\s*&\s*join linkedin/i,
    /^continue to join or sign in/i,
    /^forgot password/i,
    /^or$/i,
    /^user agreement$/i,
    /^privacy policy$/i,
    /^cookie policy$/i,
    /^copyright policy$/i,
    /^brand policy$/i,
    /^guest controls$/i,
    /^community guidelines$/i,
    /^manage preferences$/i,
    /^linkedin corporation/i,
    /^©\s*\d{4}/i,
  ].some((pattern) => pattern.test(line.trim()));
}

function dedupeConsecutiveLines(lines) {
  const result = [];

  for (const line of lines) {
    if (result[result.length - 1] !== line) {
      result.push(line);
    }
  }

  return result;
}

function extractSections(text) {
  const headings = [
    ["responsibilities", /^(responsibilities|what you'?ll do|the role|role overview)$/i],
    ["requirements", /^(requirements|qualifications|minimum qualifications|what you bring)$/i],
    ["preferred", /^(preferred qualifications|nice to have|bonus points|preferred)$/i],
    ["benefits", /^(benefits|perks|compensation|salary|pay range)$/i],
  ];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const sections = {};
  let current = "";

  for (const line of lines) {
    const normalized = line.replace(/:$/, "");
    const heading = headings.find(([, pattern]) => pattern.test(normalized));

    if (heading) {
      current = heading[0];
      sections[current] ||= [];
      continue;
    }

    if (current) {
      sections[current].push(line);
    }
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, values]) => [key, values.slice(0, 40)]),
  );
}

function chooseDescription(structuredDescription, text, sourceType = "generic") {
  const description = sourceType === "linkedin"
    ? cleanLinkedInText(structuredDescription || text)
    : structuredDescription || text;

  const fullText = description
    .split("\n")
    .filter((line) => !isNavigationNoise(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    fullText,
    text: fullText.slice(0, 20000),
    truncated: fullText.length > 20000,
  };
}

function isNavigationNoise(line) {
  return [
    /^skip to/i,
    /^sign in$/i,
    /^join now$/i,
    /^save$/i,
    /^apply$/i,
    /^show more$/i,
    /^show less$/i,
    /^similar jobs$/i,
    /^people also viewed$/i,
    /^cookie/i,
  ].some((pattern) => pattern.test(line.trim()));
}

function classifySource(source) {
  let host = "";
  try {
    host = new URL(source).hostname.toLowerCase();
  } catch {
    return "local-file";
  }

  if (host.includes("greenhouse.io")) return "greenhouse";
  if (host.includes("lever.co")) return "lever";
  if (host.includes("ashbyhq.com")) return "ashby";
  if (host.includes("myworkdayjobs.com")) return "workday";
  if (host.includes("linkedin.com")) return "linkedin";
  if (host.includes("smartrecruiters.com")) return "smartrecruiters";
  if (host.includes("workable.com")) return "workable";
  return "generic";
}

function formatLocation(location) {
  if (!location) return "";

  const locations = Array.isArray(location) ? location : [location];
  return locations
    .map((item) => {
      const address = item?.address || item;
      if (typeof address === "string") return normalizeText(address);

      return [
        address?.addressLocality,
        address?.addressRegion,
        address?.addressCountry?.name || address?.addressCountry,
      ]
        .filter(Boolean)
        .join(", ");
    })
    .filter(Boolean)
    .join("; ");
}

function formatEmploymentType(type) {
  if (!type) return "";
  return Array.isArray(type) ? type.join(", ") : String(type);
}

function formatSalary(baseSalary) {
  if (!baseSalary) return "";

  const salaries = Array.isArray(baseSalary) ? baseSalary : [baseSalary];
  return salaries
    .map((salary) => {
      const currency = salary.currency || "";
      const value = salary.value || salary;

      if (typeof value === "number" || typeof value === "string") {
        return `${currency} ${value}`.trim();
      }

      const min = value.minValue ?? value.value;
      const max = value.maxValue;
      const unit = value.unitText ? `/${String(value.unitText).toLowerCase()}` : "";

      if (min && max) return `${currency} ${min}-${max}${unit}`.trim();
      if (min) return `${currency} ${min}${unit}`.trim();
      return "";
    })
    .filter(Boolean)
    .join("; ");
}

function inferCompanyFromText(text) {
  const lines = text.split("\n").map(normalizeText).filter(Boolean);
  const hiringLine = lines.find((line) => /\bhiring\b/i.test(line));

  if (hiringLine) {
    const beforeHiring = hiringLine.split(/\bhiring\b/i)[0]?.trim();
    if (beforeHiring && beforeHiring.length <= 80) return beforeHiring;
  }

  return "";
}

function valueAfterLabel(text, labels) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const labelPatterns = labels.map(
    (label) => new RegExp(`^${escapeRegExp(label)}\\s*:?\\s*(.*)$`, "i"),
  );

  for (let index = 0; index < lines.length; index += 1) {
    for (const pattern of labelPatterns) {
      const match = lines[index].match(pattern);
      if (!match) continue;

      const inlineValue = normalizeText(match[1]);
      if (inlineValue) return inlineValue;

      const nextLine = normalizeText(lines[index + 1] || "");
      if (nextLine && nextLine.length <= 160) return nextLine;
    }
  }

  return "";
}

function firstLine(text) {
  return text.split("\n").find((line) => normalizeText(line)) || "";
}

function normalizeText(value) {
  if (!value) return "";
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function inferKeywords(text) {
  const dictionary = [
    "UX design",
    "UI design",
    "product design",
    "visual design",
    "interaction design",
    "user research",
    "usability testing",
    "wireframing",
    "prototyping",
    "Figma",
    "design systems",
    "accessibility",
    "responsive design",
    "mobile design",
    "AI",
    "generative AI",
    "workflow",
    "stakeholder",
    "cross-functional",
    "HTML",
    "CSS",
    "JavaScript",
    "Adobe",
    "Photoshop",
    "Illustrator",
    "motion design",
    "typography",
    "visual hierarchy",
    "information architecture",
    "documentation",
  ];

  return dictionary.filter((keyword) => {
    const escaped = escapeRegExp(keyword).replace(/\\ /g, "\\s+");
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(text);
  });
}

function computeStatus({ title, company, description, truncated = false }) {
  if (truncated) return "partial";
  if (title && company && description.length > 300) return "complete";
  if (title || company || description.length > 200) return "partial";
  return "failed";
}

function buildExtractionNotes({ structuredJobs, status, truncated, sourceType, fetchedVia }) {
  const notes = [];

  if (fetchedVia === "in-app-browser") {
    notes.push("Used visible text captured from the Codex in-app browser DOM instead of direct fetch.");
  } else if (structuredJobs.length > 0) {
    notes.push(`Found ${structuredJobs.length} structured JobPosting block(s).`);
  } else {
    notes.push("No structured JobPosting JSON-LD block found; used generic HTML extraction.");
  }

  notes.push(`Detected source type: ${sourceType}.`);

  if (status !== "complete") {
    notes.push("Extraction may be incomplete. Ask the user to paste the full job description before resume tailoring.");
  }

  if (sourceType === "linkedin") {
    notes.push("LinkedIn pages may be partial, login-gated, or rate-limited. Do not use this script for bulk scraping.");
  }

  if (truncated) {
    notes.push(
      "The analysis excerpt was truncated at 20,000 characters. The complete cleaned source remains in job-posting.txt, and extraction status is partial until reviewed.",
    );
  }

  return notes;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderJobAnalysis({
  template,
  applicationDate,
  taskDir,
  source,
  fetched,
  extracted,
  sourceSha256,
  historyCheck,
}) {
  const values = {
    COMPANY: extracted.company || "Not extracted",
    ROLE: extracted.title || "Not extracted",
    SOURCE: source,
    FINAL_URL: fetched.finalUrl,
    SOURCE_TYPE: extracted.sourceType,
    FETCHED_VIA: fetched.fetchedVia,
    APPLICATION_DATE: applicationDate,
    TASK_DIR: taskDir,
    SOURCE_SHA256: sourceSha256,
    EXTRACTION_STATUS: extracted.status,
    LOCATION: extracted.location || "Not extracted",
    WORKPLACE_TYPE: extracted.workplaceType || "Not extracted",
    EMPLOYMENT_TYPE: extracted.employmentType || "Not extracted",
    SALARY: extracted.salary || "Not extracted",
    DATE_POSTED: extracted.datePosted || "Not extracted",
    VALID_THROUGH: extracted.validThrough || "Not extracted",
    SENIORITY: extracted.seniority || "Not extracted",
    JOB_FUNCTION: extracted.jobFunction || "Not extracted",
    INDUSTRY: extracted.industry || "Not extracted",
    EXTRACTION_NOTES: extracted.extractionNotes.map((note) => `- ${note}`).join("\n"),
    HISTORY_CHECK_JSON: JSON.stringify(historyCheck, null, 2),
    SUGGESTED_KEYWORDS: extracted.keywords.length > 0
      ? extracted.keywords.map((keyword) => `- ${keyword}`).join("\n")
      : "- TODO: Add supported secondary keywords after reviewing job-posting.txt.",
  };

  const rendered = Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
  const unresolved = rendered.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (unresolved) {
    throw new Error(
      `Unresolved job-analysis template fields: ${[...new Set(unresolved)].join(", ")}`,
    );
  }

  return rendered;
}

function renderWorkflowState({
  applicationDate,
  taskDir,
  source,
  extracted,
  sourceSha256,
  historyCheck,
}) {
  return {
    workflowVersion: WORKFLOW_VERSION,
    stage: "imported",
    updatedAt: new Date().toISOString(),
    applicationDate,
    applicationFolder: taskDir,
    job: {
      source,
      company: extracted.company || "",
      role: extracted.title || "",
      extractionStatus: extracted.status,
    },
    source: {
      path: "job-posting.txt",
      sha256: sourceSha256,
    },
    historyCheck,
    decisions: {
      analysisConfirmed: false,
      analysisConfirmation: "pending",
      separatePlanConfirmationRequested: false,
      compare: "ask",
      coverLetter: "ask",
      applicationLog: "ask",
    },
    template: {
      resumeMode: "default",
      resumePages: 1,
      coverLetterMode: "default",
      coverLetterPages: 1,
      allowedGaps: ["2px", "4px"],
    },
    checks: {
      ats: "pending",
      layout: "pending",
      pdf: "pending",
      pdfPages: null,
    },
    outputs: {
      jobPosting: "job-posting.txt",
      jobAnalysis: "job-analysis.md",
      workflowState: "workflow-state.json",
    },
  };
}

function validateArtifactSet({ sourceContent, analysisContent, stateContent, sourceSha256 }) {
  if (sha256(sourceContent) !== sourceSha256) {
    throw new Error("job-posting.txt SHA-256 validation failed before write.");
  }

  if (!analysisContent.includes("<!-- workflow-version: 2 -->")) {
    throw new Error("job-analysis template is missing the workflow-version: 2 marker.");
  }

  let state;
  try {
    state = JSON.parse(stateContent);
  } catch (error) {
    throw new Error(`workflow-state.json render is invalid JSON: ${error.message}`);
  }

  if (state.workflowVersion !== WORKFLOW_VERSION || state.stage !== "imported") {
    throw new Error("workflow-state.json must start at workflowVersion 2 / imported.");
  }
  if (state.source?.path !== "job-posting.txt" || state.source?.sha256 !== sourceSha256) {
    throw new Error("workflow-state.json source metadata does not match job-posting.txt.");
  }

  const historyBlocks = [...analysisContent.matchAll(/```history-check\n([\s\S]*?)\n```/g)];
  if (historyBlocks.length !== 1) {
    throw new Error("job-analysis.md must contain exactly one history-check block.");
  }

  let analysisHistory;
  try {
    analysisHistory = JSON.parse(historyBlocks[0][1]);
  } catch (error) {
    throw new Error(`job-analysis.md history-check block is invalid JSON: ${error.message}`);
  }
  if (
    state.historyCheck?.version !== HISTORY_VERSION ||
    JSON.stringify(state.historyCheck) !== JSON.stringify(analysisHistory)
  ) {
    throw new Error("History check must match in job-analysis.md and workflow-state.json.");
  }

  const outputNames = Object.values(state.outputs || {}).sort();
  if (JSON.stringify(outputNames) !== JSON.stringify([...ARTIFACT_NAMES].sort())) {
    throw new Error("workflow-state.json outputs must reference the three v2 control artifacts.");
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function slugify(value) {
  const slug = normalizeText(decodeEntities(value))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "unknown";
}

function decodeEntities(value) {
  let decoded = String(value);

  for (let index = 0; index < 3; index += 1) {
    const next = decoded
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&#x2F;/gi, "/")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
        String.fromCharCode(Number.parseInt(code, 16)),
      );

    if (next === decoded) {
      break;
    }

    decoded = next;
  }

  return decoded;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fileExists(filePath) {
  return Boolean(await pathStats(filePath));
}

async function firstExistingPath(filePaths) {
  for (const filePath of filePaths) {
    if (await fileExists(filePath)) return filePath;
  }
  return "";
}

async function replaceArtifactSet(taskDir, artifacts) {
  const names = artifacts.map(({ name }) => name);
  if (
    new Set(names).size !== ARTIFACT_NAMES.length ||
    JSON.stringify(names) !== JSON.stringify(ARTIFACT_NAMES)
  ) {
    throw new Error(
      "Import transaction must contain the three v2 control artifacts in source, analysis, state order.",
    );
  }

  const parentDir = path.dirname(taskDir);
  await mkdir(parentDir, { recursive: true });
  const taskStats = await pathStats(taskDir);

  if (!taskStats) {
    await publishNewArtifactDirectory(parentDir, taskDir, artifacts);
    return;
  }

  if (!taskStats.isDirectory() || taskStats.isSymbolicLink()) {
    throw new Error(`Application path is not a real directory: ${taskDir}`);
  }

  // Reject unexpected artifact types before staging or replacing anything.
  for (const { name } of artifacts) {
    const targetPath = path.join(taskDir, name);
    const stats = await pathStats(targetPath);
    if (stats && !stats.isFile()) {
      throw new Error(`Refusing to replace non-file import artifact: ${targetPath}`);
    }
  }

  const stagingDir = await mkdtemp(
    path.join(parentDir, `.${path.basename(taskDir)}.import-`),
  );
  let preserveStaging = false;

  try {
    await writeStagedArtifacts(stagingDir, artifacts);
    await commitArtifactReplacements(taskDir, stagingDir, artifacts);
  } catch (error) {
    preserveStaging = error.preserveStaging === true;
    throw error;
  } finally {
    if (!preserveStaging) {
      await rm(stagingDir, { recursive: true, force: true });
    }
  }
}

async function publishNewArtifactDirectory(parentDir, taskDir, artifacts) {
  const stagingDir = await mkdtemp(
    path.join(parentDir, `.${path.basename(taskDir)}.import-`),
  );

  try {
    await writeStagedArtifacts(stagingDir, artifacts);
    // Publishing the prepared directory is a single same-filesystem rename, so
    // a new application never exposes only part of the v2 artifact set.
    await rename(stagingDir, taskDir);
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
  }
}

async function writeStagedArtifacts(stagingDir, artifacts) {
  for (const { name, content } of artifacts) {
    const stagedPath = path.join(stagingDir, name);
    await writeFile(stagedPath, content, { encoding: "utf8", flag: "wx" });
    const stagedContent = await readFile(stagedPath, "utf8");
    if (stagedContent !== content) {
      throw new Error(`Staged artifact verification failed: ${name}`);
    }
  }
}

async function commitArtifactReplacements(taskDir, stagingDir, artifacts) {
  const installed = new Set();
  const backups = new Map();

  try {
    // Artifacts arrive in source → analysis → state order. State is committed
    // last so it cannot advertise a newer import before its source exists.
    for (const { name } of artifacts) {
      const targetPath = path.join(taskDir, name);
      const backupPath = path.join(stagingDir, `.backup-${name}`);
      if (await fileExists(targetPath)) {
        await rename(targetPath, backupPath);
        backups.set(targetPath, backupPath);
      }

      await rename(path.join(stagingDir, name), targetPath);
      installed.add(targetPath);
    }
  } catch (error) {
    const rollbackErrors = [];

    for (const { name } of [...artifacts].reverse()) {
      const targetPath = path.join(taskDir, name);
      const backupPath = backups.get(targetPath);

      try {
        if (installed.has(targetPath)) {
          await rm(targetPath, { force: true });
        }
        if (backupPath) {
          await rename(backupPath, targetPath);
        }
      } catch (rollbackError) {
        rollbackErrors.push(`${name}: ${rollbackError.message}`);
      }
    }

    if (rollbackErrors.length > 0) {
      const rollbackFailure = new Error(
        `Artifact replacement failed (${error.message}); rollback also failed (${rollbackErrors.join("; ")}). Recovery files were retained at ${stagingDir}.`,
        { cause: error },
      );
      rollbackFailure.preserveStaging = true;
      throw rollbackFailure;
    }
    throw error;
  }
}

async function pathStats(filePath) {
  try {
    return await lstat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function localDate() {
  return new Date().toLocaleDateString("en-CA");
}
