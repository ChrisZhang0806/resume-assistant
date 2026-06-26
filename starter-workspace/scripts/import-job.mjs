#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT_ROOT = "applications";

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

  if (!args.force && (await fileExists(analysisPath))) {
    throw new Error(
      `job-analysis.md already exists at ${analysisPath}. Re-run with --force to overwrite.`,
    );
  }

  await mkdir(taskDir, { recursive: true });
  await writeFile(
    analysisPath,
    renderJobAnalysis({
      applicationDate,
      taskDir: path.relative(ROOT, taskDir),
      source: args.source,
      fetched,
      extracted,
    }),
    "utf8",
  );

  console.log(`Created ${path.relative(ROOT, analysisPath)}`);

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

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/import-job.mjs <job-url> [options]

Options:
  --date YYYY-MM-DD       Application/import date. Defaults to today's local date.
  --company "Name"        Override extracted company name.
  --role "Title"          Override extracted job title.
  --browser-text FILE     Use visible job text copied from the browser for the job body.
  --out-root DIR          Output root. Defaults to applications.
  --force                 Overwrite an existing job-analysis.md.
  --help                  Show this help.

Examples:
  node scripts/import-job.mjs https://boards.greenhouse.io/example/jobs/123
  node scripts/import-job.mjs https://www.linkedin.com/jobs/view/123 --browser-text /tmp/job-visible.txt
  node scripts/import-job.mjs ./tmp/job.html --company "Acme" --role "Product Designer"

For job URLs, prefer --browser-text with text copied from the visible job detail pane.
URL-only import is a fallback and must be reviewed for missing or noisy content, especially for LinkedIn, Workday, Job Bank, and other dynamic or anti-scraping sites.
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
    const response = await fetch(source, {
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-CA,en-US;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      },
    });

    const html = await response.text();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} while fetching ${source}. Saved content was not generated.`,
      );
    }

    return {
      html,
      finalUrl: response.url || source,
      sourceType: classifySource(response.url || source),
      fetchedVia: "fetch",
    };
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
  const description = chooseDescription(descriptionFromStructured, text, sourceType);
  const sections = extractSections(description || text);
  const keywords = inferKeywords(`${title}\n${description}`);
  const status = computeStatus({ title, company, description });

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
    keywords,
    extractionNotes: buildExtractionNotes({
      structuredJobs,
      status,
      description,
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

  return description
    .split("\n")
    .filter((line) => !isNavigationNoise(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 20000);
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

  const haystack = text.toLowerCase();
  return dictionary.filter((keyword) => haystack.includes(keyword.toLowerCase()));
}

function computeStatus({ title, company, description }) {
  if (title && company && description.length > 300) return "complete";
  if (title || company || description.length > 200) return "partial";
  return "failed";
}

function buildExtractionNotes({ structuredJobs, status, description, sourceType, fetchedVia }) {
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
    if (fetchedVia !== "in-app-browser") {
      notes.push("URL-only LinkedIn import was used. Review the extracted description carefully; visible job text copied from the browser is preferred.");
    }
  } else if (fetchedVia === "fetch" && sourceType !== "local-file") {
    notes.push("URL-only import was used. Review the extracted description for missing content or page chrome; visible job text copied from the browser is preferred for dynamic or anti-scraping sites.");
  }

  if (description.length >= 20000) {
    notes.push("Description was truncated at 20,000 characters.");
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

function renderJobAnalysis({ applicationDate, taskDir, source, fetched, extracted }) {
  const location = extracted.location || "Not extracted";
  const employmentType = extracted.employmentType || "Not extracted";
  const salary = extracted.salary || "Not extracted";
  const datePosted = extracted.datePosted || "Not extracted";
  const validThrough = extracted.validThrough || "Not extracted";
  const seniority = extracted.seniority || "Not extracted";
  const jobFunction = extracted.jobFunction || "Not extracted";
  const industry = extracted.industry || "Not extracted";
  const workplaceType = extracted.workplaceType || "Not extracted";
  const sections = renderSections(extracted.sections);

  return `# Job Analysis - ${extracted.company || "Unknown Company"} ${extracted.title || "Unknown Role"}

## Task Metadata

- Original job link: ${source}
- Final fetched URL: ${fetched.finalUrl}
- Source type: ${extracted.sourceType}
- Fetched via: ${fetched.fetchedVia}
- Extracted on: ${applicationDate}
- Application date used for folder naming: ${applicationDate}
- Task folder: \`${taskDir}/\`
- Extraction status: ${extracted.status}
- Analysis status: Not started. This file is an imported job-analysis.md draft only.
- Target HTML status: Not created. Project workflow requires analysis confirmation and modification-plan confirmation before creating or editing target HTML.

## Job Posting Information

- Company: ${extracted.company || "Not extracted"}
- Job title: ${extracted.title || "Not extracted"}
- Location: ${location}
- Workplace type: ${workplaceType}
- Employment type: ${employmentType}
- Salary / pay range: ${salary}
- Date posted: ${datePosted}
- Valid through / closing date: ${validThrough}
- Seniority level: ${seniority}
- Job function: ${jobFunction}
- Industry: ${industry}

## Extraction Notes

${extracted.extractionNotes.map((note) => `- ${note}`).join("\n")}

## Full Job Description Extracted From Source

${extracted.description || "No job description text could be extracted. Please paste the full job description here before continuing the resume workflow."}

## Extracted Sections

${sections}

## Requirement Summary

### Must-Have

- TODO: Review the extracted job description and list required qualifications.

### Nice-To-Have

- TODO: Review the extracted job description and list preferred qualifications.

### Keywords

${extracted.keywords.length > 0 ? extracted.keywords.map((keyword) => `- ${keyword}`).join("\n") : "- TODO: Add ATS keywords after reviewing the job description."}

### Evidence Needed

- TODO: Identify what resume evidence is needed to support the role requirements.

## Fit Analysis

### Job Summary

TODO: Summarize the role's core goal, role type, and most important hiring signals.

### Matching Degree

TODO: Compare this posting against \`master/master-resume.md\` and mark High / Medium / Low.

### Requirement Match Matrix

| Job Requirement | Master Resume Evidence | Target Resume Location | Rewrite Strategy |
| --- | --- | --- | --- |
| TODO | TODO | TODO | TODO |

## ATS Analysis

TODO: Identify repeated keywords, ATS phrases, keyword priority, and placement strategy.

## Localization And Human Voice Analysis

TODO: Check whether the eventual resume wording should emphasize UX research, product design, visual design, AI product, digital media, learning design, technical analysis, or another theme.

## Writing Strategy For The Resume

TODO: Define the honest resume narrative before drafting the modification plan.

## Questions Before Modification Plan

- TODO: Add any missing facts or risk questions that must be confirmed with the user before resume rewriting.

## Confirmation Record

- Job import: Completed on ${applicationDate}.
- Analysis confirmation: Pending.
- Modification plan confirmation: Pending.
- Final target HTML: Not started.
`;
}

function renderSections(sections) {
  const entries = Object.entries(sections);
  if (entries.length === 0) {
    return "No clear Responsibilities / Requirements / Preferred sections were extracted automatically.";
  }

  return entries
    .map(([name, lines]) => {
      const title = name
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      return `### ${title}\n\n${lines.map((line) => `- ${line.replace(/^- /, "")}`).join("\n")}`;
    })
    .join("\n\n");
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
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}

function localDate() {
  return new Date().toLocaleDateString("en-CA");
}
