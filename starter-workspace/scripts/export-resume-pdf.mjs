#!/usr/bin/env node

import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const VERIFY_LAYOUT_SCRIPT = path.join(SCRIPT_DIR, "verify-layout.mjs");
const CHECK_ATS_SCRIPT = path.join(SCRIPT_DIR, "check-ats-keywords.mjs");

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "google-chrome",
  "chromium",
  "chromium-browser",
  "chrome",
].filter(Boolean);

if (isDirectExecution()) {
  main().catch((error) => {
    console.error(`PDF export failed: ${error.message}`);
    process.exit(1);
  });
}

export async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.htmlPath) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const htmlPath = path.resolve(args.htmlPath);
  await assertFile(htmlPath, "HTML input");

  const layoutOptions = await resolveLayoutOptions(htmlPath, args);
  const outputPath = path.resolve(
    args.outputPath || (await defaultPdfOutputPath(htmlPath)),
  );
  await assertSafeOutputPath(htmlPath, outputPath);

  const workflowState = await readWorkflowState(path.dirname(htmlPath));
  assertWorkflowConfirmation(
    workflowState,
    layoutOptions.documentType,
    path.join(path.dirname(htmlPath), "workflow-state.json"),
  );
  const atsResult = await runAtsKeywordCheckIfNeeded(htmlPath);
  runLayoutVerification(htmlPath, layoutOptions);

  await ensureOutputDirectory(outputPath);
  const chromePath = await findChrome();
  let stagingDir = "";
  let userDataDir = "";
  let actualPageCount = 0;

  try {
    stagingDir = await mkdtemp(
      path.join(path.dirname(outputPath), ".resume-pdf-export-"),
    );
    const temporaryOutputPath = path.join(stagingDir, path.basename(outputPath));
    userDataDir = await mkdtemp(path.join(os.tmpdir(), "resume-pdf-chrome-"));

    const flags = [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--no-pdf-header-footer",
      "--allow-file-access-from-files",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=1000",
      `--user-data-dir=${userDataDir}`,
      `--print-to-pdf=${temporaryOutputPath}`,
      pathToFileURL(htmlPath).href,
    ];

    await runChrome(chromePath, flags, temporaryOutputPath);
    await assertFile(temporaryOutputPath, "Temporary PDF output");
    actualPageCount = await validatePdfPageCount(
      temporaryOutputPath,
      layoutOptions.pages,
    );

    await rename(temporaryOutputPath, outputPath);
    await assertFile(outputPath, "PDF output");
    await updateWorkflowStateAfterExport({
      htmlPath,
      documentType: layoutOptions.documentType,
      pdfPath: outputPath,
      pdfPages: actualPageCount,
      atsPassed: atsResult.atsPassed,
    });
  } finally {
    if (userDataDir) await cleanupChromeProfile(userDataDir);
    if (stagingDir) await rm(stagingDir, { force: true, recursive: true });
  }

  console.log(
    `Created ${path.relative(process.cwd(), outputPath)} (${actualPageCount} page(s))`,
  );
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

async function runAtsKeywordCheckIfNeeded(htmlPath) {
  const html = await readFile(htmlPath, "utf8");
  const isResume = /\bclass=["'][^"']*\bresume\b/i.test(html);
  const isCoverLetter = /\bclass=["'][^"']*\bcover-letter\b/i.test(html);

  if (!isResume || isCoverLetter) {
    return { atsPassed: false };
  }

  const htmlDir = path.dirname(htmlPath);
  const analysisPath = path.join(htmlDir, "job-analysis.md");
  const statePath = path.join(htmlDir, "workflow-state.json");
  const isApplicationResume = htmlPath.split(path.sep).includes("applications");
  const hasWorkflowState = await fileExists(statePath);

  if (!(await fileExists(analysisPath))) {
    if (isApplicationResume || hasWorkflowState) {
      throw new Error(
        `job-analysis.md not found beside target resume. ATS keyword check is mandatory before PDF export: ${analysisPath}`,
      );
    }

    console.warn("Skipping ATS keyword check because no job-analysis.md was found beside this non-application resume.");
    return { atsPassed: false };
  }

  console.log("Running ATS keyword coverage check...");
  const result = spawnSync(
    process.execPath,
    [CHECK_ATS_SCRIPT, htmlPath, "--analysis", analysisPath],
    { stdio: "inherit" },
  );

  if (result.error) {
    throw new Error(`ATS keyword check could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error("ATS keyword check failed. Rewrite the resume and rerun the check before exporting PDF.");
  }

  return { atsPassed: true };
}

export async function resolveLayoutOptions(htmlPath, cliArgs = {}) {
  const html = await readFile(htmlPath, "utf8");
  const documentType = /\bclass=["'][^"']*\bcover-letter\b/i.test(html)
    ? "coverLetter"
    : "resume";
  const state = await readWorkflowState(path.dirname(htmlPath));
  const template = isPlainObject(state?.template) ? state.template : {};
  const stateMode = documentType === "coverLetter"
    ? template.coverLetterMode
    : template.resumeMode;
  const statePages = documentType === "coverLetter"
    ? template.coverLetterPages
    : template.resumePages;

  return {
    documentType,
    pages:
      cliArgs.pages ??
      parseOptionalPositiveInteger(
        statePages,
        `workflow-state.json template.${documentType}Pages`,
      ) ??
      1,
    templateMode:
      cliArgs.templateMode ||
      parseOptionalTemplateMode(
        stateMode,
        `workflow-state.json template.${documentType}Mode`,
      ) ||
      "default",
    allowedGaps:
      cliArgs.allowedGaps ||
      parseOptionalAllowedGaps(
        template.allowedGaps,
        "workflow-state.json template.allowedGaps",
      ) ||
      ["2px", "4px"],
  };
}

async function readWorkflowState(htmlDirectory) {
  const statePath = path.join(htmlDirectory, "workflow-state.json");
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8"));
    if (!isPlainObject(parsed)) {
      throw new Error("the root value must be an object");
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`Invalid workflow state JSON: ${statePath}: ${error.message}`);
  }
}

export function assertWorkflowConfirmation(state, documentType, statePath) {
  if (!state || !Object.hasOwn(state, "workflowVersion")) return;
  if (state.workflowVersion !== 2) {
    throw new Error(
      `Unsupported workflowVersion in workflow state: ${statePath}. Expected 2.`,
    );
  }

  if (documentType === "resume") {
    const decisions = isPlainObject(state.decisions) ? state.decisions : {};
    if (
      decisions.analysisConfirmed !== true ||
      !["confirmed", "waived"].includes(decisions.analysisConfirmation)
    ) {
      throw new Error(
        `Analysis confirmation is required before resume export. Set decisions.analysisConfirmed to true and decisions.analysisConfirmation to confirmed or waived: ${statePath}`,
      );
    }
    return;
  }

  const coverLetterChecks = isPlainObject(state.coverLetterChecks)
    ? state.coverLetterChecks
    : {};
  if (!["confirmed", "waived"].includes(coverLetterChecks.markdown)) {
    throw new Error(
      `Cover-letter Markdown confirmation is required before export. Set coverLetterChecks.markdown to confirmed or waived: ${statePath}`,
    );
  }
}

export function runLayoutVerification(
  htmlPath,
  options,
  { spawnSyncImpl = spawnSync, verifyScript = VERIFY_LAYOUT_SCRIPT } = {},
) {
  const verifyArgs = [
    verifyScript,
    htmlPath,
    "--pages",
    String(options.pages),
    "--template-mode",
    options.templateMode,
    "--allowed-gaps",
    options.allowedGaps.join(","),
  ];

  console.log("Running automated layout verification...");
  const result = spawnSyncImpl(process.execPath, verifyArgs, { stdio: "inherit" });
  if (result.error) {
    throw new Error(`Layout verification could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const reason = result.signal
      ? `signal ${result.signal}`
      : `exit code ${result.status ?? "unknown"}`;
    throw new Error(
      `Layout verification failed (${reason}). PDF export was stopped; fix the layout and rerun export.`,
    );
  }

  return result;
}

async function fileExists(filePath) {
  try {
    const result = await stat(filePath);
    return result.isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function parseArgs(argv) {
  const args = {
    htmlPath: "",
    outputPath: "",
    pages: null,
    templateMode: "",
    allowedGaps: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--output" || arg === "-o") {
      args.outputPath = argv[++index] || "";
    } else if (arg === "--custom-template") {
      args.templateMode = "custom";
    } else if (arg === "--pages" || arg === "--max-pages") {
      const value = readOptionValue(argv, ++index, arg);
      args.pages = parsePositiveInteger(value, arg);
    } else if (arg.startsWith("--pages=")) {
      args.pages = parsePositiveInteger(arg.slice("--pages=".length), "--pages");
    } else if (arg.startsWith("--max-pages=")) {
      args.pages = parsePositiveInteger(
        arg.slice("--max-pages=".length),
        "--max-pages",
      );
    } else if (arg === "--template-mode") {
      args.templateMode = parseTemplateMode(
        readOptionValue(argv, ++index, "--template-mode"),
        "--template-mode",
      );
    } else if (arg.startsWith("--template-mode=")) {
      args.templateMode = parseTemplateMode(
        arg.slice("--template-mode=".length),
        "--template-mode",
      );
    } else if (arg === "--allowed-gaps") {
      args.allowedGaps = parseAllowedGaps(
        readOptionValue(argv, ++index, "--allowed-gaps"),
        "--allowed-gaps",
      );
    } else if (arg.startsWith("--allowed-gaps=")) {
      args.allowedGaps = parseAllowedGaps(
        arg.slice("--allowed-gaps=".length),
        "--allowed-gaps",
      );
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

function readOptionValue(argv, index, optionName) {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, optionName) {
  const normalized = String(value).trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(`${optionName} must be a positive integer.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${optionName} must be a safe positive integer.`);
  }
  return parsed;
}

function parseOptionalPositiveInteger(value, optionName) {
  if (value === undefined || value === null || value === "") return null;
  return parsePositiveInteger(value, optionName);
}

function parseTemplateMode(value, optionName) {
  if (value === "default" || value === "custom") return value;
  throw new Error(`${optionName} must be default or custom.`);
}

function parseOptionalTemplateMode(value, optionName) {
  if (value === undefined || value === null || value === "") return "";
  return parseTemplateMode(value, optionName);
}

function parseAllowedGaps(value, optionName) {
  const source = Array.isArray(value) ? value.join(",") : String(value);
  const gaps = source
    .split(/[,\s]+/)
    .map((gap) => gap.trim().toLowerCase())
    .filter(Boolean);
  if (gaps.length === 0) {
    throw new Error(`${optionName} requires at least one CSS length.`);
  }
  if (
    gaps.some(
      (gap) => !/^(?:0|\d+(?:\.\d+)?(?:px|rem|em|pt|mm|cm|in))$/.test(gap),
    )
  ) {
    throw new Error(`${optionName} must contain CSS lengths such as 2px,4px.`);
  }
  return [...new Set(gaps)];
}

function parseOptionalAllowedGaps(value, optionName) {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value) && value.length === 0) return null;
  return parseAllowedGaps(value, optionName);
}

function printHelp() {
  console.log(`Usage:
  node scripts/export-resume-pdf.mjs <target-resume.html> [options]

Options:
  --output, -o FILE      PDF output path. Defaults to an upload-friendly name
                         when job-analysis.md is available.
  --pages N              Required PDF page count. Defaults to workflow state or 1.
  --template-mode MODE   Layout mode: default or custom.
  --custom-template      Alias for --template-mode custom.
  --allowed-gaps LIST    Comma-separated default-template gap values.
  --help, -h             Show this help.

For application resumes, PDF export automatically runs the ATS keyword coverage
check against the same folder's job-analysis.md before layout verification and export.
When explicit layout options are omitted, workflow-state.json beside the HTML supplies
resume/cover-letter template mode, page target, and allowed gaps when available.

Examples:
  node scripts/export-resume-pdf.mjs applications/2026-06-14-amd-ux-ui-designer/resume.html
  node scripts/export-resume-pdf.mjs resume.html --output resume.pdf
`);
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate.includes("/") && (await exists(candidate))) {
      return candidate;
    }

    if (!candidate.includes("/") && (await commandExists(candidate))) {
      return candidate;
    }
  }

  throw new Error(
    "No Chrome-compatible browser found. Install Google Chrome/Chromium or set CHROME_BIN.",
  );
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

async function defaultPdfOutputPath(htmlPath) {
  const uploadName = await uploadFriendlyPdfName(htmlPath);
  if (uploadName) {
    return path.join(path.dirname(htmlPath), uploadName);
  }

  const replaced = htmlPath.replace(/\.html?$/i, ".pdf");
  return replaced === htmlPath ? `${htmlPath}.pdf` : replaced;
}

export async function assertSafeOutputPath(htmlPath, outputPath) {
  const resolvedInput = path.resolve(htmlPath);
  const resolvedOutput = path.resolve(outputPath);
  if (resolvedInput === resolvedOutput) {
    throw new Error(
      "Input and output paths must be different; refusing to overwrite the HTML input.",
    );
  }

  const inputInfo = await stat(resolvedInput);
  let outputInfo;
  try {
    outputInfo = await stat(resolvedOutput);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  if (outputInfo.isDirectory()) {
    throw new Error(`PDF output path is a directory: ${resolvedOutput}`);
  }

  const [realInput, realOutput] = await Promise.all([
    realpath(resolvedInput),
    realpath(resolvedOutput),
  ]);
  if (
    realInput === realOutput ||
    (inputInfo.dev === outputInfo.dev && inputInfo.ino === outputInfo.ino)
  ) {
    throw new Error(
      "Input and output paths must be different; refusing to overwrite the HTML input.",
    );
  }
}

export async function ensureOutputDirectory(outputPath) {
  await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
}

export function parsePdfPageCount(pdfData) {
  const source = Buffer.isBuffer(pdfData)
    ? pdfData.toString("latin1")
    : String(pdfData || "");
  const pageTreeCounts = [];
  const objectPattern = /(?:^|[\r\n])\s*\d+\s+\d+\s+obj\b([\s\S]*?)\bendobj\b/g;

  for (const match of source.matchAll(objectPattern)) {
    const objectBody = match[1].replace(/\bstream\b[\s\S]*?\bendstream\b/g, "");
    if (!/\/Type\s*\/Pages\b/.test(objectBody)) continue;
    const countMatch = objectBody.match(/\/Count\s+(\d+)\b/);
    if (countMatch) pageTreeCounts.push(Number(countMatch[1]));
  }

  if (pageTreeCounts.length > 0) return Math.max(...pageTreeCounts);

  const pageObjects = source.match(/\/Type\s*\/Page\b/g) || [];
  if (pageObjects.length > 0) return pageObjects.length;

  throw new Error(
    "No readable PDF page tree was found. Expected /Type /Pages /Count or /Type /Page objects.",
  );
}

async function validatePdfPageCount(pdfPath, expectedPages) {
  let actualPages;
  try {
    actualPages = parsePdfPageCount(await readFile(pdfPath));
  } catch (error) {
    throw new Error(
      `Could not verify PDF page count, so export was stopped: ${error.message}`,
    );
  }

  if (actualPages !== expectedPages) {
    throw new Error(
      `PDF page-count check failed: expected ${expectedPages}, generated ${actualPages}. The previous PDF, if any, was preserved.`,
    );
  }
  return actualPages;
}

export async function updateWorkflowStateAfterExport({
  htmlPath,
  documentType,
  pdfPath,
  pdfPages,
  atsPassed = false,
}) {
  const htmlDirectory = path.dirname(htmlPath);
  const statePath = path.join(htmlDirectory, "workflow-state.json");
  const state = await readWorkflowState(htmlDirectory);
  if (!state) return false;
  if (documentType === "resume" && !atsPassed) {
    throw new Error(
      `Refusing to mark resume export complete without a passed ATS check: ${statePath}`,
    );
  }

  const outputs = isPlainObject(state.outputs) ? state.outputs : {};
  const relativePdfPath = path.relative(htmlDirectory, pdfPath).split(path.sep).join("/");
  let nextState;

  if (documentType === "coverLetter") {
    const coverLetterChecks = isPlainObject(state.coverLetterChecks)
      ? state.coverLetterChecks
      : {};
    nextState = {
      ...state,
      updatedAt: new Date().toISOString(),
      stage: "cover-letter-exported",
      coverLetterChecks: {
        ...coverLetterChecks,
        layout: "passed",
        pdf: "passed",
        pdfPages,
      },
      outputs: { ...outputs, coverLetterPdf: relativePdfPath },
    };
  } else {
    const checks = isPlainObject(state.checks) ? state.checks : {};
    nextState = {
      ...state,
      updatedAt: new Date().toISOString(),
      stage: "resume-exported",
      checks: {
        ...checks,
        ats: "passed",
        layout: "passed",
        pdf: "passed",
        pdfPages,
      },
      outputs: { ...outputs, resumePdf: relativePdfPath },
    };
  }

  let stagingDirectory = "";
  try {
    stagingDirectory = await mkdtemp(
      path.join(htmlDirectory, ".workflow-state-update-"),
    );
    const temporaryStatePath = path.join(stagingDirectory, "workflow-state.json");
    await writeFile(
      temporaryStatePath,
      `${JSON.stringify(nextState, null, 2)}\n`,
      "utf8",
    );
    await rename(temporaryStatePath, statePath);
  } finally {
    if (stagingDirectory) {
      await rm(stagingDirectory, { force: true, recursive: true });
    }
  }
  return true;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function uploadFriendlyPdfName(htmlPath) {
  const taskDir = path.dirname(htmlPath);
  const analysisPath = path.join(taskDir, "job-analysis.md");
  const analysis = await readOptionalFile(analysisPath);
  const profile = await readOptionalFile(path.resolve("master/master-data/profile.md"));
  if (!analysis) return "";

  const name = fieldValue(profile, "Name") || "Applicant";
  const company = fieldValue(analysis, "Company");
  const role = fieldValue(analysis, "Job title") || fieldValue(analysis, "Role");
  if (!name || !company || !role) return "";

  const documentType = /cover-letter/i.test(path.basename(htmlPath))
    ? "Cover Letter"
    : "Resume";
  const parts = [name, role, company, documentType].map(slugForUploadName);

  return `${parts.filter(Boolean).join("-")}.pdf`;
}

async function readOptionalFile(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function fieldValue(markdown, label) {
  if (!markdown) return "";

  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^-\\s*${escaped}:\\s*(.+)$`, "im"));
  return match ? match[1].trim().replace(/`/g, "") : "";
}

function slugForUploadName(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command) {
  return new Promise((resolve) => {
    const child = spawn("command", ["-v", command], {
      shell: true,
      stdio: "ignore",
    });

    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

function runChrome(chromePath, flags, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(chromePath, flags, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";
    let settled = false;
    let lastSize = 0;
    let stableChecks = 0;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearInterval(checkPdf);
      clearTimeout(timeout);
      callback();
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const checkPdf = setInterval(async () => {
      try {
        const info = await stat(outputPath);
        if (info.size > 0 && info.size === lastSize) {
          stableChecks += 1;
        } else {
          stableChecks = 0;
          lastSize = info.size;
        }

        if (stableChecks >= 3) {
          child.kill("SIGTERM");
          finish(resolve);
        }
      } catch {
        // PDF is not ready yet.
      }
    }, 500);

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(() =>
        reject(new Error(`Chrome timed out before PDF export completed. ${formatChromeOutput(stdout, stderr)}`)),
      );
    }, 45000);

    child.on("error", (error) => finish(() => reject(error)));
    child.on("exit", (code, signal) => {
      if (settled) return;

      if (code === 0) {
        finish(resolve);
      } else {
        const reason = signal ? `signal ${signal}` : `code ${code}`;
        finish(() =>
          reject(new Error(`Chrome exited with ${reason}. ${formatChromeOutput(stdout, stderr)}`)),
        );
      }
    });
  });
}

function formatChromeOutput(stdout, stderr) {
  return [stdout.trim(), stderr.trim()].filter(Boolean).join("\n").trim();
}

async function cleanupChromeProfile(userDataDir) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(userDataDir, { force: true, recursive: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}
