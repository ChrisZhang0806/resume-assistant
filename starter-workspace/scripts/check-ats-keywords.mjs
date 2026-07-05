#!/usr/bin/env node

import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

main().catch((error) => {
  console.error(`ATS keyword check failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.resumePath) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const resumePath = path.resolve(args.resumePath);
  const analysisPath = path.resolve(
    args.analysisPath || path.join(path.dirname(resumePath), "job-analysis.md"),
  );
  const reportPath = path.resolve(
    args.reportPath || path.join(path.dirname(resumePath), "ats-keyword-check.md"),
  );

  await assertFile(resumePath, "Resume HTML");
  await assertFile(analysisPath, "job-analysis.md");

  const [resumeHtml, analysisMarkdown] = await Promise.all([
    readFile(resumePath, "utf8"),
    readFile(analysisPath, "utf8"),
  ]);

  const keywordGroups = parseKeywordGroups(analysisMarkdown);
  const resume = extractResumeText(resumeHtml);
  const coverage = buildCoverage(keywordGroups, resume);
  const report = renderReport({
    coverage,
    resumePath,
    analysisPath,
  });

  await writeFile(reportPath, report, "utf8");
  printConsoleReport(coverage, reportPath);

  if (coverage.noMustUseKeywords) {
    console.error(
      "\nAction required: Add a reviewed '## ATS Keywords' section with '### Must Use' keywords before final resume delivery.",
    );
    process.exit(1);
  }

  if (coverage.missingMust.length > 0) {
    console.error(
      "\nAction required: Rewrite the resume so every supported Must Use keyword appears naturally in Summary, Project, Experience, or Skills.",
    );
    process.exit(1);
  }

  process.exit(0);
}

function parseArgs(argv) {
  const args = {
    resumePath: "",
    analysisPath: "",
    reportPath: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--analysis=")) {
      args.analysisPath = arg.slice("--analysis=".length);
    } else if (arg === "--analysis") {
      args.analysisPath = argv[++index] || "";
    } else if (arg.startsWith("--report=")) {
      args.reportPath = arg.slice("--report=".length);
    } else if (arg === "--report") {
      args.reportPath = argv[++index] || "";
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.resumePath) {
      args.resumePath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/check-ats-keywords.mjs <target-resume.html> [options]

Options:
  --analysis FILE       job-analysis.md path. Defaults to the resume folder.
  --report FILE         Markdown report path. Defaults to ats-keyword-check.md in the resume folder.
  --help, -h            Show this help.

Examples:
  npm run check-ats -- "applications/2026-07-05-company-role/resume.html"
  node scripts/check-ats-keywords.mjs applications/2026-07-05-company-role/resume.html --analysis applications/2026-07-05-company-role/job-analysis.md

The check fails when:
  - job-analysis.md does not contain reviewed Must Use ATS keywords.
  - Any Must Use keyword is missing from the resume.

Missing Should Use or Optional keywords are warnings, not blockers.
`);
}

function parseKeywordGroups(markdown) {
  const groups = {
    must: [],
    should: [],
    optional: [],
    careful: [],
  };

  const atsSection = extractMarkdownSection(markdown, "ATS Keywords", 2);

  if (atsSection) {
    const subsections = splitSubsections(atsSection, 3);
    for (const subsection of subsections) {
      const bucket = classifyKeywordHeading(subsection.heading);
      const keywords = extractBullets(subsection.body);
      groups[bucket].push(...keywords);
    }
  }

  if (groups.must.length === 0 && groups.should.length === 0 && groups.optional.length === 0) {
    const fallbackKeywords = extractFallbackKeywords(markdown);
    groups.should.push(...fallbackKeywords);
  }

  return {
    must: uniqueKeywords(groups.must),
    should: uniqueKeywords(groups.should),
    optional: uniqueKeywords(groups.optional),
    careful: uniqueKeywords(groups.careful),
  };
}

function extractMarkdownSection(markdown, heading, level) {
  const hashes = "#".repeat(level);
  const escapedHeading = escapeRegExp(heading);
  const pattern = new RegExp(
    `^${hashes}\\s+${escapedHeading}\\s*$([\\s\\S]*?)(?=^${hashes}\\s+|$(?![\\s\\S]))`,
    "im",
  );
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
}

function splitSubsections(markdown, level) {
  const hashes = "#".repeat(level);
  const headingPattern = new RegExp(`^${hashes}\\s+(.+?)\\s*$`, "gm");
  const matches = [...markdown.matchAll(headingPattern)];

  if (matches.length === 0) {
    return [{ heading: "Should Use", body: markdown }];
  }

  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    return {
      heading: match[1],
      body: markdown.slice(start, end),
    };
  });
}

function classifyKeywordHeading(heading) {
  const label = normalizeForSearch(heading);
  if (label.includes("must")) return "must";
  if (label.includes("should")) return "should";
  if (label.includes("optional")) return "optional";
  if (
    label.includes("careful") ||
    label.includes("unsupported") ||
    label.includes("avoid") ||
    label.includes("do not")
  ) {
    return "careful";
  }
  return "should";
}

function extractBullets(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+?)\s*$/)?.[1] || "")
    .flatMap(splitKeywordLine)
    .map(cleanKeyword)
    .filter(Boolean)
    .filter((keyword) => !/^(todo|keyword|add ats keywords?|add keyword)$/i.test(keyword));
}

function splitKeywordLine(line) {
  const withoutComment = line.replace(/\s+#.+$/, "").trim();
  if (!withoutComment) return [];

  const colonIndex = withoutComment.indexOf(":");
  const beforeColon = colonIndex >= 0 ? withoutComment.slice(0, colonIndex).trim() : "";
  const candidate = beforeColon && beforeColon.length <= 64 ? beforeColon : withoutComment;

  if (candidate.includes(";")) {
    return candidate.split(";").map((part) => part.trim());
  }

  if (candidate.includes(",") && candidate.length <= 100) {
    return candidate.split(",").map((part) => part.trim());
  }

  return [candidate];
}

function cleanKeyword(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/^["'“”‘’]+|["'“”‘’.,;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFallbackKeywords(markdown) {
  const requirementSummary = extractMarkdownSection(markdown, "Requirement Summary", 2);
  const keywordsSection = requirementSummary
    ? extractMarkdownSection(requirementSummary, "Keywords", 3)
    : "";

  return extractBullets(keywordsSection);
}

function uniqueKeywords(keywords) {
  const seen = new Set();
  const result = [];

  for (const keyword of keywords) {
    const key = normalizeForSearch(keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
  }

  return result;
}

function extractResumeText(html) {
  const $ = cheerio.load(html);
  $("script, style").remove();

  const root = $(".resume").first().length ? $(".resume").first() : $("body");
  const sections = [];

  const header = root.find(".resume-header").first();
  if (header.length) {
    sections.push({ name: "Header", text: elementText($, header) });
  }

  const summary = root.find(".summary").first();
  if (summary.length) {
    sections.push({ name: "Summary", text: elementText($, summary) });
  }

  root.find("section").each((_, el) => {
    const section = $(el);
    if (section.is(".summary")) return;
    const heading = normalizeWhitespace(section.find("h2").first().text());
    const aria = normalizeWhitespace(section.attr("aria-label") || "");
    const className = normalizeWhitespace(section.attr("class") || "");
    sections.push({
      name: heading || aria || className || "Section",
      text: elementText($, section),
    });
  });

  const fullText = elementText($, root);

  return {
    fullText,
    sections,
  };
}

function buildCoverage(keywordGroups, resume) {
  const allRows = [];
  const groups = {
    must: buildRows("Must Use", keywordGroups.must, resume),
    should: buildRows("Should Use", keywordGroups.should, resume),
    optional: buildRows("Optional", keywordGroups.optional, resume),
  };

  allRows.push(...groups.must, ...groups.should, ...groups.optional);

  return {
    groups,
    allRows,
    noMustUseKeywords: keywordGroups.must.length === 0,
    missingMust: groups.must.filter((row) => !row.present),
    missingShould: groups.should.filter((row) => !row.present),
    stuffingWarnings: allRows.filter((row) => row.count > stuffingThreshold(row.keyword)),
  };
}

function buildRows(priority, keywords, resume) {
  return keywords.map((keyword) => {
    const alternatives = buildAlternatives(keyword);
    const count = countKeywordMatches(resume.fullText, alternatives);
    const locations = resume.sections
      .filter((section) => hasAnyAlternative(section.text, alternatives))
      .map((section) => section.name);

    return {
      priority,
      keyword,
      alternatives,
      present: count > 0,
      count,
      locations,
    };
  });
}

function buildAlternatives(keyword) {
  const alternatives = new Set();
  const cleaned = cleanKeyword(keyword);

  addAlternative(alternatives, cleaned);
  addAlternative(alternatives, cleaned.replace(/\([^)]*\)/g, "").trim());

  for (const match of cleaned.matchAll(/\(([^)]+)\)/g)) {
    addAlternative(alternatives, match[1]);
  }

  for (const part of cleaned.split(/\s*\/\s*/)) {
    addAlternative(alternatives, part);
  }

  return [...alternatives].filter(Boolean);
}

function addAlternative(set, value) {
  const cleaned = cleanKeyword(value);
  const normalized = normalizeForSearch(cleaned);
  if (!normalized) return;
  set.add(cleaned);
}

function hasAnyAlternative(text, alternatives) {
  return alternatives.some((alternative) => countOneAlternative(text, alternative) > 0);
}

function countKeywordMatches(text, alternatives) {
  return Math.max(0, ...alternatives.map((alternative) => countOneAlternative(text, alternative)));
}

function countOneAlternative(text, keyword) {
  const haystack = ` ${normalizeForSearch(text)} `;
  const needle = normalizeForSearch(keyword);
  if (!needle) return 0;

  const pattern = new RegExp(`(?<![a-z0-9+#.])${escapeRegExp(needle)}(?![a-z0-9+#.])`, "g");
  return [...haystack.matchAll(pattern)].length;
}

function stuffingThreshold(keyword) {
  const normalized = normalizeForSearch(keyword);
  if (normalized.length <= 3) return 6;
  return 3;
}

function renderReport({ coverage, resumePath, analysisPath }) {
  const lines = [];
  const status = coverage.noMustUseKeywords || coverage.missingMust.length > 0
    ? "Needs rewrite"
    : "Pass";

  lines.push("# ATS Keyword Coverage Check");
  lines.push("");
  lines.push(`- Resume: \`${path.relative(process.cwd(), resumePath)}\``);
  lines.push(`- Job analysis: \`${path.relative(process.cwd(), analysisPath)}\``);
  lines.push(`- Checked on: ${new Date().toISOString()}`);
  lines.push(`- Result: ${status}`);
  lines.push("");
  lines.push(summaryLine("Must Use", coverage.groups.must));
  lines.push(summaryLine("Should Use", coverage.groups.should));
  lines.push(summaryLine("Optional", coverage.groups.optional));
  lines.push("");

  if (coverage.noMustUseKeywords) {
    lines.push("## Blocking Issue");
    lines.push("");
    lines.push("- `job-analysis.md` must include reviewed `### Must Use` ATS keywords before final resume delivery.");
    lines.push("");
  }

  lines.push("## Keyword Coverage");
  lines.push("");
  lines.push("| Priority | Keyword | Status | Placement | Count |");
  lines.push("| --- | --- | --- | --- | --- |");

  for (const row of coverage.allRows) {
    lines.push(
      `| ${escapeMarkdownTable(row.priority)} | ${escapeMarkdownTable(row.keyword)} | ${row.present ? "Present" : "Missing"} | ${escapeMarkdownTable(row.locations.join(", ") || "-")} | ${row.count} |`,
    );
  }

  if (coverage.missingMust.length > 0) {
    lines.push("");
    lines.push("## Required Rewrite");
    lines.push("");
    for (const row of coverage.missingMust) {
      lines.push(`- Add \`${row.keyword}\` naturally to Summary, Project, Experience, or Skills if it is supported by verified evidence. If unsupported, move it out of Must Use and record it as a risk in \`job-analysis.md\`.`);
    }
  }

  if (coverage.missingShould.length > 0) {
    lines.push("");
    lines.push("## Recommended Rewrite");
    lines.push("");
    for (const row of coverage.missingShould) {
      lines.push(`- Consider adding \`${row.keyword}\` if it fits naturally and is supported by verified evidence.`);
    }
  }

  if (coverage.stuffingWarnings.length > 0) {
    lines.push("");
    lines.push("## Keyword Stuffing Watchlist");
    lines.push("");
    for (const row of coverage.stuffingWarnings) {
      lines.push(`- \`${row.keyword}\` appears ${row.count} times. Check that the wording still sounds natural.`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function printConsoleReport(coverage, reportPath) {
  console.log("\n========================================");
  console.log("ATS Keyword Coverage Check");
  console.log("========================================");
  console.log(summaryLine("Must Use", coverage.groups.must));
  console.log(summaryLine("Should Use", coverage.groups.should));
  console.log(summaryLine("Optional", coverage.groups.optional));
  console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);

  if (coverage.missingMust.length > 0) {
    console.log("\nMissing Must Use keywords:");
    coverage.missingMust.forEach((row) => console.log(`- ${row.keyword}`));
  }

  if (coverage.missingShould.length > 0) {
    console.log("\nMissing Should Use keywords:");
    coverage.missingShould.forEach((row) => console.log(`- ${row.keyword}`));
  }

  if (coverage.stuffingWarnings.length > 0) {
    console.log("\nKeyword stuffing watchlist:");
    coverage.stuffingWarnings.forEach((row) => console.log(`- ${row.keyword}: ${row.count} matches`));
  }
}

function summaryLine(label, rows) {
  const present = rows.filter((row) => row.present).length;
  return `- ${label}: ${present}/${rows.length} present`;
}

function elementText($, element) {
  return normalizeWhitespace($(element).text());
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeForSearch(value) {
  return decodeEntities(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeMarkdownTable(value) {
  return String(value || "").replace(/\|/g, "\\|");
}

async function assertFile(filePath, label) {
  try {
    const result = await stat(filePath);
    if (!result.isFile()) {
      throw new Error(`${label} is not a file: ${filePath}`);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${label} not found: ${filePath}`);
    }
    throw error;
  }
}
