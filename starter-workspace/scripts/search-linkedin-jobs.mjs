#!/usr/bin/env node

/*
Adapted from the linkedin-search CLI in MadsLorentzen/ai-job-search.

MIT License

Copyright (c) 2026 Mads Lorentzen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import path from "node:path";
import { pathToFileURL } from "node:url";
import { scrapeJobs } from "ts-jobspy";

export const SEARCH_URL =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
export const DETAIL_URL =
  "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FORMATS = new Set(["json", "table", "plain"]);
const WORK_MODES = new Set(["remote", "hybrid", "onsite", "on-site"]);

function writeError(error, code) {
  process.stderr.write(`${JSON.stringify({ error, code })}\n`);
}

function numericEntity(codePoint) {
  return codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : "";
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, value) => numericEntity(Number.parseInt(value, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, value) =>
      numericEntity(Number.parseInt(value, 16)),
    )
    .replace(/&nbsp;/g, " ");
}

function cleanInline(html) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBlock(html) {
  return decodeHtmlEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function extractTitleTerms(query = "") {
  return [...query.matchAll(/title\s*:\s*"([^"]+)"/gi)].map((match) =>
    normalizeSearchText(match[1]),
  );
}

export function matchesTitleQuery(job, query) {
  const terms = extractTitleTerms(query);
  if (terms.length === 0) return true;
  const title = normalizeSearchText(job.title);
  return terms.some((term) => title.includes(term));
}

export function normalizeLocation(value) {
  const aliases = new Map([
    ["ab", "alberta"],
    ["bc", "british columbia"],
    ["mb", "manitoba"],
    ["nb", "new brunswick"],
    ["nl", "newfoundland and labrador"],
    ["ns", "nova scotia"],
    ["nt", "northwest territories"],
    ["nu", "nunavut"],
    ["on", "ontario"],
    ["pe", "prince edward island"],
    ["pei", "prince edward island"],
    ["qc", "quebec"],
    ["sk", "saskatchewan"],
    ["yt", "yukon"],
    ["ca", "canada"],
  ]);
  return normalizeSearchText(value)
    .split(" ")
    .map((part) => aliases.get(part) ?? part)
    .join(" ");
}

export function extractDivContent(html, className) {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const openMatch = new RegExp(
    `<div[^>]*class="[^"]*${escaped}[^"]*"[^>]*>`,
    "i",
  ).exec(html);
  if (!openMatch) return null;

  let cursor = openMatch.index + openMatch[0].length;
  let depth = 1;
  while (depth > 0 && cursor < html.length) {
    const nextOpen = html.indexOf("<div", cursor);
    const nextClose = html.indexOf("</div>", cursor);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 4;
    } else {
      depth -= 1;
      cursor = nextClose + 6;
    }
  }

  return html.slice(openMatch.index + openMatch[0].length, cursor - 6);
}

export function parseJobCards(html) {
  const results = [];
  const chunks = html.split(/data-entity-urn="urn:li:jobPosting:/).slice(1);

  for (const chunk of chunks) {
    const id = chunk.match(/^(\d+)/)?.[1];
    if (!id) continue;

    const link = chunk.match(
      /class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/i,
    )?.[1];
    const titleHtml =
      chunk.match(
        /class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i,
      )?.[1] ??
      chunk.match(/class="sr-only"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    if (!titleHtml) continue;

    const companyHtml = chunk.match(
      /class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i,
    )?.[1];
    const companyLink = companyHtml?.match(/href="([^"]+)"/i)?.[1];
    const locationHtml = chunk.match(
      /class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1];
    const date = chunk.match(
      /class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i,
    )?.[1];

    results.push({
      id,
      source: "linkedin",
      title: cleanInline(titleHtml),
      company: companyHtml ? cleanInline(companyHtml) || null : null,
      companyUrl: companyLink
        ? decodeHtmlEntities(companyLink).split("?")[0]
        : null,
      location: locationHtml ? cleanInline(locationHtml) || null : null,
      date: date || null,
      url: link
        ? decodeHtmlEntities(link).split("?")[0]
        : `https://www.linkedin.com/jobs/view/${id}`,
    });
  }

  return results;
}

export function parseJobDetail(html, id) {
  const titleHtml = html.match(
    /class="(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i,
  )?.[1];
  const organization = html.match(
    /class="topcard__org-name-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
  );
  const locationHtml = html.match(
    /class="topcard__flavor topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i,
  )?.[1];
  const descriptionHtml =
    extractDivContent(html, "show-more-less-html__markup") ??
    extractDivContent(html, "description__text");

  const criteria = {};
  const criterionPattern =
    /class="description__job-criteria-subheader"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?class="description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = criterionPattern.exec(html)) !== null) {
    criteria[cleanInline(match[1]).toLowerCase()] = cleanInline(match[2]);
  }

  const applyUrl = html.match(
    /class="topcard__link[^"]*"[^>]*href="([^"]+)"/i,
  )?.[1];

  return {
    id,
    source: "linkedin",
    title: titleHtml ? cleanInline(titleHtml) : "(untitled)",
    company: organization ? cleanInline(organization[2]) || null : null,
    companyUrl: organization
      ? decodeHtmlEntities(organization[1]).split("?")[0]
      : null,
    location: locationHtml ? cleanInline(locationHtml) || null : null,
    date: null,
    url: `https://www.linkedin.com/jobs/view/${id}`,
    description: descriptionHtml ? cleanBlock(descriptionHtml) || null : null,
    seniority: criteria["seniority level"] ?? null,
    employmentType: criteria["employment type"] ?? null,
    jobFunction: criteria["job function"] ?? null,
    industries: criteria.industries ?? null,
    applyUrl: applyUrl ? decodeHtmlEntities(applyUrl).split("?")[0] : null,
  };
}

export function buildSearchUrl(options) {
  const params = new URLSearchParams();
  if (options.query) params.set("keywords", options.query);
  params.set("location", options.location);
  if (options.jobage > 0) params.set("f_TPR", `r${options.jobage * 86400}`);
  const workType = {
    onsite: "1",
    "on-site": "1",
    remote: "2",
    hybrid: "3",
  }[options.remote];
  if (workType) params.set("f_WT", workType);
  params.set("start", String((options.page - 1) * 10));
  return `${SEARCH_URL}?${params.toString()}`;
}

export function buildIndeedOptions(options) {
  return {
    siteName: "indeed",
    searchTerm: options.query,
    location: options.location,
    countryIndeed: "Canada",
    resultsWanted: options.limit,
    offset: (options.page - 1) * 10,
    hoursOld: options.jobage > 0 ? options.jobage * 24 : undefined,
    isRemote: options.remote === "remote",
    descriptionFormat: "markdown",
    verbose: 0,
  };
}

export function normalizeIndeedJob(job) {
  return {
    id: job.id ?? job.jobUrl,
    source: "indeed",
    title: job.title ?? "(untitled)",
    company: job.company ?? null,
    companyUrl: job.companyUrl ?? null,
    location: job.location ?? null,
    date: job.datePosted ?? null,
    url: job.jobUrl,
    applyUrl: job.jobUrlDirect ?? null,
    description: job.description ?? null,
    employmentType: job.jobType ?? null,
    isRemote: job.isRemote ?? null,
  };
}

export function matchesWorkMode(job, workMode) {
  if (!workMode) return true;
  const text = `${job.location ?? ""}\n${job.description ?? ""}`.toLowerCase();
  if (workMode === "remote") return job.isRemote === true;
  if (workMode === "hybrid") return /\bhybrid\b/.test(text);
  // ponytail: Indeed has no exact onsite/hybrid field; replace this heuristic if it adds one.
  return job.isRemote !== true && !/\bhybrid\b/.test(text);
}

export function matchesRecency(date, days, now = new Date()) {
  if (days === 0 || !date) return true;
  const posted = Date.parse(`${date}T00:00:00Z`);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Number.isFinite(posted) && posted >= today - days * 86_400_000;
}

export function mergeJobLists(jobLists, limit) {
  const merged = [];
  const seen = new Set();
  const length = Math.max(0, ...jobLists.map((jobs) => jobs.length));

  for (let index = 0; index < length && merged.length < limit; index += 1) {
    for (const jobs of jobLists) {
      const job = jobs[index];
      if (!job) continue;
      const key = [
        normalizeSearchText(job.title),
        normalizeSearchText(job.company),
        normalizeLocation(job.location),
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(job);
      if (merged.length === limit) break;
    }
  }

  return merged;
}

async function fetchHtml(url) {
  let delay = 500;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 404) return "";
    if (response.status !== 429 && response.status < 500) {
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      return response.text();
    }
    if (attempt === 3) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2;
  }
  return "";
}

function parseInteger(name, value, minimum, maximum) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw Object.assign(new Error(`--${name} must be an integer`), {
      code: "BAD_ARG",
    });
  }
  const parsed = Number.parseInt(value, 10);
  if (parsed < minimum || parsed > maximum) {
    throw Object.assign(
      new Error(`--${name} must be between ${minimum} and ${maximum}`),
      { code: "BAD_ARG" },
    );
  }
  return parsed;
}

export function parseCliArgs(argv) {
  const aliases = { q: "query", l: "location", n: "limit", h: "help" };
  const allowed = new Set([
    "query",
    "location",
    "jobage",
    "remote",
    "page",
    "limit",
    "format",
    "help",
  ]);
  const positionals = [];
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("-")) {
      positionals.push(argument);
      continue;
    }
    const rawName = argument.replace(/^-+/, "");
    const name = aliases[rawName] ?? rawName;
    if (!allowed.has(name)) {
      throw Object.assign(new Error(`Unknown option: ${argument}`), {
        code: "BAD_ARG",
      });
    }
    if (name === "help") {
      flags.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("-")) {
      throw Object.assign(new Error(`${argument} requires a value`), {
        code: "BAD_ARG",
      });
    }
    flags[name] = value;
    index += 1;
  }

  const command = positionals[0];
  if (!command || flags.help) return { command, help: true };
  if (!["search", "detail"].includes(command)) {
    throw Object.assign(new Error(`Unknown command: ${command}`), {
      code: "BAD_CMD",
    });
  }
  if (command === "detail") {
    if (!positionals[1]) {
      throw Object.assign(new Error("detail requires an <id|url>"), {
        code: "NO_ID",
      });
    }
    if (positionals.length > 2) {
      throw Object.assign(new Error("detail accepts one <id|url>"), {
        code: "BAD_ARG",
      });
    }
    const format = flags.format ?? "json";
    if (!["json", "plain"].includes(format)) {
      throw Object.assign(new Error("--format must be json or plain"), {
        code: "BAD_ARG",
      });
    }
    return { command, id: positionals[1], format };
  }

  if (!flags.location) {
    throw Object.assign(new Error("search requires --location/-l"), {
      code: "NO_LOCATION",
    });
  }
  const format = flags.format ?? "json";
  if (!FORMATS.has(format)) {
    throw Object.assign(new Error("--format must be json, table, or plain"), {
      code: "BAD_ARG",
    });
  }
  if (flags.remote && !WORK_MODES.has(flags.remote.toLowerCase())) {
    throw Object.assign(
      new Error("--remote must be remote, hybrid, onsite, or on-site"),
      { code: "BAD_ARG" },
    );
  }

  return {
    command,
    query: flags.query,
    location: flags.location,
    jobage: flags.jobage ? parseInteger("jobage", flags.jobage, 0, 365) : 0,
    remote: flags.remote?.toLowerCase(),
    page: flags.page ? parseInteger("page", flags.page, 1, 100) : 1,
    limit: flags.limit ? parseInteger("limit", flags.limit, 0, 10) : 10,
    format,
  };
}

function normalizeJobId(value) {
  return (
    value.match(/urn:li:jobPosting:(\d+)/)?.[1] ??
    value.match(/\/(\d{6,})(?:\/|\?|$)/)?.[1] ??
    value.match(/^(\d{6,})$/)?.[1] ??
    null
  );
}

function renderTable(jobs) {
  if (jobs.length === 0) return "No results.";
  const header = ["SOURCE", "ID", "TITLE", "COMPANY", "LOCATION", "DATE"];
  const rows = jobs.map((job) => [
    job.source,
    job.id,
    job.title,
    job.company ?? "-",
    job.location ?? "-",
    job.date ?? "-",
  ]);
  const widths = header.map((value, column) =>
    Math.min(
      44,
      Math.max(value.length, ...rows.map((row) => String(row[column]).length)),
    ),
  );
  return [header, ...rows]
    .map((row) =>
      row
        .map((value, column) =>
          String(value).slice(0, widths[column]).padEnd(widths[column]),
        )
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

async function runSearch(options) {
  const [linkedinResult, indeedResult] = await Promise.allSettled([
    fetchHtml(buildSearchUrl(options)).then((html) =>
      parseJobCards(html)
        .filter((job) => matchesTitleQuery(job, options.query))
        .slice(0, options.limit),
    ),
    scrapeJobs(buildIndeedOptions(options)).then((jobs) =>
      jobs
        .map(normalizeIndeedJob)
        .filter((job) => matchesRecency(job.date, options.jobage))
        .filter((job) => matchesWorkMode(job, options.remote))
        .filter((job) => matchesTitleQuery(job, options.query))
        .slice(0, options.limit),
    ),
  ]);
  const sourceErrors = [
    ["linkedin", linkedinResult],
    ["indeed", indeedResult],
  ]
    .filter(([, result]) => result.status === "rejected")
    .map(([source, result]) => ({
      source,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    }));
  if (sourceErrors.length === 2) {
    throw Object.assign(new Error("LinkedIn and Indeed searches both failed"), {
      code: "SOURCE_FAILED",
    });
  }
  const linkedinJobs =
    linkedinResult.status === "fulfilled" ? linkedinResult.value : [];
  const indeedJobs = indeedResult.status === "fulfilled" ? indeedResult.value : [];
  const jobs = mergeJobLists([indeedJobs, linkedinJobs], options.limit);
  const saturated = options.limit > 0 && jobs.length === options.limit;
  const bySource = Object.fromEntries(
    ["linkedin", "indeed"].map((source) => [
      source,
      jobs.filter((job) => job.source === source).length,
    ]),
  );

  if (options.format === "table") {
    process.stdout.write(`${renderTable(jobs)}\n`);
  } else if (options.format === "plain") {
    process.stdout.write(
      `${jobs
        .map(
          (job) =>
            `[${job.source}] ${job.title}\n${job.company ?? "-"} | ${job.location ?? "-"} | ${job.date ?? "-"}\n${job.url}`,
        )
        .join("\n\n")}\n`,
    );
  } else {
    process.stdout.write(
      `${JSON.stringify(
        {
          meta: {
            count: jobs.length,
            page: options.page,
            bySource,
            saturated,
            verificationRequired: [
              "applicationStatus",
              "employmentType",
              ...(options.remote ? ["workMode"] : []),
            ],
            ...(sourceErrors.length > 0 ? { warnings: sourceErrors } : {}),
          },
          results: jobs,
        },
        null,
        2,
      )}\n`,
    );
  }
  if (options.format !== "json") {
    if (saturated) {
      process.stderr.write(
        `${JSON.stringify({ warning: "Query reached the result limit; split it before concluding coverage", code: "QUERY_SATURATED" })}\n`,
      );
    }
    if (options.remote) {
      process.stderr.write(
        `${JSON.stringify({ warning: "Work mode and employment type require full-posting verification", code: "METADATA_UNVERIFIED" })}\n`,
      );
    }
    for (const warning of sourceErrors) {
      writeError(`${warning.source}: ${warning.error}`, "SOURCE_FAILED");
    }
  }
}

async function runDetail(options) {
  const id = normalizeJobId(options.id);
  if (!id) {
    throw Object.assign(new Error(`Could not parse a job ID from "${options.id}"`), {
      code: "BAD_ID",
    });
  }
  const html = await fetchHtml(`${DETAIL_URL}/${id}`);
  if (!html) {
    throw Object.assign(new Error("Job not found"), { code: "NOT_FOUND" });
  }
  const job = parseJobDetail(html, id);
  if (options.format === "plain") {
    process.stdout.write(
      [
        job.title,
        `${job.company ?? "-"} | ${job.location ?? "-"}`,
        job.seniority ? `Seniority: ${job.seniority}` : null,
        job.employmentType ? `Employment: ${job.employmentType}` : null,
        job.jobFunction ? `Function: ${job.jobFunction}` : null,
        job.industries ? `Industries: ${job.industries}` : null,
        "",
        job.description ?? "(no description)",
        "",
        `URL: ${job.url}`,
        job.applyUrl ? `Apply: ${job.applyUrl}` : null,
      ]
        .filter((line) => line !== null)
        .join("\n") + "\n",
    );
  } else {
    process.stdout.write(`${JSON.stringify(job, null, 2)}\n`);
  }
}

const HELP = `Search LinkedIn and Indeed Canada job listings (personal, low-volume use only).

Usage:
  npm run search-jobs -- search -q "<role>" -l "<location>" [options]
  npm run search-jobs -- detail <linkedin-id|url> [--format json|plain]

Search options:
  --query, -q       Role or keywords; title:"..." terms are post-filtered by title
  --location, -l    Required location string
  --jobage          Posted within 0-365 days
  --remote          remote | hybrid | onsite (Indeed uses a text heuristic)
  --page            Page number per source, 1-100
  --limit, -n       Merged result limit, 0-10
  --format          json | table | plain
`;

export async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseCliArgs(argv);
    if (options.help) {
      process.stdout.write(HELP);
      return 0;
    }
    if (options.command === "search") await runSearch(options);
    else await runDetail(options);
    return 0;
  } catch (error) {
    writeError(error instanceof Error ? error.message : String(error), error.code ?? "SEARCH_FAILED");
    return 1;
  }
}

const directPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === directPath) {
  process.exitCode = await main();
}
