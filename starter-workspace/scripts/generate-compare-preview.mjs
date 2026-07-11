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
const SECTION_ORDER = [
  "Header",
  "Summary",
  "Personal Project",
  "Selected Project",
  "Selected Product",
  "Projects",
  "Experience",
  "Education",
  "Skills",
  "Certification",
];

main().catch((error) => {
  console.error(`Compare preview generation failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.targetPath) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const basePath = path.resolve(args.basePath || "base/index.html");
  const targetPath = path.resolve(args.targetPath);
  const outputPath = path.resolve(
    args.outputPath || path.join(path.dirname(targetPath), "compare.html"),
  );
  const statePath = path.join(path.dirname(targetPath), "workflow-state.json");

  await assertFile(basePath, "Base resume HTML");
  await assertFile(targetPath, "Target resume HTML");
  const workflowState = await readOptionalWorkflowState(statePath);
  await assertDistinctOutputPath(outputPath, [
    { filePath: basePath, label: "base resume" },
    { filePath: targetPath, label: "target resume" },
    { filePath: statePath, label: "workflow state" },
  ]);
  await mkdir(path.dirname(outputPath), { recursive: true });

  const [baseHtml, targetHtml] = await Promise.all([
    readFile(basePath, "utf8"),
    readFile(targetPath, "utf8"),
  ]);

  const model = buildCompareModel({
    baseHtml,
    targetHtml,
    basePath,
    targetPath,
    outputPath,
  });

  await atomicWriteFile(outputPath, renderComparePage(model));
  if (workflowState) {
    await updateWorkflowStateAfterCompare(
      workflowState,
      statePath,
      targetPath,
      outputPath,
    );
  }
  console.log(`Created ${path.relative(process.cwd(), outputPath)}`);
}

function parseArgs(argv) {
  const args = {
    basePath: "",
    targetPath: "",
    outputPath: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--base=")) {
      args.basePath = arg.slice("--base=".length);
    } else if (arg === "--base") {
      args.basePath = argv[++index] || "";
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--output" || arg === "-o") {
      args.outputPath = argv[++index] || "";
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.targetPath) {
      args.targetPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/generate-compare-preview.mjs <target-resume.html> [options]

Options:
  --base FILE            Base resume HTML. Defaults to base/index.html.
  --output, -o FILE      Compare preview output. Defaults to compare.html beside target.
  --help, -h             Show this help.

Examples:
  node scripts/generate-compare-preview.mjs applications/2026-06-14-amd-ux-ui-designer/resume.html
  node scripts/generate-compare-preview.mjs resume.html --base base/index.html --output compare.html
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

function buildCompareModel({ baseHtml, targetHtml, basePath, targetPath, outputPath }) {
  const baseSections = extractResumeSections(baseHtml);
  const targetSections = extractResumeSections(targetHtml);
  const sectionNames = orderSectionNames([
    ...Object.keys(baseSections),
    ...Object.keys(targetSections),
  ]);
  const sections = sectionNames.map((name) => {
    const baseLines = baseSections[name] || [];
    const targetLines = targetSections[name] || [];
    const diff = diffLines(baseLines, targetLines);

    return {
      name,
      baseLines,
      targetLines,
      diff,
      added: diff.filter((line) => line.type === "added").length,
      removed: diff.filter((line) => line.type === "removed").length,
      unchanged: diff.filter((line) => line.type === "unchanged").length,
    };
  }).filter((section) => {
    return section.baseLines.length > 0 || section.targetLines.length > 0;
  });

  return {
    title: `Resume Compare - ${path.basename(targetPath)}`,
    generatedAt: new Date().toISOString(),
    baseLabel: path.basename(basePath),
    targetLabel: path.basename(targetPath),
    baseHref: relativeHref(outputPath, basePath),
    targetHref: relativeHref(outputPath, targetPath),
    sections,
    totals: {
      added: sections.reduce((sum, section) => sum + section.added, 0),
      removed: sections.reduce((sum, section) => sum + section.removed, 0),
      unchanged: sections.reduce((sum, section) => sum + section.unchanged, 0),
    },
  };
}

function orderSectionNames(names) {
  const uniqueNames = Array.from(new Set(names));
  const preferredOrder = new Map(
    SECTION_ORDER.map((name, index) => [name, index]),
  );

  return uniqueNames
    .map((name, discoveryIndex) => ({
      name,
      discoveryIndex,
      orderIndex: preferredOrder.get(name) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => {
      return (
        left.orderIndex - right.orderIndex ||
        left.discoveryIndex - right.discoveryIndex
      );
    })
    .map(({ name }) => name);
}

async function assertDistinctOutputPath(outputPath, inputs) {
  for (const input of inputs) {
    if (await pathsReferToSameFile(outputPath, input.filePath)) {
      throw new Error(
        `Compare output must differ from the ${input.label}: ${outputPath}`,
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
  for (const key of ["decisions", "checks", "outputs"]) {
    if (state[key] !== undefined && !isPlainObject(state[key])) {
      throw new Error(
        `Invalid workflow state JSON: ${statePath}: ${key} must be an object`,
      );
    }
  }
}

async function updateWorkflowStateAfterCompare(
  state,
  statePath,
  targetPath,
  outputPath,
) {
  const stateDirectory = path.dirname(targetPath);
  const nextState = {
    ...state,
    updatedAt: new Date().toISOString(),
    decisions: {
      ...(state.decisions || {}),
      compare: "generated",
    },
    checks: {
      ...(state.checks || {}),
      compare: "passed",
    },
    outputs: {
      ...(state.outputs || {}),
      compare: relativeStatePath(stateDirectory, outputPath),
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

function extractResumeSections(html) {
  const normalized = html.replace(/\r/g, "");
  const sections = {
    Header: extractHeader(normalized),
    Summary: extractSummary(normalized),
  };

  const sectionRegex =
    /<section\b[^>]*class="[^"]*\bsection\b[^"]*"[^>]*>([\s\S]*?)<\/section>/gi;
  let match;

  while ((match = sectionRegex.exec(normalized))) {
    const sectionHtml = match[0];
    const heading = htmlToText(sectionHtml.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/i)?.[0] || "");

    if (!heading || heading.toLowerCase() === "summary") {
      continue;
    }

    sections[toTitleCase(heading)] = extractSectionLines(sectionHtml);
  }

  return sections;
}

function extractHeader(html) {
  const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] || "";
  const lines = [];
  const name = htmlToText(header.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0] || "");
  const role = htmlToText(header.match(/<p\b[^>]*class="[^"]*\brole\b[^"]*"[^>]*>[\s\S]*?<\/p>/i)?.[0] || "");
  const contacts = Array.from(header.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match) => htmlToText(match[0]))
    .filter(Boolean);

  if (name) lines.push(`Name: ${name}`);
  if (role) lines.push(`Role: ${role}`);
  contacts.forEach((contact) => lines.push(contact));

  return lines;
}

function extractSummary(html) {
  const summary = html.match(/<section\b[^>]*class="[^"]*\bsummary\b[^"]*"[^>]*>[\s\S]*?<\/section>/i)?.[0] || "";
  return extractParagraphLines(summary);
}

function extractSectionLines(sectionHtml) {
  const lines = [];
  const sectionTitle = htmlToText(sectionHtml.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/i)?.[0] || "");
  const sectionBody = sectionHtml.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, "");
  const entryMatches = Array.from(sectionBody.matchAll(/<div\b[^>]*class="[^"]*\bentry\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div\b[^>]*class="[^"]*\bentry\b|<\/section>)/gi));

  if (entryMatches.length > 0) {
    entryMatches.forEach((match) => {
      lines.push(...extractEntryLines(match[0]));
    });
    return compactLines(lines);
  }

  const skillMatches = Array.from(sectionBody.matchAll(/<div\b[^>]*class="[^"]*\bskill-group\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi));
  if (skillMatches.length > 0) {
    skillMatches.forEach((match) => {
      const title = htmlToText(match[0].match(/<h3\b[^>]*>[\s\S]*?<\/h3>/i)?.[0] || "");
      const content = htmlToText(match[0].match(/<p\b[^>]*>[\s\S]*?<\/p>/i)?.[0] || "");
      if (title || content) {
        lines.push([title, content].filter(Boolean).join(": "));
      }
    });
    return compactLines(lines);
  }

  const paragraphLines = extractParagraphLines(sectionBody);
  return compactLines(sectionTitle ? paragraphLines : paragraphLines);
}

function extractEntryLines(entryHtml) {
  const title = htmlToText(entryHtml.match(/<h3\b[^>]*>[\s\S]*?<\/h3>/i)?.[0] || "");
  const headingText = htmlToText(entryHtml.match(/<div\b[^>]*class="[^"]*\bentry-heading\b[^"]*"[^>]*>[\s\S]*?<\/div>/i)?.[0] || "");
  const metaText = htmlToText(entryHtml.match(/<div\b[^>]*class="[^"]*\bentry-meta\b[^"]*"[^>]*>[\s\S]*?<\/div>/i)?.[0] || "");
  const bullets = Array.from(entryHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match) => `- ${htmlToText(match[0])}`)
    .filter(Boolean);
  const lines = [];

  if (title) {
    lines.push(title);
  } else if (headingText) {
    lines.push(headingText);
  }

  if (metaText) {
    lines.push(metaText);
  }

  lines.push(...bullets);
  return compactLines(lines);
}

function extractParagraphLines(html) {
  const paragraphMatches = Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi));
  if (paragraphMatches.length === 0) {
    const text = htmlToText(html);
    return text ? [text] : [];
  }

  return compactLines(paragraphMatches.map((match) => htmlToText(match[0])));
}

function diffLines(baseLines, targetLines) {
  const matrix = Array.from({ length: baseLines.length + 1 }, () =>
    Array(targetLines.length + 1).fill(0),
  );

  for (let i = baseLines.length - 1; i >= 0; i -= 1) {
    for (let j = targetLines.length - 1; j >= 0; j -= 1) {
      if (normalizeForDiff(baseLines[i]) === normalizeForDiff(targetLines[j])) {
        matrix[i][j] = matrix[i + 1][j + 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
  }

  const diff = [];
  let i = 0;
  let j = 0;

  while (i < baseLines.length && j < targetLines.length) {
    if (normalizeForDiff(baseLines[i]) === normalizeForDiff(targetLines[j])) {
      diff.push({ type: "unchanged", text: targetLines[j] });
      i += 1;
      j += 1;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      diff.push({ type: "removed", text: baseLines[i] });
      i += 1;
    } else {
      diff.push({ type: "added", text: targetLines[j] });
      j += 1;
    }
  }

  while (i < baseLines.length) {
    diff.push({ type: "removed", text: baseLines[i] });
    i += 1;
  }

  while (j < targetLines.length) {
    diff.push({ type: "added", text: targetLines[j] });
    j += 1;
  }

  return diff;
}

function renderComparePage(model) {
  const dataJson = JSON.stringify(model).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(model.title)}</title>
    <style>
      :root {
        --bg: #f3f4f6;
        --panel: #ffffff;
        --text: #1f2937;
        --muted: #64748b;
        --border: #d8dee9;
        --blue: #0088ff;
        --green-bg: #e9f8ef;
        --green-border: #7ccf95;
        --red-bg: #fff0f0;
        --red-border: #f19a9a;
        --gray-bg: #f8fafc;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Avenir, "Avenir Next", Arial, sans-serif;
      }

      .toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 18px;
        border-bottom: 1px solid var(--border);
        background: rgb(255 255 255 / 94%);
        backdrop-filter: blur(10px);
      }

      .title-block {
        min-width: 0;
      }

      h1 {
        margin: 0;
        color: #2d3e5b;
        font-size: 16px;
        font-weight: 700;
        line-height: 20px;
      }

      .meta {
        margin-top: 2px;
        color: var(--muted);
        font-size: 12px;
        line-height: 16px;
      }

      .controls {
        display: inline-flex;
        flex: 0 0 auto;
        gap: 6px;
        padding: 4px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #f8fafc;
      }

      button {
        border: 0;
        border-radius: 6px;
        padding: 7px 10px;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      button[aria-pressed="true"] {
        background: var(--blue);
        color: #fff;
      }

      .view {
        display: none;
      }

      .view.active {
        display: block;
      }

      .side-view {
        padding: 18px;
      }

      .frames {
        display: grid;
        grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr);
        gap: 16px;
        align-items: start;
      }

      .frame-panel,
      .patch-panel {
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--panel);
        box-shadow: 0 10px 30px rgb(15 23 42 / 8%);
        overflow: hidden;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border);
        color: #2d3e5b;
        font-size: 13px;
        font-weight: 700;
      }

      .panel-header a {
        color: var(--blue);
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
      }

      iframe {
        display: block;
        width: 100%;
        height: calc(100vh - 116px);
        min-height: 780px;
        border: 0;
        background: #fff;
      }

      .patch-view {
        max-width: 1120px;
        margin: 0 auto;
        padding: 18px;
      }

      .patch-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border-radius: 999px;
        padding: 5px 9px;
        background: #fff;
        border: 1px solid var(--border);
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }

      .badge.added {
        color: #146c2e;
        background: var(--green-bg);
        border-color: var(--green-border);
      }

      .badge.removed {
        color: #9a3412;
        background: var(--red-bg);
        border-color: var(--red-border);
      }

      .patch-panel + .patch-panel {
        margin-top: 12px;
      }

      .section-stats {
        display: flex;
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 500;
      }

      .diff-lines {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .diff-line {
        display: grid;
        grid-template-columns: 26px 1fr;
        gap: 8px;
        min-height: 30px;
        padding: 7px 12px;
        border-top: 1px solid #edf1f7;
        font-size: 13px;
        line-height: 18px;
      }

      .diff-line:first-child {
        border-top: 0;
      }

      .diff-line.added {
        background: var(--green-bg);
        border-left: 3px solid var(--green-border);
      }

      .diff-line.removed {
        background: var(--red-bg);
        border-left: 3px solid var(--red-border);
      }

      .diff-line.unchanged {
        background: var(--gray-bg);
        color: #475569;
      }

      .marker {
        color: var(--muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-weight: 700;
        text-align: center;
      }

      .diff-line.added .marker {
        color: #15803d;
      }

      .diff-line.removed .marker {
        color: #b91c1c;
      }

      .empty-state {
        padding: 20px;
        color: var(--muted);
        font-size: 13px;
      }

      @media (max-width: 900px) {
        .toolbar {
          align-items: flex-start;
          flex-direction: column;
        }

        .frames {
          grid-template-columns: 1fr;
        }

        iframe {
          height: 720px;
        }
      }
    </style>
  </head>
  <body>
    <header class="toolbar">
      <div class="title-block">
        <h1>Resume Compare Preview</h1>
        <div class="meta">
          Base: ${escapeHtml(model.baseLabel)} · Target: ${escapeHtml(model.targetLabel)}
        </div>
      </div>
      <div class="controls" aria-label="Compare mode">
        <button type="button" data-mode="side" aria-pressed="true">Side by Side</button>
        <button type="button" data-mode="patch" aria-pressed="false">Patch</button>
      </div>
    </header>

    <main>
      <section id="side-view" class="view side-view active" aria-label="Side by side resume preview">
        <div class="frames">
          <article class="frame-panel">
            <div class="panel-header">
              <span>Base Resume</span>
              <a href="${escapeAttr(model.baseHref)}" target="_blank" rel="noreferrer">Open</a>
            </div>
            <iframe title="Base resume" src="${escapeAttr(model.baseHref)}"></iframe>
          </article>
          <article class="frame-panel">
            <div class="panel-header">
              <span>Target Resume</span>
              <a href="${escapeAttr(model.targetHref)}" target="_blank" rel="noreferrer">Open</a>
            </div>
            <iframe title="Target resume" src="${escapeAttr(model.targetHref)}"></iframe>
          </article>
        </div>
      </section>

      <section id="patch-view" class="view patch-view" aria-label="Patch-style resume preview">
        <div class="patch-summary" id="patch-summary"></div>
        <div id="patch-root"></div>
      </section>
    </main>

    <script id="compare-data" type="application/json">${dataJson}</script>
    <script>
      const compareData = JSON.parse(document.getElementById("compare-data").textContent);
      const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
      const views = {
        side: document.getElementById("side-view"),
        patch: document.getElementById("patch-view"),
      };

      modeButtons.forEach((button) => {
        button.addEventListener("click", () => setMode(button.dataset.mode));
      });

      renderPatch(compareData);

      function setMode(mode) {
        Object.entries(views).forEach(([name, view]) => {
          view.classList.toggle("active", name === mode);
        });

        modeButtons.forEach((button) => {
          button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
        });
      }

      function renderPatch(data) {
        const summary = document.getElementById("patch-summary");
        summary.innerHTML = [
          badge("added", "+" + data.totals.added + " added"),
          badge("removed", "-" + data.totals.removed + " removed"),
          badge("", data.totals.unchanged + " unchanged")
        ].join("");

        const root = document.getElementById("patch-root");
        root.innerHTML = data.sections.map(renderSection).join("");
      }

      function renderSection(section) {
        const lines = section.diff.length
          ? section.diff.map(renderLine).join("")
          : '<li class="empty-state">No content in this section.</li>';

        return \`
          <article class="patch-panel">
            <div class="panel-header">
              <span>\${escapeHtml(section.name)}</span>
              <span class="section-stats">
                <span>+\${section.added}</span>
                <span>-\${section.removed}</span>
                <span>=\${section.unchanged}</span>
              </span>
            </div>
            <ul class="diff-lines">\${lines}</ul>
          </article>
        \`;
      }

      function renderLine(line) {
        const marker = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
        return \`
          <li class="diff-line \${line.type}">
            <span class="marker">\${marker}</span>
            <span>\${escapeHtml(line.text)}</span>
          </li>
        \`;
      }

      function badge(type, text) {
        return '<span class="badge ' + type + '">' + escapeHtml(text) + '</span>';
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }
    </script>
  </body>
</html>
`;
}

function compactLines(lines) {
  return lines
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .filter((line, index, all) => all.indexOf(line) === index);
}

function normalizeForDiff(value) {
  return normalizeText(value)
    .replace(/[–—]/g, "-")
    .replace(/\s+-\s+/g, " - ")
    .toLowerCase();
}

function normalizeText(value) {
  return decodeEntities(String(value || ""))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function htmlToText(html) {
  return decodeEntities(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|section|article|tr|ul|ol)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value)
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
}

function toTitleCase(value) {
  return normalizeText(value)
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function relativeHref(fromPath, toPath) {
  const relative = path.relative(path.dirname(fromPath), toPath).split(path.sep).join("/");
  return encodeURI(relative || path.basename(toPath));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
