#!/usr/bin/env node

import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

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

main().catch((error) => {
  console.error(`PDF export failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.htmlPath) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const htmlPath = path.resolve(args.htmlPath);
  await assertFile(htmlPath, "HTML input");

  // Run automated layout verification
  try {
    const verifyScript = path.resolve("scripts/verify-layout.mjs");
    const { spawnSync } = await import("node:child_process");
    console.log("Running automated layout verification...");
    const verifyResult = spawnSync("node", [verifyScript, htmlPath], { stdio: "inherit" });
    if (verifyResult.status !== 0) {
      console.warn("\n⚠️ WARNING: Layout verification failed (possible page overflow). Checking generated PDF is recommended.");
    }
  } catch (error) {
    console.warn(`Could not run automated layout verification: ${error.message}`);
  }

  const outputPath = path.resolve(
    args.outputPath || (await defaultPdfOutputPath(htmlPath)),
  );
  const chromePath = await findChrome();
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "resume-pdf-chrome-"));

  try {
    await rm(outputPath, { force: true });

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
      `--print-to-pdf=${outputPath}`,
      pathToFileURL(htmlPath).href,
    ];

    await runChrome(chromePath, flags, outputPath);
    await assertFile(outputPath, "PDF output");
  } finally {
    await cleanupChromeProfile(userDataDir);
  }

  console.log(`Created ${path.relative(process.cwd(), outputPath)}`);
}

function parseArgs(argv) {
  const args = {
    htmlPath: "",
    outputPath: "",
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

function printHelp() {
  console.log(`Usage:
  node scripts/export-resume-pdf.mjs <target-resume.html> [options]

Options:
  --output, -o FILE      PDF output path. Defaults to an upload-friendly name
                         when job-analysis.md is available.
  --help, -h             Show this help.

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

  return htmlPath.replace(/\.html?$/i, ".pdf");
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
