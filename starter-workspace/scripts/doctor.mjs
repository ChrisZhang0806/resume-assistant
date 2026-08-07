#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";

const require = createRequire(import.meta.url);
const workspaceRoot = process.cwd();
const DOCTOR_STATE_FILE = ".resume-assistant-doctor.json";
const RECOMMENDED_DOCS = [
  "README.md",
  "FIRST-TIME-SETUP.md",
  "USER-INTAKE.md",
  "templates/custom-template-intake.md",
];
const IGNORABLE_APPLICATION_ENTRIES = new Set([".gitkeep", ".DS_Store"]);
let doctorContext = {
  firstRun: true,
  markerExists: false,
  recommendedDocCount: 0,
  applicationOutputCount: 0,
};

const state = {
  failures: 0,
  warnings: 0,
};

main().catch((error) => {
  fail(`Unexpected doctor failure: ${error.message}`);
  finish();
});

async function main() {
  const args = parseDoctorArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  doctorContext = await detectDoctorContext();

  console.log("Resume Assistant Doctor");
  console.log(`Workspace: ${workspaceRoot}`);
  console.log(`Run type: ${isFirstRun() ? "first run (strict)" : "follow-up run (workspace)"}`);
  if (isFirstRun()) {
    info("Fresh starter or first run detected. Recommended docs, privacy defaults, and applications/ cleanliness are strict.");
  } else if (doctorContext.markerExists) {
    info("Previous doctor run detected. Optional setup docs and existing application outputs are non-blocking.");
  } else {
    info("Existing workspace activity detected. Optional setup docs and existing application outputs are non-blocking.");
  }

  const packageJson = await loadPackageJson();

  checkNodeVersion(packageJson);
  await checkRequiredStructure();
  await checkRecommendedDocs();
  if (isFirstRun()) showTemplateSetupGuidance();
  await checkPackageScripts(packageJson);
  const dependenciesReady = checkDependencies(packageJson);
  await checkPrivacyDefaults();
  await checkApplicationLogIntegrity();
  await checkStarterPlaceholders();
  await checkAtsTemplateRisk();
  await checkApplicationsFolder();
  checkScriptSyntax();

  if (dependenciesReady) {
    checkLayout("base/index.html");
    checkLayout("base/cover-letter-template.html");
  } else {
    warn("Skipping layout verification until dependencies are installed. Run `npm install`.");
  }

  await checkChrome();
  if (state.failures === 0) await writeDoctorState();
  finish();
}

function parseDoctorArgs(argv) {
  const options = {
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/doctor.mjs [--help]

The first run is strict: recommended docs, .gitignore, and applications/ cleanliness are blocking.
After the first run, or when existing application outputs show this is already a live workspace, optional setup docs and existing application outputs are non-blocking.
Delete ${DOCTOR_STATE_FILE} to run first-run checks again.
`);
}

async function detectDoctorContext() {
  const markerExists = await fileExists(path.join(workspaceRoot, DOCTOR_STATE_FILE));
  const [recommendedDocCount, applicationOutputs] = await Promise.all([
    countExistingRecommendedDocs(),
    listApplicationOutputs({ missingAsEmpty: true }),
  ]);

  return {
    firstRun: !markerExists && (recommendedDocCount > 0 || applicationOutputs.length === 0),
    markerExists,
    recommendedDocCount,
    applicationOutputCount: applicationOutputs.length,
  };
}

function isFirstRun() {
  return doctorContext.firstRun;
}

async function writeDoctorState() {
  const statePath = path.join(workspaceRoot, DOCTOR_STATE_FILE);
  const payload = {
    lastRunAt: new Date().toISOString(),
    detectedAsFirstRun: isFirstRun(),
    markerExistedBeforeRun: doctorContext.markerExists,
    recommendedDocsPresent: doctorContext.recommendedDocCount,
    applicationOutputsDetected: doctorContext.applicationOutputCount,
  };

  try {
    await writeFile(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch (error) {
    warn(`Could not write ${DOCTOR_STATE_FILE}: ${error.message}`);
  }
}

async function loadPackageJson() {
  section("Package");

  try {
    const raw = await readFile(path.join(workspaceRoot, "package.json"), "utf8");
    const packageJson = JSON.parse(raw);
    pass("package.json is valid JSON.");
    return packageJson;
  } catch (error) {
    fail(`package.json could not be read or parsed: ${error.message}`);
    return {};
  }
}

function checkNodeVersion(packageJson) {
  section("Node Runtime");
  const requirement = String(packageJson.engines?.node || "").trim();
  const match = requirement.match(/^>=(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    fail("package.json engines.node must declare a simple >=major.minor.patch minimum.");
    return;
  }

  const required = match.slice(1).map(Number);
  const current = process.versions.node.split(".").slice(0, 3).map(Number);
  const compatible = current.some((value, index) => {
    if (value === required[index]) return false;
    return value > required[index] && current.slice(0, index).every((part, partIndex) => part === required[partIndex]);
  }) || current.every((value, index) => value === required[index]);

  if (compatible) {
    pass(`Node ${process.versions.node} satisfies ${requirement}.`);
  } else {
    fail(`Node ${process.versions.node} does not satisfy ${requirement}.`);
  }
}

async function checkRequiredStructure() {
  section("Required Files");

  const requiredPaths = [
    ["AGENTS.md", "file"],
    ["application-log.md", "file"],
    ["base/index.html", "file"],
    ["base/styles.css", "file"],
    ["base/cover-letter-template.html", "file"],
    ["master/master-resume.md", "file"],
    ["master/master-data/00-index.md", "file"],
    ["master/master-data/evidence-map.md", "file"],
    ["master/master-data/profile.md", "file"],
    ["master/master-data/skills.md", "file"],
    ["master/master-data/education-certification.md", "file"],
    ["master/master-data/projects", "dir"],
    ["master/master-data/experience", "dir"],
    ["applications", "dir"],
    ["templates/job-analysis-template.md", "file"],
    ["templates/cover-letter-draft-template.md", "file"],
    ["scripts/import-job.mjs", "file"],
    ["scripts/check-application-history.mjs", "file"],
    ["scripts/check-ats-keywords.mjs", "file"],
    ["scripts/generate-compare-preview.mjs", "file"],
    ["scripts/generate-cover-letter-html.mjs", "file"],
    ["scripts/export-resume-pdf.mjs", "file"],
    ["scripts/verify-layout.mjs", "file"],
    ["scripts/serve.mjs", "file"],
    ["scripts/doctor.mjs", "file"],
    ["workflows/setup.md", "file"],
    ["workflows/import-analysis.md", "file"],
    ["workflows/resume-finalize.md", "file"],
    ["workflows/cover-letter.md", "file"],
    ["workflows/application-log.md", "file"],
  ];

  for (const [relativePath, expectedType] of requiredPaths) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    try {
      const info = await stat(absolutePath);
      const typeMatches = expectedType === "file" ? info.isFile() : info.isDirectory();
      if (!typeMatches) {
        fail(`${relativePath} exists but is not a ${expectedType}.`);
      } else if (expectedType === "file" && info.size === 0) {
        fail(`${relativePath} exists but is empty.`);
      } else {
        pass(`${relativePath}`);
      }
    } catch {
      fail(`${relativePath} is missing.`);
    }
  }
}

async function checkRecommendedDocs() {
  section("Recommended Docs");

  for (const relativePath of RECOMMENDED_DOCS) {
    try {
      const fileInfo = await stat(path.join(workspaceRoot, relativePath));
      if (fileInfo.isFile() && fileInfo.size > 0) {
        pass(`${relativePath}`);
      } else {
        reportFirstRunIssue(
          `${relativePath} exists but is empty.`,
          "This is acceptable after a private workspace has already been set up.",
        );
      }
    } catch {
      reportFirstRunIssue(
        `${relativePath} is missing.`,
        "This is acceptable for a private live workspace after setup, but recommended for a reusable starter workspace.",
      );
    }
  }
}

function showTemplateSetupGuidance() {
  section("First-Run Next Steps");

  info("Before tailoring jobs, choose one setup path:");
  info("1. Existing resume: attach or point Codex to a PDF, Word/DOCX file, screenshot/image, Figma Dev Mode reference, existing HTML/CSS, exported CSS, or design notes.");
  info("2. Manual intake: fill USER-INTAKE.md or paste work history, projects, education, skills, target roles, and contact details.");
  info("3. Template choice: use the built-in one-page ATS-friendly template or create a custom resume and cover letter template.");
  info("Suggested prompt: Use $resume-assistant to set up my resume workspace. I can provide [existing resume / work history / custom template source]. Please help me build the master fact base, choose a resume template, and prepare the workspace before tailoring jobs.");

  section("Template Setup Options");

  info("The starter template is one-page and ATS-friendly by default.");
  info("Users may also create a custom template from HTML, PDF, Word/DOCX, screenshots, images, Figma Dev Mode references, exported CSS, or design notes.");
  info("If a custom design uses many icons, two columns, sidebars, tables, charts, skill bars, image-based text, portraits, QR codes, or complex decorative layout, ask the user to confirm ATS risk before using it.");
}

async function checkPackageScripts(packageJson) {
  section("NPM Scripts");

  const scripts = packageJson.scripts || {};
  const requiredScripts = [
    "doctor",
    "check:scripts",
    "import-job",
    "check-history",
    "check-ats",
    "verify-layout",
    "compare",
    "cover-letter",
    "export-pdf",
    "serve",
    "test",
    "audit",
  ];

  for (const scriptName of requiredScripts) {
    if (scripts[scriptName]) {
      pass(`npm run ${scriptName}`);
    } else {
      fail(`Missing package script: ${scriptName}`);
    }
  }

  const serveCommand = scripts.serve || "";
  if (serveCommand && !/scripts\/serve\.mjs/.test(serveCommand)) {
    warn("npm run serve does not use the bundled localhost-only preview server.");
  }
}

function checkDependencies(packageJson) {
  section("Dependencies");

  const requiredPackages = ["@chenglou/pretext", "canvas", "cheerio"];
  const declaredDependencies = packageJson.dependencies || {};
  let ready = true;

  for (const packageName of requiredPackages) {
    if (declaredDependencies[packageName]) {
      pass(`${packageName} is declared in package.json.`);
    } else {
      fail(`${packageName} is not declared in package.json.`);
      ready = false;
      continue;
    }

    try {
      require.resolve(packageName);
      pass(`${packageName} is installed.`);
    } catch {
      fail(`${packageName} is not installed. Run \`npm install\`.`);
      ready = false;
    }
  }

  return ready;
}

async function checkPrivacyDefaults() {
  section("Privacy Defaults");

  let gitignore = "";
  try {
    gitignore = await readFile(path.join(workspaceRoot, ".gitignore"), "utf8");
  } catch {
    if (isFirstRun()) {
      fail(".gitignore is missing. First-run workspaces must include privacy defaults.");
    } else {
      warn(".gitignore is missing. Private outputs may be committed accidentally.");
    }
    info("Copy starter-workspace/.gitignore or create a private .gitignore with node_modules/, applications/*, *.log, and .DS_Store.");
    return;
  }

  checkGitignorePattern(gitignore, "node_modules/");
  checkGitignorePattern(gitignore, "applications/*");
  checkGitignorePattern(gitignore, "tmp/");
  checkGitignorePattern(gitignore, "reports/");
  checkGitignorePattern(gitignore, ".private-rules.md");
  checkGitignorePattern(gitignore, "*.log");
  checkGitignorePattern(gitignore, ".DS_Store");
}

async function checkApplicationLogIntegrity() {
  section("Application Log Integrity");
  const logPath = path.join(workspaceRoot, "application-log.md");
  let content = "";
  try {
    content = await readFile(logPath, "utf8");
  } catch {
    warn("application-log.md could not be read; skipping hash verification.");
    return;
  }

  const storedHash = content.match(/<!--\s*agent-log-hash:\s*([a-f0-9]{64})\s*-->/i)?.[1] || "";
  if (!storedHash) {
    info("application-log.md has no agent-log-hash; manual edits will be preserved.");
    return;
  }

  const normalized = content.replace(/^.*agent-log-hash:.*(?:\r?\n)?/im, "");
  const actualHash = createHash("sha256").update(normalized).digest("hex");
  if (actualHash === storedHash) {
    pass("application-log.md hash matches its stored value.");
  } else {
    warn("application-log.md hash does not match. Preserve manual edits and refresh the hash only during an authorized log update.");
  }

  if (/^\|[^\n]+\|\r?\n\s*\r?\n(?=\|\s*\d+\s*\|)/m.test(content)) {
    warn("application-log.md contains a blank line inside its data rows; repair it during an authorized log update.");
  }
}

async function checkStarterPlaceholders() {
  section("Personalization Readiness");

  const placeholderRules = [
    {
      relativePath: "base/index.html",
      patterns: [
        />\s*Your Name\s*</i,
        /Target Role Title/i,
        /email@example\.com/i,
        /\bphone number\b/i,
        /your-profile/i,
        /project-or-portfolio-link\.example/i,
        /Most Relevant/i,
        /Second Most Relevant/i,
        /Add a second bullet/i,
        /Add another achievement/i,
        /Add honours/i,
        /Add verified tools/i,
        /Add supporting skills/i,
      ],
    },
    {
      relativePath: "base/cover-letter-template.html",
      patterns: [/\[Your Name\]/i, /\[Company Name\]/i, /\[Role\]/i],
    },
    {
      relativePath: "master/master-data/profile.md",
      patterns: [
        /^-\s*(Name|Current role\/title|Location|Email|Phone|LinkedIn|Portfolio \/ website \/ GitHub):\s*Add\b/i,
        /^Write a factual, reusable profile/i,
      ],
    },
    {
      relativePath: "master/master-data/skills.md",
      patterns: [/^-\s*Add\b/i, /^-\s*Example placeholder:/i],
    },
    {
      relativePath: "master/master-data/evidence-map.md",
      patterns: [/^\|\s*Target keyword \d+\s*\|/i, /\|\s*Add\b/i, /^-\s*Add\b/i],
    },
  ];
  const filesWithPlaceholders = [];
  const placeholderExamples = [];

  for (const { relativePath, patterns } of placeholderRules) {
    try {
      const content = await readFile(path.join(workspaceRoot, relativePath), "utf8");
      const hits = collectPlaceholderHits(content, patterns);
      if (hits.length > 0) {
        filesWithPlaceholders.push(relativePath);
        placeholderExamples.push(...hits.slice(0, 2).map((hit) => `${relativePath}:${hit}`));
      }
    } catch {
      // Missing files are reported in Required Files.
    }
  }

  if (filesWithPlaceholders.length > 0) {
    warn(
      `Starter placeholders remain in ${filesWithPlaceholders.join(
        ", ",
      )}. Fill these before generating real applications.`,
    );
    for (const example of placeholderExamples.slice(0, 8)) {
      info(`Placeholder example: ${example}`);
    }
    info("Generic guide words such as job family, application role, or strongest evidence are not treated as placeholders.");
  } else {
    pass("No obvious starter placeholders found in the scanned resume facts.");
  }
}

function collectPlaceholderHits(content, patterns) {
  const hits = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      hits.push(`${index + 1} ${truncateLine(line.trim())}`);
    }
  });

  return hits;
}

function truncateLine(line) {
  if (line.length <= 120) {
    return line;
  }

  return `${line.slice(0, 117)}...`;
}

async function checkAtsTemplateRisk() {
  section("ATS Template Risk");

  let html = "";
  let css = "";

  try {
    html = await readFile(path.join(workspaceRoot, "base/index.html"), "utf8");
  } catch {
    fail("base/index.html could not be read for ATS risk scanning.");
    return;
  }

  try {
    css = await readFile(path.join(workspaceRoot, "base/styles.css"), "utf8");
  } catch {
    fail("base/styles.css could not be read for ATS risk scanning.");
    return;
  }

  const combined = `${html}\n${css}`;
  const riskNotes = [];
  const mediaCount = countMatches(html, /<(img|svg|canvas|picture|video)\b/gi);
  const iconClassCount = countMatches(
    html,
    /class=["'][^"']*(?:\bicon\b|fa-|lucide|material-icons|heroicon|bi-)[^"']*["']/gi,
  );

  if (mediaCount >= 3 || iconClassCount >= 4) {
    riskNotes.push("heavy icon or media use");
  }

  if (/<table\b/i.test(html) || /display\s*:\s*table/i.test(css)) {
    riskNotes.push("tables used in the resume template");
  }

  if (
    /grid-template-columns\s*:\s*(?!1fr\b)[^;]+/i.test(css) ||
    /column-count\s*:\s*[2-9]/i.test(css) ||
    /columns\s*:\s*(?:[2-9]|\d+\s+\d)/i.test(css) ||
    /\b(?:sidebar|side-bar|two-column|two-col|left-column|right-column|timeline)\b/i.test(combined)
  ) {
    riskNotes.push("multi-column, sidebar, or timeline layout");
  }

  if (/position\s*:\s*(absolute|fixed)/i.test(css)) {
    riskNotes.push("absolute or fixed positioning");
  }

  if (/background-image\s*:|linear-gradient\s*\(|radial-gradient\s*\(/i.test(css)) {
    riskNotes.push("decorative background imagery or gradients");
  }

  if (/font-size\s*:\s*(?:[0-8](?:\.\d+)?px|0\.[0-8]rem)/i.test(css)) {
    riskNotes.push("very small text");
  }

  if (riskNotes.length === 0) {
    pass("No obvious ATS-risk template patterns detected in base/index.html or base/styles.css.");
    return;
  }

  warn(`Potential ATS-risk template patterns detected: ${riskNotes.join(", ")}.`);
  info("Before using this template, ask the user to choose: ATS-first adaptation, visual-faithful template with parsing risk, or the default starter template.");
}

async function checkApplicationsFolder() {
  section("Applications Folder");

  try {
    const realOutputs = await listApplicationOutputs();

    if (realOutputs.length === 0) {
      pass("applications/ is clean except for starter metadata.");
    } else {
      const preview = realOutputs.slice(0, 5).join(", ");
      const suffix = realOutputs.length > 5 ? `, and ${realOutputs.length - 5} more` : "";
      const message = `applications/ contains ${realOutputs.length} output folder(s) or file(s): ${preview}${suffix}`;
      if (isFirstRun()) {
        fail(`${message}. First-run workspaces should not include generated application outputs.`);
      } else {
        info(`${message}. This is expected in a live workspace and is not scanned by default.`);
      }
    }
  } catch {
    fail("applications/ could not be read.");
  }
}

async function countExistingRecommendedDocs() {
  let count = 0;

  for (const relativePath of RECOMMENDED_DOCS) {
    try {
      const fileInfo = await stat(path.join(workspaceRoot, relativePath));
      if (fileInfo.isFile() && fileInfo.size > 0) {
        count += 1;
      }
    } catch {
      // Missing recommended docs are evaluated later in the doctor output.
    }
  }

  return count;
}

async function listApplicationOutputs({ missingAsEmpty = false } = {}) {
  try {
    const entries = await readdir(path.join(workspaceRoot, "applications"));
    return entries.filter((entry) => !IGNORABLE_APPLICATION_ENTRIES.has(entry));
  } catch {
    if (!missingAsEmpty) {
      throw new Error("applications/ could not be read.");
    }
    return [];
  }
}

function checkScriptSyntax() {
  section("Script Syntax");

  const scripts = [
    "scripts/import-job.mjs",
    "scripts/check-application-history.mjs",
    "scripts/check-ats-keywords.mjs",
    "scripts/generate-compare-preview.mjs",
    "scripts/generate-cover-letter-html.mjs",
    "scripts/export-resume-pdf.mjs",
    "scripts/verify-layout.mjs",
    "scripts/serve.mjs",
    "scripts/doctor.mjs",
  ];

  for (const scriptPath of scripts) {
    const result = spawnSync(process.execPath, ["--check", scriptPath], {
      cwd: workspaceRoot,
      encoding: "utf8",
    });

    if (result.status === 0) {
      pass(`${scriptPath} parses.`);
    } else {
      fail(`${scriptPath} has a syntax error.`);
      printCommandOutput(result);
    }
  }
}

function checkLayout(htmlPath) {
  section(`Layout: ${htmlPath}`);

  const result = spawnSync(process.execPath, ["scripts/verify-layout.mjs", htmlPath], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });

  if (result.status === 0) {
    pass(`${htmlPath} passes Pretext layout verification.`);
    printImportantLines(result.stdout);
  } else {
    fail(`${htmlPath} failed Pretext layout verification.`);
    printCommandOutput(result);
  }
}

async function checkChrome() {
  section("PDF Export");

  const chromeCandidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ].filter(Boolean);

  for (const candidate of chromeCandidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) {
        pass(`Chrome-compatible browser found: ${candidate}`);
        return;
      }
    } catch {
      // Try the next candidate.
    }
  }

  const commandCandidates = ["google-chrome", "chromium", "chromium-browser", "chrome"];
  for (const command of commandCandidates) {
    const result = spawnSync(command, ["--version"], {
      cwd: workspaceRoot,
      encoding: "utf8",
      stdio: "ignore",
    });

    if (result.status === 0) {
      pass(`Chrome-compatible browser command found: ${command}`);
      return;
    }
  }

  warn("No Chrome-compatible browser found. PDF export needs Chrome, Chromium, Edge, Brave, or CHROME_BIN.");
}

function checkGitignorePattern(gitignore, pattern) {
  const hasPattern = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(pattern);

  if (hasPattern) {
    pass(`.gitignore includes ${pattern}`);
  } else {
    if (isFirstRun()) {
      fail(`.gitignore does not include ${pattern}`);
    } else {
      warn(`.gitignore does not include ${pattern}`);
    }
  }
}

function reportFirstRunIssue(problem, workspaceNote) {
  if (isFirstRun()) {
    fail(`${problem} Required on the first doctor run.`);
  } else {
    info(`${problem} ${workspaceNote}`);
  }
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function section(name) {
  console.log(`\n${name}`);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function info(message) {
  console.log(`[INFO] ${message}`);
}

function warn(message) {
  state.warnings += 1;
  console.log(`[WARN] ${message}`);
}

function fail(message) {
  state.failures += 1;
  console.log(`[FAIL] ${message}`);
}

function printImportantLines(output) {
  for (const line of output.split(/\r?\n/)) {
    if (/^(Layout Verification:|Type:|Template Mode:|Page Target:|Total Height:|FIT CHECK PASSED|HEIGHT CHECK PASSED)/.test(line.trim())) {
      console.log(`       ${line.trim()}`);
    }
  }
}

function printCommandOutput(result) {
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (!output) return;

  for (const line of output.split(/\r?\n/)) {
    console.log(`       ${line}`);
  }
}

function countMatches(value, pattern) {
  return (String(value || "").match(pattern) || []).length;
}

function finish() {
  console.log("\nDoctor Summary");

  if (state.failures > 0) {
    console.log(`FAILED with ${state.failures} failure(s) and ${state.warnings} warning(s).`);
    process.exit(1);
  }

  if (state.warnings > 0) {
    console.log(`PASSED with ${state.warnings} warning(s).`);
    process.exit(0);
  }

  console.log("PASSED with no warnings.");
  process.exit(0);
}
