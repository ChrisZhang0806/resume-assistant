#!/usr/bin/env node

/**
 * CLI Layout Verifier for Resumes and Cover Letters
 * Uses @chenglou/pretext (Canvas-based) to measure exact line wrapping and height.
 * Bypasses headless browser rendering for fast pre-export verification.
 */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "canvas";
import * as cheerio from "cheerio";
import { prepare, layout } from "@chenglou/pretext";

// 1. Mock OffscreenCanvas globally so @chenglou/pretext can run in Node.js
global.OffscreenCanvas = class OffscreenCanvas {
  constructor(width, height) {
    return createCanvas(width, height);
  }
};

// 2. Global Layout Constants (from styles.css)
const PAGE_HEIGHT_BUDGET = 842; // px

const RESUME_WIDTH = 579;
const RESUME_PADDING_X = 40;
const RESUME_PADDING_Y = 32;
const RESUME_CONTENT_WIDTH = RESUME_WIDTH - 2 * RESUME_PADDING_X; // 499px
const RESUME_CONTENT_HEIGHT_BUDGET = PAGE_HEIGHT_BUDGET - 2 * RESUME_PADDING_Y; // 778px

const COVER_WIDTH = 579;
const COVER_PADDING_X = 54;
const COVER_PADDING_Y = 44;
const COVER_CONTENT_WIDTH = COVER_WIDTH - 2 * COVER_PADDING_X; // 471px
const COVER_CONTENT_HEIGHT_BUDGET = PAGE_HEIGHT_BUDGET - 2 * COVER_PADDING_Y; // 754px

const DEFAULT_FONT_FAMILY = '"Avenir Next", Avenir, Arial, sans-serif';
const MEASURE_CANVAS = createCanvas(1, 1);
const MEASURE_CONTEXT = MEASURE_CANVAS.getContext("2d");

main().catch((error) => {
  console.error(`Layout verification failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.htmlPath) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const htmlPath = path.resolve(args.htmlPath);
  await assertFile(htmlPath, "HTML file");

  const html = await readFile(htmlPath, "utf8");
  const $ = cheerio.load(html);
  const cssSources = await loadCssSources($, htmlPath);

  // Check if it's a resume or a cover letter
  const isResume = $(".resume").length > 0;
  const isCoverLetter = $(".cover-letter").length > 0;

  if (!isResume && !isCoverLetter) {
    throw new Error(
      "Could not detect a .resume or .cover-letter container in the HTML file."
    );
  }

  let result;
  if (isResume) {
    result = verifyResume($, args.verbose);
  } else {
    result = verifyCoverLetter($, args.verbose);
  }

  const policyIssues = isResume ? collectResumePolicyIssues($, cssSources, args) : [];
  const { totalHeight, details } = result;
  const pageHeightBudget = PAGE_HEIGHT_BUDGET * args.pages;
  const overflow = totalHeight - pageHeightBudget;

  console.log("\n========================================");
  console.log(`Layout Verification: ${path.basename(htmlPath)}`);
  console.log(`Type: ${isResume ? "Resume" : "Cover Letter"}`);
  console.log(`Template Mode: ${args.templateMode}`);
  console.log(`Page Target: ${args.pages} page(s)`);
  console.log(`Total Height: ${totalHeight.toFixed(1)}px (Budget: ${pageHeightBudget}px)`);
  console.log("========================================");

  if (args.verbose) {
    console.log("\nHeight Breakdown:");
    details.forEach((d) => {
      console.log(`- ${d.name.padEnd(25)}: ${d.height.toFixed(1)}px`);
    });
  }

  if (policyIssues.length > 0) {
    console.warn("\nLayout Policy Issues:");
    policyIssues.forEach((issue) => {
      console.warn(`- ${issue}`);
    });
  }

  if (overflow > 0 || policyIssues.length > 0) {
    if (overflow <= 0) {
      console.warn(
        `\nHEIGHT CHECK PASSED, BUT POLICY CHECK FAILED: Remaining space: ${Math.abs(overflow).toFixed(1)}px.`,
      );
      process.exit(1);
    }

    console.warn(`\nOVERFLOW WARNING: Exceeded ${args.pages}-page limit by ${overflow.toFixed(1)}px.`);
    const linesOver = Math.ceil(overflow / 14);
    console.warn(
      `   Approximately ${linesOver} line(s) of text exceed the configured A4 page budget.`
    );
    console.warn(
      `   Action required: Trim/shorten bullet points, compress summary, or reduce wordings.`
    );
    process.exit(1);
  } else {
    console.log(`\nFIT CHECK PASSED: Content fits within ${args.pages} page(s). Remaining space: ${Math.abs(overflow).toFixed(1)}px.`);
    process.exit(0);
  }
}

async function loadCssSources($, htmlPath) {
  const cssSources = [];
  const htmlDir = path.dirname(htmlPath);

  $("link[rel~='stylesheet']").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href || /^https?:\/\//i.test(href)) return;

    const hrefWithoutHash = href.split("#")[0].split("?")[0];
    if (!hrefWithoutHash) return;

    cssSources.push({
      label: href,
      path: path.resolve(htmlDir, hrefWithoutHash),
      inline: false,
      text: "",
    });
  });

  $("style").each((index, el) => {
    cssSources.push({
      label: `<style> block ${index + 1}`,
      path: "",
      inline: true,
      text: $(el).html() || "",
    });
  });

  for (const source of cssSources) {
    if (source.inline) continue;
    try {
      source.text = await readFile(source.path, "utf8");
    } catch {
      source.text = "";
    }
  }

  return cssSources;
}

function parseArgs(argv) {
  const args = {
    htmlPath: "",
    verbose: false,
    help: false,
    pages: 1,
    templateMode: "default",
    allowedGaps: ["2px", "4px"],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--verbose" || arg === "-v") {
      args.verbose = true;
    } else if (arg === "--custom-template") {
      args.templateMode = "custom";
    } else if (arg === "--pages" || arg === "--max-pages") {
      const next = argv[index + 1];
      if (!next || next.startsWith("-")) {
        throw new Error(`${arg} requires a positive integer.`);
      }
      args.pages = parsePositiveInteger(next, arg);
      index += 1;
    } else if (arg.startsWith("--pages=")) {
      args.pages = parsePositiveInteger(arg.slice("--pages=".length), "--pages");
    } else if (arg.startsWith("--max-pages=")) {
      args.pages = parsePositiveInteger(arg.slice("--max-pages=".length), "--max-pages");
    } else if (arg === "--template-mode") {
      const next = argv[index + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("--template-mode requires default or custom.");
      }
      args.templateMode = parseTemplateMode(next);
      index += 1;
    } else if (arg.startsWith("--template-mode=")) {
      args.templateMode = parseTemplateMode(arg.slice("--template-mode=".length));
    } else if (arg === "--allowed-gaps") {
      const next = argv[index + 1];
      if (!next || next.startsWith("-")) {
        throw new Error("--allowed-gaps requires a comma-separated list such as 2px,4px.");
      }
      args.allowedGaps = parseAllowedGaps(next);
      index += 1;
    } else if (arg.startsWith("--allowed-gaps=")) {
      args.allowedGaps = parseAllowedGaps(arg.slice("--allowed-gaps=".length));
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.htmlPath) {
      args.htmlPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return args;
}

function parsePositiveInteger(value, optionName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || String(parsed) !== String(value).trim()) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  return parsed;
}

function parseTemplateMode(value) {
  if (value === "default" || value === "custom") return value;
  throw new Error("--template-mode must be default or custom.");
}

function parseAllowedGaps(value) {
  const gaps = String(value)
    .split(/[,\s]+/)
    .map(normalizeLength)
    .filter(Boolean);

  if (gaps.length === 0) {
    throw new Error("--allowed-gaps requires at least one CSS length.");
  }

  return gaps;
}

function printHelp() {
  console.log(`Usage:
  node scripts/verify-layout.mjs <target-file.html> [options]

Options:
  --verbose, -v      Print a detailed height breakdown of each section
  --pages <number>   Set the A4 page target. Defaults to 1
  --template-mode    default or custom. Defaults to default
  --custom-template  Alias for --template-mode custom
  --allowed-gaps     Comma-separated default-template gap values. Defaults to 2px,4px
  --help, -h         Show this help message

Examples:
  node scripts/verify-layout.mjs base/index.html -v
  node scripts/verify-layout.mjs applications/2026-06-14-amd-ux-ui-designer/resume.html -v --pages 2 --custom-template
  node scripts/verify-layout.mjs applications/2026-06-14-amd-ux-ui-designer/resume.html -v --allowed-gaps 2px,4px
  node scripts/verify-layout.mjs applications/2026-06-14-amd-ux-ui-designer/resume.html
`);
}

async function assertFile(filePath, label) {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size === 0) {
      throw new Error();
    }
  } catch {
    throw new Error(`${label} not found or empty: ${filePath}`);
  }
}

/**
 * Measures the height of text using pretext with the specified parameters
 */
function getTextHeight(text, width, fontSize, lineHeight, weight = "normal") {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText) return 0;

  const weightPrefix = weight === "normal" || weight === 400 ? "" : `${weight} `;
  const fontSpec = `${weightPrefix}${fontSize}px ${DEFAULT_FONT_FAMILY}`;

  try {
    const handle = prepare(normalizedText, fontSpec);
    const result = layout(handle, width, lineHeight);
    return result.height;
  } catch (err) {
    // Fallback calculation in case of canvas issues
    const charsPerLine = Math.floor(width / (fontSize * 0.5));
    const lines = Math.ceil(normalizedText.length / charsPerLine) || 1;
    return lines * lineHeight;
  }
}

function getTextWidth(text, fontSize, weight = "normal") {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return 0;

  const weightPrefix = weight === "normal" || weight === 400 ? "" : `${weight} `;
  MEASURE_CONTEXT.font = `${weightPrefix}${fontSize}px ${DEFAULT_FONT_FAMILY}`;
  return MEASURE_CONTEXT.measureText(normalizedText).width;
}

function collectResumePolicyIssues($, cssSources, args) {
  const issues = [];

  issues.push(...collectCssPolicyIssues(cssSources, args.templateMode, args.allowedGaps));
  issues.push(...collectContactRowIssues($, cssSources));

  return issues;
}

function collectContactRowIssues($, cssSources) {
  const issues = [];
  const $contact = $("header.resume-header .contact-list");
  if ($contact.length === 0) return issues;
  const contactStyle = getContactRowMeasurementStyle(cssSources);

  const items = $contact
    .find("> li")
    .map((_, el) => ({
      text: normalizeText($(el).text()),
      labelText: normalizeText($(el).find(".contact-label").text()),
    }))
    .get()
    .filter((item) => item.text);

  const totalTextWidth = items.reduce(
    (sum, item) => sum + getContactItemTextWidth(item, contactStyle),
    0,
  );
  const totalGapWidth = Math.max(0, items.length - 1) * contactStyle.itemGap;
  const totalWidth = totalTextWidth + totalGapWidth;

  if (totalWidth > RESUME_CONTENT_WIDTH) {
    issues.push(
      `Contact row is ${totalWidth.toFixed(1)}px wide but only ${RESUME_CONTENT_WIDTH}px is available. Keep it on one line by shortening visible text, especially LinkedIn, while preserving href targets.`,
    );
  }

  for (const { label, text } of cssSources) {
    for (const rule of findCssRules(text)) {
      if (!selectorHas(rule.selector, "contact-list")) continue;

      const flexWrap = getDeclaration(rule.declarations, "flex-wrap");
      const whiteSpace = getDeclaration(rule.declarations, "white-space");

      if (flexWrap && !/^nowrap\b/i.test(flexWrap)) {
        issues.push(
          `${label}: .contact-list must use flex-wrap: nowrap so contact information stays on one line.`,
        );
      }

      if (whiteSpace && !/^nowrap\b/i.test(whiteSpace)) {
        issues.push(
          `${label}: .contact-list must use white-space: nowrap so contact information stays on one line.`,
        );
      }
    }
  }

  return issues;
}

function getContactItemTextWidth(item, contactStyle) {
  const baseWidth = getTextWidth(item.text, contactStyle.fontSize, "normal");
  if (!item.labelText) return baseWidth;

  const labelNormalWidth = getTextWidth(item.labelText, contactStyle.fontSize, "normal");
  const labelActualWidth = getTextWidth(
    item.labelText,
    contactStyle.fontSize,
    contactStyle.labelWeight,
  );

  return baseWidth + labelActualWidth - labelNormalWidth;
}

function getContactRowMeasurementStyle(cssSources) {
  const style = {
    fontSize: 10,
    itemGap: 14,
    labelWeight: 500,
  };

  for (const { text } of cssSources) {
    for (const rule of findCssRules(text)) {
      if (selectorIsExactContactList(rule.selector)) {
        const fontSize = parsePxLength(getDeclaration(rule.declarations, "font-size"));
        const gap = parsePxLength(getDeclaration(rule.declarations, "gap"));
        if (fontSize !== null) style.fontSize = fontSize;
        if (gap !== null) style.itemGap = gap;
      }

      if (selectorIsContactListSiblingItem(rule.selector)) {
        const marginLeft = parsePxLength(getDeclaration(rule.declarations, "margin-left"));
        if (marginLeft !== null) style.itemGap = marginLeft;
      }

      if (selectorIsExactContactLabel(rule.selector)) {
        const fontWeight = parseFontWeight(getDeclaration(rule.declarations, "font-weight"));
        if (fontWeight !== null) style.labelWeight = fontWeight;
      }
    }
  }

  return style;
}

function collectCssPolicyIssues(cssSources, templateMode = "default", allowedGaps = ["2px", "4px"]) {
  const issues = [];
  const defaultTemplateMode = templateMode === "default";

  for (const source of cssSources) {
    const label = source.label || "CSS";
    const css = stripCssComments(source.text || "");

    if (defaultTemplateMode && source.inline && css.trim()) {
      issues.push(
        `${label}: inline <style> blocks are not allowed for target resume layout. Edit the application folder's styles.css copy instead.`,
      );
    }

    if (/@media\s+print[\s\S]*height\s*:\s*842px[\s\S]*overflow\s*:\s*hidden/i.test(css)) {
      issues.push(
        `${label}: do not combine @media print height: 842px with overflow: hidden; it clips bottom padding/content instead of proving the configured page fit.`,
      );
    }

    for (const rule of findCssRules(css)) {
      const selector = rule.selector;
      const declarations = rule.declarations;

      if (selectorIsResume(selector)) {
        const padding = getDeclaration(declarations, "padding");
        const paddingLeft = getDeclaration(declarations, "padding-left");
        const paddingRight = getDeclaration(declarations, "padding-right");
        const height = getDeclaration(declarations, "height");
        const overflow = getDeclaration(declarations, "overflow");

        if (defaultTemplateMode && padding && !resumeSidePaddingIsValid(padding)) {
          issues.push(
            `${label}: .resume side padding must remain 40px; found padding: ${padding}.`,
          );
        }

        if (defaultTemplateMode && paddingLeft && normalizeLength(paddingLeft) !== "40px") {
          issues.push(`${label}: .resume padding-left must remain 40px; found ${paddingLeft}.`);
        }

        if (defaultTemplateMode && paddingRight && normalizeLength(paddingRight) !== "40px") {
          issues.push(`${label}: .resume padding-right must remain 40px; found ${paddingRight}.`);
        }

        if (/^hidden\b/i.test(overflow)) {
          issues.push(
            `${label}: .resume must not use overflow: hidden; it can conceal overflow instead of proving the configured page fit.`,
          );
        }

        if (/^842px$/i.test(normalizeLength(height)) && /^hidden\b/i.test(overflow)) {
          issues.push(
            `${label}: .resume must not use height: 842px with overflow: hidden; use verification and content compression instead of clipping.`,
          );
        }
      }

      if (defaultTemplateMode && selectorUsesVerticalSpacing(selector)) {
        for (const property of ["margin-top", "margin-bottom"]) {
          const value = getDeclaration(declarations, property);
          if (value && !isZeroLength(value)) {
            issues.push(
              `${label}: ${selector.trim()} must not use ${property}: ${value}; use existing flex gap controls only.`,
            );
          }
        }
      }

      if (defaultTemplateMode && selectorUsesOptimizedGap(selector)) {
        const gap = getDeclaration(declarations, "gap");
        if (gap && !gapValueIsAllowed(gap, allowedGaps)) {
          issues.push(
            `${label}: ${selector.trim()} uses gap: ${gap}; target resume optimization gaps must be exactly ${formatAllowedGaps(allowedGaps)}.`,
          );
        }
      }
    }
  }

  return issues;
}

function findCssRules(css) {
  const rules = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = rulePattern.exec(css))) {
    const selector = match[1].trim();
    if (!selector || selector.startsWith("@")) continue;

    rules.push({
      selector,
      declarations: match[2].trim(),
    });
  }

  return rules;
}

function getDeclaration(declarations, property) {
  const pattern = new RegExp(`(?:^|;)\\s*${escapeRegExp(property)}\\s*:\\s*([^;]+)`, "i");
  const match = declarations.match(pattern);
  return match ? match[1].trim() : "";
}

function selectorHas(selector, className) {
  return new RegExp(`(^|[\\s,>+~])\\.${escapeRegExp(className)}([\\s,.#:>+~]|$)`).test(selector);
}

function selectorIsExactContactList(selector) {
  return selector
    .split(",")
    .map((part) => part.trim())
    .some((part) => part === ".contact-list");
}

function selectorIsContactListSiblingItem(selector) {
  return selector
    .split(",")
    .map((part) => part.trim())
    .some((part) => /^\.contact-list\s+li\s*\+\s*li$/.test(part));
}

function selectorIsExactContactLabel(selector) {
  return selector
    .split(",")
    .map((part) => part.trim())
    .some((part) => part === ".contact-label");
}

function selectorIsResume(selector) {
  return /(^|,)\s*\.resume([#.:,\s>+~]|$)/.test(selector);
}

function selectorUsesVerticalSpacing(selector) {
  return /(^|,)\s*(\.section(?:[-\w]*)?|\.entry|\.skill-group|ul)([#.:,\s>+~]|$)/.test(selector);
}

function selectorUsesOptimizedGap(selector) {
  return /(^|,)\s*(\.section(?:[-\w]*)?|\.entry|\.skill-group)([#.:,\s>+~]|$)/.test(selector);
}

function resumeSidePaddingIsValid(value) {
  const parts = value.split(/\s+/).map(normalizeLength).filter(Boolean);
  if (parts.length === 0) return false;

  const right = parts.length === 1 ? parts[0] : parts[1];
  const left = parts.length <= 2 ? right : parts[3] || parts[1];

  return right === "40px" && left === "40px";
}

function gapValueIsAllowed(value, allowedGaps = ["2px", "4px"]) {
  const parts = value.split(/\s+/).map(normalizeLength).filter(Boolean);
  const allowed = new Set(allowedGaps.map(normalizeLength));
  return parts.length > 0 && parts.every((part) => allowed.has(part));
}

function formatAllowedGaps(allowedGaps) {
  return allowedGaps.map(normalizeLength).join(" or ");
}

function isZeroLength(value) {
  const normalized = normalizeLength(value);
  return normalized === "0" || normalized === "0px" || normalized === "0rem" || normalized === "0em";
}

function normalizeLength(value = "") {
  return String(value)
    .trim()
    .replace(/!important$/i, "")
    .trim()
    .toLowerCase();
}

function parsePxLength(value = "") {
  const normalized = normalizeLength(value);
  if (normalized === "0") return 0;
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)px$/);
  return match ? Number.parseFloat(match[1]) : null;
}

function parseFontWeight(value = "") {
  const normalized = normalizeLength(value);
  if (normalized === "normal") return "normal";
  if (normalized === "bold") return 700;

  const parsed = Number.parseInt(normalized, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Verify Resume Height (.resume)
 */
function verifyResume($, verbose) {
  const details = [];

  // 1. Padding
  let currentHeight = RESUME_PADDING_Y * 2;
  details.push({ name: "Page Padding (Top+Bottom)", height: RESUME_PADDING_Y * 2 });

  // 2. Resume Gap
  // Elements: header.resume-header, section.summary, div.resume-body (if they exist)
  const topElements = $(".resume > header.resume-header, .resume > section.summary, .resume > div.resume-body");
  const topGaps = Math.max(0, topElements.length - 1) * 8;
  currentHeight += topGaps;
  if (topGaps > 0) {
    details.push({ name: "Main Flex Gaps (gap: 8px)", height: topGaps });
  }

  // 3. Header height
  const $header = $("header.resume-header");
  if ($header.length > 0) {
    let headerHeight = 0;

    // h1 (Name)
    const h1Text = $header.find("h1").text() || "";
    const h1Height = getTextHeight(h1Text, RESUME_CONTENT_WIDTH, 28, 38, 500); // 28px, Chrome normal line-height
    headerHeight += h1Height;

    // role
    const $role = $header.find(".role");
    if ($role.length > 0) {
      headerHeight += 4; // margin-top: 4px
      const roleHeight = getTextHeight($role.text(), RESUME_CONTENT_WIDTH, 16, 22, 500); // 16px, Chrome normal line-height
      headerHeight += roleHeight;
    }

    // contact-list
    const $contact = $header.find(".contact-list");
    if ($contact.length > 0) {
      headerHeight += 8; // margin-top: 8px
      // contact list is display: flex, justify-content: space-between on desktop (1 line)
      headerHeight += 14; // font-size: 10px, line-height: 14px
    }

    currentHeight += headerHeight;
    details.push({ name: "Header Section", height: headerHeight });
  }

  // 4. Summary height
  const $summary = $("section.summary");
  if ($summary.length > 0) {
    let summaryHeight = 16; // padding: 8px on all sides (top+bottom = 16px)
    const summaryInnerWidth = RESUME_CONTENT_WIDTH - 16; // padding-left/right: 8px

    $summary.find("p").each((i, el) => {
      const pText = $(el).text() || "";
      const pHeight = getTextHeight(pText, summaryInnerWidth, 10, 14, "normal");
      summaryHeight += pHeight;
    });

    currentHeight += summaryHeight;
    details.push({ name: "Summary Section", height: summaryHeight });
  }

  // 5. Resume Body sections
  const $body = $(".resume-body");
  if ($body.length > 0) {
    const $sections = $body.find("> section.section");

    // Body Flex Gaps (gap: 8px)
    const bodyGaps = Math.max(0, $sections.length - 1) * 8;
    currentHeight += bodyGaps;
    if (bodyGaps > 0) {
      details.push({ name: "Body Section Gaps (gap: 8px)", height: bodyGaps });
    }

    // Process each section
    $sections.each((sIdx, secEl) => {
      const $sec = $(secEl);
      const isEdu = $sec.hasClass("section-education");
      const isSkills = $sec.hasClass("section-skills");
      const isCert = $sec.hasClass("section-certification");
      const secGap = (isEdu || isSkills || isCert) ? 2 : 4; // gap: 2px or 4px

      let secHeight = 0;

      // Section Title (h2)
      const h2Text = $sec.find("> h2").text() || "";
      const h2Height = getTextHeight(h2Text, RESUME_CONTENT_WIDTH, 10, 14, 700); // 10px, Chrome normal line-height
      secHeight += h2Height;

      // Children inside section (e.g. .entry, .skill-group, p)
      const $children = $sec.find("> .entry, > .skill-group, > p").filter((i, el) => {
        // filter out children of sub-elements to avoid double counting
        return $(el).parent().is($sec);
      });

      // Gaps between entries
      const childrenGaps = Math.max(0, $children.length - 1) * secGap;
      secHeight += childrenGaps;

      // Process children
      $children.each((cIdx, childEl) => {
        const $child = $(childEl);

        if ($child.hasClass("entry")) {
          // Entry structure
          let entryHeight = 0;

          // Gap inside entry: gap: 2px
          const entryComponents = $child.find("> .entry-heading, > h3, > .entry-meta, > ul");
          const entryGaps = Math.max(0, entryComponents.length - 1) * 2;
          entryHeight += entryGaps;

          // heading
          const $heading = $child.find("> .entry-heading");
          if ($heading.length > 0) {
            const h3Text = $heading.find("h3").text() || "";
            // Available width: title occupies most of width, assume location takes ~80px max
            const titleWidth = RESUME_CONTENT_WIDTH - 96;
            const h3Height = getTextHeight(h3Text, titleWidth, 14, 19, 500); // 14px, Chrome normal line-height
            entryHeight += h3Height;
          }

          // direct h3 used by compact entries such as Education
          const $directTitle = $child.find("> h3");
          if ($directTitle.length > 0) {
            const h3Text = $directTitle.text() || "";
            const h3Height = getTextHeight(h3Text, RESUME_CONTENT_WIDTH, 14, 19, 500); // 14px, Chrome normal line-height
            entryHeight += h3Height;
          }

          // meta
          const $meta = $child.find("> .entry-meta");
          if ($meta.length > 0) {
            const titleText = $meta.find("p:first-child").text() || "";
            // available width for title is total width minus ~120px for date
            const metaTitleWidth = RESUME_CONTENT_WIDTH - 136;
            const metaTitleHeight = getTextHeight(titleText, metaTitleWidth, 12, 15.6, "normal"); // 12px, line-height 1.302
            entryHeight += metaTitleHeight;
          }

          // list (ul > li)
          const $ul = $child.find("> ul");
          if ($ul.length > 0) {
            const listWidth = RESUME_CONTENT_WIDTH - 15; // padding-left: 15px
            let listHeight = 0;
            $ul.find("> li").each((lIdx, liEl) => {
              const liText = $(liEl).text() || "";
              const liHeight = getTextHeight(liText, listWidth, 10, 14, "normal");
              listHeight += liHeight;
            });
            entryHeight += listHeight;
          }

          secHeight += entryHeight;

        } else if ($child.hasClass("skill-group")) {
          // Skill Group structure
          let groupHeight = 2; // gap: 2px

          const h3Text = $child.find("h3").text() || "";
          const h3Height = getTextHeight(h3Text, RESUME_CONTENT_WIDTH, 14, 19, 500); // 14px, Chrome normal line-height

          const pText = $child.find("p").text() || "";
          const pHeight = getTextHeight(pText, RESUME_CONTENT_WIDTH, 10, 14, "normal"); // 10px

          groupHeight += h3Height + pHeight;
          secHeight += groupHeight;

        } else if (isCert) {
          // Certification paragraph
          const pText = $child.text() || "";
          const pHeight = getTextHeight(pText, RESUME_CONTENT_WIDTH, 14, 19, 500); // 14px, Chrome normal line-height
          secHeight += pHeight;
        } else {
          // generic fallback paragraph
          const pText = $child.text() || "";
          const pHeight = getTextHeight(pText, RESUME_CONTENT_WIDTH, 10, 14, "normal");
          secHeight += pHeight;
        }
      });

      // add section title to children gap
      secHeight += secGap;

      currentHeight += secHeight;
      const sectionName = h2Text || `Section ${sIdx + 1}`;
      details.push({ name: `Section: ${sectionName}`, height: secHeight });
    });
  }

  return { totalHeight: currentHeight, budget: PAGE_HEIGHT_BUDGET, details };
}

/**
 * Verify Cover Letter Height (.cover-letter)
 */
function verifyCoverLetter($, verbose) {
  const details = [];

  // 1. Padding
  let currentHeight = COVER_PADDING_Y * 2;
  details.push({ name: "Page Padding (Top+Bottom)", height: COVER_PADDING_Y * 2 });

  // 2. Header Section
  const $header = $(".cover-letter-header");
  let headerHeight = 104; // default min-height: 104px

  if ($header.length > 0) {
    const $contact = $header.find(".cover-contact");
    if ($contact.length > 0) {
      const h1Text = $contact.find("h1").text() || "";
      const h1Height = getTextHeight(h1Text, 210, 11, 15, 700); // max-width: 210px

      // Calculate <p> lines height (split by <br />)
      const pHtml = $contact.find("p").html() || "";
      const lines = pHtml.split(/<br\s*\/?>/gi).map(line => line.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
      const pHeight = lines.length * 15; // line-height: 15px

      const calculatedContactHeight = h1Height + 4 + pHeight; // margin-top: 4px
      headerHeight = Math.max(104, calculatedContactHeight);
    }
  }
  currentHeight += headerHeight;
  details.push({ name: "Header Section (min-height)", height: headerHeight });

  // 3. Margin top to body
  currentHeight += 22; // .cover-letter-body { margin-top: 22px; }
  details.push({ name: "Header-to-Body Margin", height: 22 });

  // 4. Body Content
  const $body = $(".cover-letter-body");
  if ($body.length > 0) {
    let bodyHeight = 0;

    // h2 (Application for position...)
    const $h2 = $body.find("> h2");
    if ($h2.length > 0) {
      const h2Text = $h2.text() || "";
      const h2Height = getTextHeight(h2Text, COVER_CONTENT_WIDTH, 13, 17, 700); // 13px, line-height: 17px
      bodyHeight += h2Height;
    }

    // Children: paragraphs <p> and lists <ul>
    const $children = $body.find("> p, > ul, > .cover-signoff");

    $children.each((i, el) => {
      const $child = $(el);

      if ($child.hasClass("cover-signoff")) {
        // Signoff block
        let signoffHeight = 16; // margin-top: 16px
        const $signoffPs = $child.find("> p");

        $signoffPs.each((idx, pEl) => {
          const pText = $(pEl).text() || "";
          const pHeight = getTextHeight(pText, COVER_CONTENT_WIDTH, 11, 16, "normal");
          signoffHeight += pHeight;
          if (idx > 0) {
            signoffHeight += 4; // .cover-signoff p + p { margin-top: 4px; }
          }
        });

        bodyHeight += signoffHeight;

      } else if (el.name === "p") {
        // Body Paragraph
        const pText = $child.text() || "";
        const pHeight = getTextHeight(pText, COVER_CONTENT_WIDTH, 11, 16, "normal"); // 11px, line-height: 16px
        bodyHeight += pHeight + 14; // margin-top: 14px

      } else if (el.name === "ul") {
        // Bullet List
        let listHeight = 14; // margin-top: 14px
        const listWidth = COVER_CONTENT_WIDTH - 18; // padding-left: 18px
        const $lis = $child.find("> li");

        $lis.each((idx, liEl) => {
          const liText = $(liEl).text() || "";
          const liHeight = getTextHeight(liText, listWidth, 11, 16, "normal");
          listHeight += liHeight;
          if (idx > 0) {
            listHeight += 10; // li + li { margin-top: 10px; }
          }
        });

        bodyHeight += listHeight;
      }
    });

    currentHeight += bodyHeight;
    details.push({ name: "Letter Body Section", height: bodyHeight });
  }

  return { totalHeight: currentHeight, budget: PAGE_HEIGHT_BUDGET, details };
}
