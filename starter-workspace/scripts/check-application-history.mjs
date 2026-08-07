#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_LOG = path.join(ROOT, "application-log.md");
const HISTORY_VERSION = 1;
const MATCH_PRIORITY = Object.freeze({
  none: 0,
  "same-company-similar-role": 1,
  "company-role": 2,
  "exact-url": 3,
});

function parseArgs(argv) {
  const args = {
    target: "",
    company: "",
    role: "",
    url: "",
    date: "",
    logPath: DEFAULT_LOG,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--json") args.json = true;
    else if (arg.startsWith("--company=")) args.company = arg.slice("--company=".length);
    else if (arg === "--company") args.company = argv[++index] || "";
    else if (arg.startsWith("--role=")) args.role = arg.slice("--role=".length);
    else if (arg === "--role") args.role = argv[++index] || "";
    else if (arg.startsWith("--url=")) args.url = arg.slice("--url=".length);
    else if (arg === "--url") args.url = argv[++index] || "";
    else if (arg.startsWith("--date=")) args.date = arg.slice("--date=".length);
    else if (arg === "--date") args.date = argv[++index] || "";
    else if (arg.startsWith("--log=")) args.logPath = path.resolve(ROOT, arg.slice("--log=".length));
    else if (arg === "--log") args.logPath = path.resolve(ROOT, argv[++index] || "");
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else if (!args.target) args.target = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }

  if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error("--date must use YYYY-MM-DD format.");
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/check-application-history.mjs <application-folder-or-analysis> [options]
  node scripts/check-application-history.mjs --company "Acme" --role "Product Designer" --url "https://..." [options]

Options:
  --company NAME   Override or provide the company.
  --role TITLE     Override or provide the role.
  --url URL        Override or provide the current job URL.
  --date DATE      Check date in YYYY-MM-DD format. Defaults to today's local date.
  --log FILE       Application log path. Defaults to application-log.md.
  --json           Emit only stable JSON.
  --help           Show this help.

This command is read-only. It never edits application-log.md, historical application
folders, the current application folder, or workflow-state.json. A match must be
recorded in job-analysis.md and resolved before analysis continues.
`);
}

async function resolveTarget(target) {
  if (!target) return {};
  const absolute = path.resolve(ROOT, target);
  const info = await stat(absolute);
  const directory = info.isDirectory() ? absolute : path.dirname(absolute);
  const statePath = path.join(directory, "workflow-state.json");

  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    return {
      company: state.job?.company || "",
      role: state.job?.role || "",
      currentSource: state.job?.source || "",
      checkedAt: state.applicationDate || "",
    };
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }

  const analysisPath = info.isDirectory() ? path.join(directory, "job-analysis.md") : absolute;
  const markdown = await readFile(analysisPath, "utf8");
  return {
    company: markdownValue(markdown, "Company"),
    role: markdownValue(markdown, "Job title") || markdownValue(markdown, "Role"),
    currentSource:
      markdownValue(markdown, "Original source") ||
      markdownValue(markdown, "Original job link") ||
      markdownValue(markdown, "Original source URL"),
    checkedAt: markdownValue(markdown, "Captured date") || markdownValue(markdown, "Application date"),
  };
}

function markdownValue(markdown, label) {
  const escaped = escapeRegExp(label);
  return markdown.match(new RegExp(`^\\s*-\\s*${escaped}\\s*:\\s*(.+?)\\s*$`, "im"))?.[1]?.trim() || "";
}

async function checkApplicationHistory({
  logPath = DEFAULT_LOG,
  company = "",
  role = "",
  currentSource = "",
  checkedAt = localDate(),
} = {}) {
  const base = {
    version: HISTORY_VERSION,
    status: "complete",
    checkedAt: checkedAt || localDate(),
    company: String(company || "").trim(),
    role: String(role || "").trim(),
    currentSource: String(currentSource || "").trim(),
    matchType: "none",
    matches: [],
    requiresUserDecision: false,
    userDecision: "not-required",
  };

  if (!base.company || !base.role) {
    return {
      ...base,
      status: "incomplete",
      userDecision: "pending",
      requiresUserDecision: true,
      error: "Company and role are required for the historical application check.",
    };
  }

  let markdown;
  try {
    markdown = await readFile(logPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      ...base,
      status: "incomplete",
      userDecision: "pending",
      requiresUserDecision: true,
      error: `Application log not found: ${path.relative(ROOT, logPath) || logPath}`,
    };
  }

  const rows = parseApplicationLog(markdown);
  const matches = rows
    .map((row) => classifyMatch(base, row))
    .filter(Boolean)
    .sort((left, right) => {
      const typeDelta = MATCH_PRIORITY[right.matchType] - MATCH_PRIORITY[left.matchType];
      return typeDelta || String(right.applicationDate).localeCompare(String(left.applicationDate));
    });

  if (matches.length === 0) return base;

  return {
    ...base,
    matchType: matches[0].matchType,
    matches,
    requiresUserDecision: true,
    userDecision: "pending",
  };
}

function parseApplicationLog(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    if (!/^\s*\|/.test(line)) return false;
    const headers = splitMarkdownRow(line);
    return headers.includes("Company") && headers.includes("Role");
  });
  if (headerIndex < 0) return [];

  const headers = splitMarkdownRow(lines[headerIndex]);
  const rows = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!/^\s*\|/.test(line)) break;
    const cells = splitMarkdownRow(line);
    if (cells.length !== headers.length) continue;
    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index]])));
  }
  return rows;
}

function splitMarkdownRow(line) {
  const content = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cell = "";
  let escaped = false;

  for (const character of content) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function classifyMatch(current, row) {
  const rowCompany = row.Company || "";
  const rowRole = row.Role || "";
  const rowUrl = row["Job URL"] || row.URL || "";
  const exactUrl = current.currentSource && rowUrl && canonicalUrl(current.currentSource) === canonicalUrl(rowUrl);
  const sameCompany = companyMatches(current.company, rowCompany);
  const roleScore = tokenSimilarity(current.role, rowRole);
  const exactRole = normalizeName(current.role) === normalizeName(rowRole);

  let matchType = "";
  if (exactUrl) matchType = "exact-url";
  else if (sameCompany && exactRole) matchType = "company-role";
  else if (sameCompany && roleScore >= 0.6) matchType = "same-company-similar-role";
  else return null;

  return {
    matchType,
    applicationDate: row["Application Date"] || row.Date || "",
    company: rowCompany,
    role: rowRole,
    status: row["Application Status"] || row.Status || "",
    result: row.Result || "",
    jobUrl: rowUrl,
    resumePdf: row["Resume PDF"] || row["Application Folder"] || "",
  };
}

function companyMatches(left, right) {
  const normalizedLeft = normalizeCompany(left);
  const normalizedRight = normalizeCompany(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  const shorter = normalizedLeft.length <= normalizedRight.length ? normalizedLeft : normalizedRight;
  const longer = shorter === normalizedLeft ? normalizedRight : normalizedLeft;
  return shorter.length >= 4 && longer.includes(shorter);
}

function normalizeCompany(value) {
  return normalizeName(value)
    .split(" ")
    .filter((word) => !new Set(["inc", "incorporated", "ltd", "limited", "llc", "corp", "corporation", "co", "company", "plc"]).has(word))
    .join(" ");
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(normalizeName(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeName(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return intersection / union;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(value) {
  try {
    const url = new URL(String(value).trim());
    url.hash = "";
    url.search = "";
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return String(value || "").trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function localDate() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  if (args.help) {
    printHelp();
    return;
  }

  try {
    const target = await resolveTarget(args.target);
    const result = await checkApplicationHistory({
      logPath: args.logPath,
      company: args.company || target.company,
      role: args.role || target.role,
      currentSource: args.url || target.currentSource,
      checkedAt: args.date || target.checkedAt || localDate(),
    });

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.status !== "complete") {
      console.error(`Historical application check incomplete: ${result.error}`);
    } else if (result.matches.length === 0) {
      console.log(`Historical application check passed: no prior match for ${result.company} — ${result.role}.`);
    } else {
      console.log(`Historical application match found: ${result.company} — ${result.role}.`);
      for (const match of result.matches) {
        console.log(`- ${match.applicationDate || "Unknown date"} | ${match.company} | ${match.role} | ${match.status || "Unknown status"} | ${match.matchType}`);
      }
      console.log("Stop before job analysis. Ask the user whether to stop or continue, then record the decision in the history-check block.");
    }

    if (result.status !== "complete") process.exitCode = 2;
  } catch (error) {
    console.error(`Historical application check failed: ${error.message}`);
    process.exitCode = 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

export {
  HISTORY_VERSION,
  checkApplicationHistory,
  companyMatches,
  parseApplicationLog,
  tokenSimilarity,
};
