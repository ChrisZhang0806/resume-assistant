import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(TEST_DIRECTORY, "..");
const VERIFY_SCRIPT = path.join(WORKSPACE, "scripts", "verify-layout.mjs");

function runLayout(args, options = {}) {
  return execFileSync(process.execPath, [VERIFY_SCRIPT, ...args], {
    cwd: WORKSPACE,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function expectFailure(args, pattern) {
  assert.throws(
    () => runLayout(args),
    (error) => {
      assert.match(`${error.stdout || ""}\n${error.stderr || ""}`, pattern);
      return true;
    },
  );
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "resume-layout-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("sanitized default base resume remains measurable", () => {
  const output = runLayout([path.join(WORKSPACE, "base", "index.html")]);
  assert.match(output, /FIT CHECK PASSED/);
});

test("unrendered cover template resolves its controlled stylesheet placeholder", () => {
  const output = runLayout([
    path.join(WORKSPACE, "base", "cover-letter-template.html"),
  ]);
  assert.match(output, /FIT CHECK PASSED/);
});

test("missing local CSS fails instead of using silent defaults", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "resume.html");
  await writeFile(
    htmlPath,
    '<html><head><link rel="stylesheet" href="missing.css"></head><body><main class="resume"><div class="resume-body"><section class="section"><h2>Experience</h2></section></div></main></body></html>',
    "utf8",
  );
  expectFailure([htmlPath], /Stylesheet could not be read/);
});

test("remote CSS fails because it cannot be measured reproducibly", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "resume.html");
  await writeFile(
    htmlPath,
    '<html><head><link rel="stylesheet" href="https://example.com/resume.css"></head><body><main class="resume"><div class="resume-body"><section class="section"><h2>Experience</h2></section></div></main></body></html>',
    "utf8",
  );
  expectFailure([htmlPath], /Remote stylesheet cannot be measured safely/);
});

test("resume bullets over three rendered lines fail policy validation", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "resume.html");
  const cssPath = path.join(directory, "styles.css");
  await writeFile(
    cssPath,
    `.resume { width: 579px; padding: 32px 40px; gap: 2px; }
.resume-body, .section, .entry { display: flex; flex-direction: column; gap: 2px; }
ul { padding-left: 15px; }
`,
    "utf8",
  );
  await writeFile(
    htmlPath,
    `<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body>
<main class="resume"><div class="resume-body"><section class="section"><h2>Experience</h2>
<div class="entry"><h3>Example</h3><ul><li>${"A deliberately long verified resume bullet with product context and delivery detail ".repeat(10)}</li></ul></div>
</section></div></main></body></html>`,
    "utf8",
  );
  expectFailure([htmlPath], /renders as \d+ lines; the maximum is 3/);
});

test("active stylesheet gaps are reflected in height measurement", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "resume.html");
  const cssPath = path.join(directory, "styles.css");
  await writeFile(
    cssPath,
    `.resume { width: 579px; padding: 32px 40px; gap: 4px; }
.resume-body { display: flex; flex-direction: column; gap: 4px; }
.section, .entry, .skill-group { display: flex; flex-direction: column; gap: 4px; }
ul { padding-left: 15px; }
`,
    "utf8",
  );
  await writeFile(
    htmlPath,
    `<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body>
<main class="resume"><header class="resume-header"><h1>Candidate</h1></header><div class="resume-body">
<section class="section"><h2>Experience</h2><div class="entry"><h3>Role</h3><ul><li>Short evidence.</li></ul></div></section>
<section class="section"><h2>Skills</h2><div class="skill-group"><h3>Tools</h3><p>Figma</p></div></section>
</div></main></body></html>`,
    "utf8",
  );

  const output = runLayout([htmlPath, "--verbose", "--allowed-gaps", "4px"]);
  assert.match(output, /Main Flex Gaps \(gap: 4px\)/);
  assert.match(output, /Body Section Gaps \(gap: 4px\)/);
  assert.match(output, /FIT CHECK PASSED/);
});
