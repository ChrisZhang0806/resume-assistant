#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TEMPLATE_PATH = path.join(
  ROOT,
  "base",
  "cover-letter-template.html",
);
const DEFAULT_MIN_WORDS = 220;
const DEFAULT_MAX_WORDS = 300;
const DEFAULT_PARAGRAPHS = 3;
const REQUIRED_TEMPLATE_PLACEHOLDERS = [
  "DOCUMENT_TITLE",
  "STYLES_HREF",
  "NAME",
  "CONTACT_LINES",
  "ROLE",
  "COMPANY",
  "SALUTATION",
  "BODY_PARAGRAPHS",
  "SIGNOFF",
];
const OPTIONAL_TEMPLATE_PLACEHOLDERS = [
  "EMAIL",
  "EMAIL_HREF",
  "PORTFOLIO",
  "PORTFOLIO_HREF",
  "LINKEDIN",
  "LINKEDIN_HREF",
  "PHONE",
  "LOCATION",
];

main().catch((error) => {
  console.error(`Cover letter HTML generation failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.inputPath) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  validateWordRange(args.minWords, args.maxWords);

  const inputPath = path.resolve(args.inputPath);
  const outputPath = path.resolve(
    args.outputPath || defaultOutputPath(inputPath),
  );
  const templatePath = path.resolve(args.templatePath || DEFAULT_TEMPLATE_PATH);
  const statePath = path.join(path.dirname(inputPath), "workflow-state.json");

  await assertFile(inputPath, "Cover letter Markdown");
  await assertFile(templatePath, "Cover letter HTML template");
  const workflowState = await readOptionalWorkflowState(statePath);
  await assertDistinctOutputPath(outputPath, [
    { filePath: inputPath, label: "Markdown input" },
    { filePath: templatePath, label: "HTML template" },
    { filePath: statePath, label: "workflow state" },
  ]);
  assertCoverLetterConfirmation(workflowState, statePath);
  await mkdir(path.dirname(outputPath), { recursive: true });

  const [markdown, template] = await Promise.all([
    readFile(inputPath, "utf8"),
    readFile(templatePath, "utf8"),
  ]);
  const letter = parseCoverLetter(markdown, args);
  const html = renderCoverLetter(
    template,
    letter,
    relativeStylesPath(outputPath),
  );

  await atomicWriteFile(outputPath, html);
  if (workflowState) {
    await updateWorkflowStateAfterCoverLetter(
      workflowState,
      statePath,
      inputPath,
      outputPath,
      letter,
    );
  }
  console.log(
    `Created ${path.relative(process.cwd(), outputPath)} (${letter.bodyWordCount} body words)`,
  );
}

function parseArgs(argv) {
  const args = {
    inputPath: "",
    outputPath: "",
    templatePath: "",
    role: "",
    company: "",
    minWords: DEFAULT_MIN_WORDS,
    maxWords: DEFAULT_MAX_WORDS,
    paragraphs: DEFAULT_PARAGRAPHS,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--output" || arg === "-o") {
      args.outputPath = readOptionValue(argv, ++index, "--output");
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--template") {
      args.templatePath = readOptionValue(argv, ++index, "--template");
    } else if (arg.startsWith("--template=")) {
      args.templatePath = arg.slice("--template=".length);
    } else if (arg === "--role") {
      args.role = readOptionValue(argv, ++index, "--role");
    } else if (arg.startsWith("--role=")) {
      args.role = arg.slice("--role=".length);
    } else if (arg === "--company") {
      args.company = readOptionValue(argv, ++index, "--company");
    } else if (arg.startsWith("--company=")) {
      args.company = arg.slice("--company=".length);
    } else if (arg === "--min-words") {
      args.minWords = parsePositiveInteger(
        readOptionValue(argv, ++index, "--min-words"),
        "--min-words",
      );
    } else if (arg.startsWith("--min-words=")) {
      args.minWords = parsePositiveInteger(
        arg.slice("--min-words=".length),
        "--min-words",
      );
    } else if (arg === "--max-words") {
      args.maxWords = parsePositiveInteger(
        readOptionValue(argv, ++index, "--max-words"),
        "--max-words",
      );
    } else if (arg.startsWith("--max-words=")) {
      args.maxWords = parsePositiveInteger(
        arg.slice("--max-words=".length),
        "--max-words",
      );
    } else if (arg === "--paragraphs") {
      args.paragraphs = parsePositiveInteger(
        readOptionValue(argv, ++index, "--paragraphs"),
        "--paragraphs",
      );
    } else if (arg.startsWith("--paragraphs=")) {
      args.paragraphs = parsePositiveInteger(
        arg.slice("--paragraphs=".length),
        "--paragraphs",
      );
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.inputPath) {
      args.inputPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return args;
}

function readOptionValue(argv, index, optionName) {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, optionName) {
  const normalized = String(value).trim();
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== normalized) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return parsed;
}

function validateWordRange(minWords, maxWords) {
  if (minWords > maxWords) {
    throw new Error("--min-words cannot be greater than --max-words.");
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/generate-cover-letter-html.mjs <cover-letter.md> [options]

Options:
  --role ROLE           Role shown in the cover letter title.
  --company COMPANY     Company shown in the cover letter title.
  --template FILE       HTML template. Defaults to base/cover-letter-template.html.
  --min-words NUMBER    Minimum body words. Defaults to ${DEFAULT_MIN_WORDS}.
  --max-words NUMBER    Maximum body words. Defaults to ${DEFAULT_MAX_WORDS}.
  --paragraphs NUMBER   Required body paragraphs. Defaults to ${DEFAULT_PARAGRAPHS}.
  --output, -o FILE     HTML output path. Defaults to the Markdown path with .html.
  --help, -h            Show this help.

Candidate name and email are required. Location, phone, portfolio, and LinkedIn
are optional; supplied values are validated and only present values are rendered.

Required template fields:
  ${REQUIRED_TEMPLATE_PLACEHOLDERS.map((item) => `{{${item}}}`).join(", ")}

Optional template fields:
  ${OPTIONAL_TEMPLATE_PLACEHOLDERS.map((item) => `{{${item}}}`).join(", ")}

CONTACT_LINES and BODY_PARAGRAPHS are generated HTML. Every other field is escaped.

Example:
  node scripts/generate-cover-letter-html.mjs applications/example/cover-letter.md --role "Product Designer" --company "Example Company"
`);
}

function defaultOutputPath(inputPath) {
  return /\.md$/i.test(inputPath)
    ? inputPath.replace(/\.md$/i, ".html")
    : `${inputPath}.html`;
}

async function assertFile(filePath, label) {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0) throw new Error();
  } catch {
    throw new Error(`${label} not found or empty: ${filePath}`);
  }
}

function parseCoverLetter(markdown, args) {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const salutationIndex = lines.findIndex((line) => /^Dear\b/i.test(line.trim()));
  if (salutationIndex < 0) {
    throw new Error('Cover letter must include a salutation beginning with "Dear".');
  }

  const signoffIndex = lines.findIndex((line, index) => {
    return index > salutationIndex && isSignoff(line);
  });
  if (signoffIndex < 0) {
    throw new Error(
      "Cover letter must include a signoff such as Sincerely, Best, or Regards.",
    );
  }

  const contact = parseContactHeader(lines.slice(0, salutationIndex));
  validateContact(contact);

  const paragraphs = parseBodyParagraphs(
    lines.slice(salutationIndex + 1, signoffIndex),
  );
  if (paragraphs.length !== args.paragraphs) {
    throw new Error(
      `Cover letter must contain exactly ${args.paragraphs} body paragraphs; found ${paragraphs.length}. Use --paragraphs only for an explicit format override.`,
    );
  }

  const bodyWordCount = countBodyWords(paragraphs);
  if (bodyWordCount < args.minWords || bodyWordCount > args.maxWords) {
    throw new Error(
      `Cover letter body word count is ${bodyWordCount}; expected ${args.minWords}-${args.maxWords}. Use --min-words/--max-words only for an explicit format override.`,
    );
  }

  const inferred = inferRoleAndCompany(paragraphs.join("\n\n"));
  const role = String(args.role || inferred.role || "").trim();
  const company = String(args.company || inferred.company || "").trim();
  validateRequiredText(role, "Role", ["role", "role title", "position"]);
  validateRequiredText(company, "Company", ["company", "company name"]);

  return {
    ...contact,
    salutation: lines[salutationIndex].trim(),
    signoff: lines[signoffIndex].trim(),
    role,
    company,
    paragraphs,
    bodyWordCount,
  };
}

function parseContactHeader(headerLines) {
  const lines = headerLines
    .map((line) => String(line).trim())
    .filter(Boolean)
    .filter((line) => line !== "---");
  if (lines.length === 0) return emptyContact();

  let nameIndex = 0;
  if (/^cover letter\b/i.test(stripHeading(lines[0]))) nameIndex = 1;

  const name = stripHeading(lines[nameIndex] || "");
  const searchableLines = lines.slice(nameIndex + 1);
  const items = searchableLines
    .flatMap((line) => line.split("|"))
    .map((item) => item.trim())
    .filter(Boolean);
  const allContactText = searchableLines.join(" | ");
  const email = firstEmail(allContactText);
  const phone =
    items.find((item) => {
      return (
        !item.includes("@") &&
        !looksLikeWebAddress(item) &&
        digitCount(item) >= 7
      );
    }) || "";
  const links = items.map(parseLinkItem).filter(Boolean);
  const portfolio = links.find((link) => !isLinkedInLink(link)) || emptyLink();
  const linkedin = links.find(isLinkedInLink) || emptyLink();
  const location =
    searchableLines.find((line) => {
      return (
        !firstEmail(line) &&
        digitCount(line) < 7 &&
        !looksLikeWebAddress(line) &&
        !looksLikeDate(line) &&
        !/^(?:to|recipient|hiring team|hiring manager)\b/i.test(line)
      );
    }) || "";

  return { name, location, email, phone, portfolio, linkedin };
}

function emptyContact() {
  return {
    name: "",
    location: "",
    email: "",
    phone: "",
    portfolio: emptyLink(),
    linkedin: emptyLink(),
  };
}

function emptyLink() {
  return { label: "", href: "" };
}

function stripHeading(line) {
  return String(line).replace(/^#+\s*/, "").trim();
}

function firstEmail(value) {
  const match = String(value).match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
  return match ? match[0] : "";
}

function parseLinkItem(item) {
  const value = String(item).trim();
  const markdownLink = value.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/i);
  if (markdownLink) {
    return { label: markdownLink[1].trim(), href: markdownLink[2].trim() };
  }

  if (!looksLikeWebAddress(value) || value.includes("@")) return null;
  const rawAddress =
    value.match(
      /(?:https?:\/\/)?(?:www\.)?[A-Z0-9.-]+\.[A-Z]{2,}(?:\/[^\s|]*)?/i,
    )?.[0] || "";
  if (!rawAddress) return null;
  return { label: rawAddress, href: toUrl(rawAddress) };
}

function isLinkedInLink(link) {
  return /linkedin\.com\//i.test(`${link.label} ${link.href}`);
}

function looksLikeWebAddress(value) {
  return /(?:https?:\/\/|www\.)?[A-Z0-9.-]+\.[A-Z]{2,}(?:\/[^\s|]*)?/i.test(
    String(value),
  );
}

function looksLikeDate(value) {
  return /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/i.test(
    String(value).trim(),
  );
}

function digitCount(value) {
  return (String(value).match(/\d/g) || []).length;
}

function validateContact(contact) {
  validateRequiredText(contact.name, "Candidate name", ["your name", "candidate name", "name"]);

  if (!contact.email || !isValidEmail(contact.email) || isPlaceholderEmail(contact.email)) {
    throw new Error("Contact email is missing, invalid, or still a placeholder.");
  }
  if (contact.location) {
    validateRequiredText(contact.location, "Location", ["location", "city, region"]);
  }
  if (contact.phone && digitCount(contact.phone) < 7) {
    throw new Error("Contact phone is invalid.");
  }
  if (contact.portfolio.href) validateContactLink(contact.portfolio, "Portfolio");
  if (contact.linkedin.href) {
    validateContactLink(contact.linkedin, "LinkedIn");
    if (!isLinkedInLink(contact.linkedin)) {
      throw new Error("LinkedIn contact must use a linkedin.com URL.");
    }
  }
}

function isValidEmail(value) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(value));
}

function isPlaceholderEmail(value) {
  return /^(?:professional-email|name)@example\.com$|youremail/i.test(
    String(value),
  );
}

function validateContactLink(link, label) {
  try {
    const parsed = new URL(link.href);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".")) {
      throw new Error();
    }
  } catch {
    throw new Error(`${label} contact is invalid.`);
  }
}

function validateRequiredText(value, label, placeholders = []) {
  const normalized = String(value).trim();
  const lowered = normalized.toLowerCase();
  const looksUnresolved =
    !normalized ||
    /\[[^\]]+\]|\{\{[^}]+\}\}/.test(normalized) ||
    placeholders.includes(lowered) ||
    /^(?:add|enter|insert)\b/i.test(normalized);

  if (looksUnresolved) {
    throw new Error(`${label} is missing or still contains a placeholder.`);
  }
}

function isSignoff(line) {
  return /^(?:Sincerely|Best|Best regards|Kind regards|Regards|Respectfully),?$/i.test(
    String(line).trim(),
  );
}

function parseBodyParagraphs(lines) {
  const source = lines.join("\n").trim();
  if (!source) return [];

  return source
    .split(/\n\s*\n+/)
    .map((paragraph) => {
      return paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter(Boolean);
}

function countBodyWords(paragraphs) {
  const plainText = paragraphs
    .join(" ")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/)?[^)]+\)/g, "$1")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, " link ")
    .replace(/<[^>]+>/g, " ");
  return (
    plainText.match(/[\p{L}\p{N}]+(?:[’'/-][\p{L}\p{N}]+)*/gu) || []
  ).length;
}

function inferRoleAndCompany(text) {
  const patterns = [
    /(?:apply|applying|write to apply)\s+for\s+the\s+(.+?)\s+(?:role|position)\s+at\s+([A-Z0-9][A-Za-z0-9&.'’ -]*?)(?=[,.!?]|\s+(?:because|where|whose)\b|$)/i,
    /application\s+for\s+(?:the\s+)?(.+?)\s+(?:role|position)\s+at\s+([A-Z0-9][A-Za-z0-9&.'’ -]*?)(?=[,.!?]|\s+(?:because|where|whose)\b|$)/i,
  ];

  for (const pattern of patterns) {
    const match = String(text).match(pattern);
    if (match) return { role: match[1].trim(), company: match[2].trim() };
  }
  return {};
}

function renderCoverLetter(template, letter, stylesHref) {
  const body = letter.paragraphs
    .map((paragraph) => `<p>${formatInlineText(paragraph)}</p>`)
    .join("\n\n          ");
  const contactLines = renderContactLines(letter);
  const replacements = {
    DOCUMENT_TITLE: escapeHtml(
      `${letter.name} - ${letter.company} Cover Letter`,
    ),
    STYLES_HREF: escapeAttribute(stylesHref),
    NAME: escapeHtml(letter.name),
    CONTACT_LINES: contactLines,
    EMAIL: escapeHtml(letter.email),
    EMAIL_HREF: escapeAttribute(`mailto:${letter.email}`),
    PORTFOLIO: escapeHtml(letter.portfolio.label),
    PORTFOLIO_HREF: escapeAttribute(letter.portfolio.href),
    LINKEDIN: escapeHtml(letter.linkedin.label),
    LINKEDIN_HREF: escapeAttribute(letter.linkedin.href),
    PHONE: escapeHtml(letter.phone),
    LOCATION: escapeHtml(letter.location),
    ROLE: escapeHtml(letter.role),
    COMPANY: escapeHtml(letter.company),
    SALUTATION: escapeHtml(letter.salutation),
    BODY_PARAGRAPHS: body,
    SIGNOFF: escapeHtml(letter.signoff),
  };

  return applyTemplate(template, replacements);
}

function renderContactLines(letter) {
  const lines = [
    `<a href="${escapeAttribute(`mailto:${letter.email}`)}">${escapeHtml(letter.email)}</a>`,
  ];
  if (letter.portfolio.href) {
    lines.push(
      `<a href="${escapeAttribute(letter.portfolio.href)}">${escapeHtml(letter.portfolio.label)}</a>`,
    );
  }
  if (letter.linkedin.href) {
    lines.push(
      `<a href="${escapeAttribute(letter.linkedin.href)}">${escapeHtml(letter.linkedin.label)}</a>`,
    );
  }
  if (letter.phone) lines.push(escapeHtml(letter.phone));
  if (letter.location) lines.push(escapeHtml(letter.location));
  return lines.join("<br />\n              ");
}

function applyTemplate(template, replacements) {
  const found = Array.from(
    String(template).matchAll(/\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g),
    (match) => match[1],
  );
  const foundSet = new Set(found);
  const missing = REQUIRED_TEMPLATE_PLACEHOLDERS.filter(
    (placeholder) => !foundSet.has(placeholder),
  );
  if (missing.length > 0) {
    throw new Error(`HTML template is missing placeholders: ${missing.join(", ")}`);
  }

  const unknown = Array.from(foundSet).filter(
    (placeholder) => !(placeholder in replacements),
  );
  if (unknown.length > 0) {
    throw new Error(`HTML template has unknown placeholders: ${unknown.join(", ")}`);
  }

  const rendered = String(template).replace(
    /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g,
    (_match, placeholder) => replacements[placeholder],
  );
  const unresolved = rendered.match(/\{\{[^{}]+\}\}/g);
  if (unresolved) {
    throw new Error(
      `HTML template has unsupported placeholders: ${[...new Set(unresolved)].join(", ")}`,
    );
  }
  return rendered;
}

function relativeStylesPath(outputPath) {
  const relative = path.relative(
    path.dirname(outputPath),
    path.join(path.dirname(outputPath), "styles.css"),
  );
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function toUrl(value) {
  const normalized = String(value).trim();
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^linkedin\.com\//i.test(normalized)) return `https://www.${normalized}`;
  return `https://${normalized}`;
}

function linkify(html) {
  return html.replace(
    /\b((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[A-Za-z0-9_-]+|[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?:\/[^\s<]*)?)\b/g,
    (value) => {
      const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      return `<a href="${escapeAttribute(href)}">${value}</a>`;
    },
  );
}

function formatInlineText(value) {
  const links = [];
  const tokenPrefix = "__COVER_LINK_";
  const withTokens = String(value).replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_match, text, href) => {
      const token = `${tokenPrefix}${links.length}__`;
      links.push(`<a href="${escapeAttribute(href)}">${escapeHtml(text)}</a>`);
      return token;
    },
  );

  let html = linkify(escapeHtml(withTokens));
  links.forEach((link, index) => {
    html = html.replace(`${tokenPrefix}${index}__`, link);
  });
  return html;
}

async function assertDistinctOutputPath(outputPath, inputs) {
  for (const input of inputs) {
    if (await pathsReferToSameFile(outputPath, input.filePath)) {
      throw new Error(
        `HTML output must differ from the ${input.label}: ${outputPath}`,
      );
    }
  }
}

async function pathsReferToSameFile(leftPath, rightPath) {
  if (path.resolve(leftPath) === path.resolve(rightPath)) return true;

  try {
    const [leftRealPath, rightRealPath] = await Promise.all([
      realpath(leftPath),
      realpath(rightPath),
    ]);
    return leftRealPath === rightRealPath;
  } catch {
    return false;
  }
}

async function atomicWriteFile(outputPath, contents) {
  const temporaryPath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function readOptionalWorkflowState(statePath) {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    validateWorkflowState(state, statePath);
    return state;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error.message.startsWith("Invalid workflow state")) throw error;
    throw new Error(`Invalid workflow state JSON: ${statePath}: ${error.message}`);
  }
}

function validateWorkflowState(state, statePath) {
  if (!isPlainObject(state)) {
    throw new Error(`Invalid workflow state JSON: ${statePath}: root value must be an object`);
  }
  for (const key of ["checks", "coverLetterChecks", "outputs"]) {
    if (state[key] !== undefined && !isPlainObject(state[key])) {
      throw new Error(
        `Invalid workflow state JSON: ${statePath}: ${key} must be an object`,
      );
    }
  }
}

function assertCoverLetterConfirmation(state, statePath) {
  if (!state || !Object.hasOwn(state, "workflowVersion")) return;
  if (state.workflowVersion !== 2) {
    throw new Error(
      `Unsupported workflowVersion in workflow state: ${statePath}. Expected 2.`,
    );
  }
  const confirmation = state.coverLetterChecks?.markdown;
  if (!["confirmed", "waived"].includes(confirmation)) {
    throw new Error(
      `Cover-letter Markdown confirmation is required before rendering. Set workflow-state.json coverLetterChecks.markdown to confirmed or waived: ${statePath}`,
    );
  }
}

async function updateWorkflowStateAfterCoverLetter(
  state,
  statePath,
  inputPath,
  outputPath,
  letter,
) {
  const stateDirectory = path.dirname(inputPath);
  const {
    layout: _staleLayout,
    pdf: _stalePdf,
    pdfPages: _stalePdfPages,
    ...retainedCoverChecks
  } = state.coverLetterChecks || {};
  const {
    coverLetterPdf: _staleCoverLetterPdf,
    ...retainedOutputs
  } = state.outputs || {};
  const nextState = {
    ...state,
    stage: "cover-letter-rendered",
    updatedAt: new Date().toISOString(),
    coverLetterChecks: {
      ...retainedCoverChecks,
      html: "generated",
      bodyWords: letter.bodyWordCount,
      paragraphs: letter.paragraphs.length,
      layout: "pending",
      pdf: "pending",
      pdfPages: null,
    },
    outputs: {
      ...retainedOutputs,
      coverLetterMarkdown: relativeStatePath(stateDirectory, inputPath),
      coverLetterHtml: relativeStatePath(stateDirectory, outputPath),
    },
  };

  await atomicWriteFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function relativeStatePath(stateDirectory, outputPath) {
  return path.relative(stateDirectory, outputPath).split(path.sep).join("/");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
