import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(TEST_DIR, "..");
const FIXTURES = path.join(TEST_DIR, "fixtures");
const COMPARE_SCRIPT = path.join(
  WORKSPACE,
  "scripts",
  "generate-compare-preview.mjs",
);
const COVER_SCRIPT = path.join(
  WORKSPACE,
  "scripts",
  "generate-cover-letter-html.mjs",
);
const DEFAULT_COVER_TEMPLATE = path.join(
  WORKSPACE,
  "base",
  "cover-letter-template.html",
);

async function runScript(scriptPath, args) {
  return execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd: WORKSPACE,
    maxBuffer: 2 * 1024 * 1024,
  });
}

async function expectFailure(promise, pattern) {
  try {
    await promise;
    assert.fail("Expected command to fail.");
  } catch (error) {
    assert.match(`${error.stderr || ""}\n${error.stdout || ""}`, pattern);
  }
}

async function withTempDirectory(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "resume-assistant-test-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractCompareData(html) {
  const match = html.match(
    /<script id="compare-data" type="application\/json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, "compare JSON should be embedded in the preview");
  return JSON.parse(match[1]);
}

test("compare includes the base/target section union and updates optional state", async () => {
  await withTempDirectory(async (directory) => {
    const basePath = path.join(directory, "base.html");
    const targetPath = path.join(directory, "resume.html");
    const outputPath = path.join(directory, "compare.html");
    const statePath = path.join(directory, "workflow-state.json");
    await Promise.all([
      copyFile(path.join(FIXTURES, "compare-base.html"), basePath),
      copyFile(path.join(FIXTURES, "compare-target.html"), targetPath),
      writeFile(
        statePath,
        `${JSON.stringify({
          workflowVersion: 2,
          stage: "resume-drafted",
          decisions: { compare: "requested" },
          checks: { ats: "passed", layout: "passed" },
        })}\n`,
      ),
    ]);

    await runScript(COMPARE_SCRIPT, [
      targetPath,
      "--base",
      basePath,
      "--output",
      outputPath,
    ]);

    const data = extractCompareData(await readFile(outputPath, "utf8"));
    const sectionNames = data.sections.map((section) => section.name);
    assert.ok(sectionNames.includes("Personal Project"));
    assert.ok(sectionNames.includes("Selected Product"));
    assert.ok(
      sectionNames.indexOf("Selected Product") <
        sectionNames.indexOf("Experience"),
    );

    const state = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(state.decisions.compare, "generated");
    assert.equal(state.checks.ats, "passed");
    assert.equal(state.checks.layout, "passed");
    assert.equal(state.checks.compare, "passed");
    assert.equal(state.outputs.compare, "compare.html");
    assert.equal(
      (await readdir(directory)).some((name) => name.endsWith(".tmp")),
      false,
    );
  });
});

test("compare refuses to overwrite either resume input", async () => {
  const basePath = path.join(FIXTURES, "compare-base.html");
  const targetPath = path.join(FIXTURES, "compare-target.html");
  const originals = await Promise.all([
    readFile(basePath, "utf8"),
    readFile(targetPath, "utf8"),
  ]);

  await expectFailure(
    runScript(COMPARE_SCRIPT, [
      targetPath,
      "--base",
      basePath,
      "--output",
      targetPath,
    ]),
    /output must differ from the target resume/i,
  );
  await expectFailure(
    runScript(COMPARE_SCRIPT, [
      targetPath,
      "--base",
      basePath,
      "--output",
      basePath,
    ]),
    /output must differ from the base resume/i,
  );

  assert.equal(await readFile(basePath, "utf8"), originals[0]);
  assert.equal(await readFile(targetPath, "utf8"), originals[1]);
});

test("compare validates workflow state before creating output", async () => {
  await withTempDirectory(async (directory) => {
    const basePath = path.join(directory, "base.html");
    const targetPath = path.join(directory, "resume.html");
    const outputPath = path.join(directory, "compare.html");
    await Promise.all([
      copyFile(path.join(FIXTURES, "compare-base.html"), basePath),
      copyFile(path.join(FIXTURES, "compare-target.html"), targetPath),
      writeFile(path.join(directory, "workflow-state.json"), "{invalid json\n"),
    ]);

    await expectFailure(
      runScript(COMPARE_SCRIPT, [
        targetPath,
        "--base",
        basePath,
        "--output",
        outputPath,
      ]),
      /invalid workflow state json/i,
    );
    assert.equal(await exists(outputPath), false);
  });
});

test("cover generator applies a custom template without changing resume checks", async () => {
  await withTempDirectory(async (directory) => {
    const inputPath = path.join(directory, "cover-letter.md");
    const outputPath = path.join(directory, "cover-letter.html");
    const statePath = path.join(directory, "workflow-state.json");
    await Promise.all([
      copyFile(path.join(FIXTURES, "cover-letter-valid.md"), inputPath),
      writeFile(
        statePath,
        `${JSON.stringify({
          workflowVersion: 2,
          stage: "resume-exported",
          checks: { ats: "passed", layout: "passed", pdf: "passed" },
          coverLetterChecks: {
            markdown: "confirmed",
            layout: "passed",
            pdf: "passed",
            pdfPages: 1,
          },
          outputs: { resumePdf: "resume.pdf", coverLetterPdf: "old-cover.pdf" },
        })}\n`,
      ),
    ]);

    await runScript(COVER_SCRIPT, [
      inputPath,
      "--template",
      path.join(FIXTURES, "custom-cover-template.html"),
      "--role",
      "Service Designer",
      "--company",
      "Example Systems",
      "--output",
      outputPath,
    ]);

    const html = await readFile(outputPath, "utf8");
    assert.match(html, /data-template="synthetic-fixture"/);
    assert.match(html, /Service Designer — Example Systems/);
    assert.match(html, /FixtureFlow prototype/);
    assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css"/);
    assert.doesNotMatch(html, /\{\{[^}]+\}\}/);

    const state = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(state.stage, "cover-letter-rendered");
    assert.deepEqual(state.checks, {
      ats: "passed",
      layout: "passed",
      pdf: "passed",
    });
    assert.equal(state.coverLetterChecks.markdown, "confirmed");
    assert.equal(state.coverLetterChecks.html, "generated");
    assert.ok(state.coverLetterChecks.bodyWords >= 220);
    assert.ok(state.coverLetterChecks.bodyWords <= 300);
    assert.equal(state.coverLetterChecks.paragraphs, 3);
    assert.equal(state.coverLetterChecks.layout, "pending");
    assert.equal(state.coverLetterChecks.pdf, "pending");
    assert.equal(state.coverLetterChecks.pdfPages, null);
    assert.equal(state.outputs.resumePdf, "resume.pdf");
    assert.equal(state.outputs.coverLetterPdf, undefined);
    assert.equal(state.outputs.coverLetterMarkdown, "cover-letter.md");
    assert.equal(state.outputs.coverLetterHtml, "cover-letter.html");
    assert.equal(
      (await readdir(directory)).some((name) => name.endsWith(".tmp")),
      false,
    );
  });
});

test("default cover template uses the generated stylesheet path and omits absent optional contacts", async () => {
  await withTempDirectory(async (directory) => {
    const inputPath = path.join(directory, "cover-letter.md");
    const outputPath = path.join(directory, "cover-letter.html");
    await copyFile(path.join(FIXTURES, "cover-letter-short.md"), inputPath);

    await runScript(COVER_SCRIPT, [
      inputPath,
      "--role",
      "Service Designer",
      "--company",
      "Example Systems",
      "--min-words",
      "1",
      "--max-words",
      "100",
      "--output",
      outputPath,
    ]);

    const html = await readFile(outputPath, "utf8");
    assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css"/);
    assert.match(html, /mailto:avery@example\.test/);
    assert.doesNotMatch(html, /portfolio\.example\.test|linkedin\.com|555-0147|Example City/);
    assert.doesNotMatch(html, /href=""/);
  });
});

test("cover generator enforces paragraph defaults and explicit overrides", async () => {
  await withTempDirectory(async (directory) => {
    const fixture = path.join(FIXTURES, "cover-letter-four-paragraphs.md");
    await expectFailure(
      runScript(COVER_SCRIPT, [
        fixture,
        "--role",
        "Service Designer",
        "--company",
        "Example Systems",
        "--min-words",
        "1",
        "--max-words",
        "100",
        "--output",
        path.join(directory, "rejected.html"),
      ]),
      /exactly 3 body paragraphs; found 4/i,
    );

    const outputPath = path.join(directory, "accepted.html");
    await runScript(COVER_SCRIPT, [
      fixture,
      "--role",
      "Service Designer",
      "--company",
      "Example Systems",
      "--paragraphs",
      "4",
      "--min-words",
      "1",
      "--max-words",
      "100",
      "--output",
      outputPath,
    ]);
    assert.match(
      await readFile(outputPath, "utf8"),
      /fourth synthetic paragraph deliberately violates/i,
    );
  });
});

test("cover generator enforces word defaults and explicit overrides", async () => {
  await withTempDirectory(async (directory) => {
    const fixture = path.join(FIXTURES, "cover-letter-short.md");
    const outputPath = path.join(directory, "cover-letter.html");
    const commonArgs = [
      fixture,
      "--role",
      "Service Designer",
      "--company",
      "Example Systems",
      "--output",
      outputPath,
    ];

    await expectFailure(runScript(COVER_SCRIPT, commonArgs), /body word count.*220-300/i);
    await runScript(COVER_SCRIPT, [
      ...commonArgs,
      "--min-words",
      "1",
      "--max-words",
      "100",
    ]);
    assert.match(await readFile(outputPath, "utf8"), /synthetic opening/i);
  });
});

test("cover generator requires a real email but permits other contacts to be absent", async () => {
  await withTempDirectory(async (directory) => {
    const inputPath = path.join(directory, "invalid-contact.md");
    const shortDraft = await readFile(
      path.join(FIXTURES, "cover-letter-short.md"),
      "utf8",
    );
    await writeFile(inputPath, shortDraft.replace("avery@example.test", ""));

    await expectFailure(
      runScript(COVER_SCRIPT, [
        inputPath,
        "--role",
        "Service Designer",
        "--company",
        "Example Systems",
        "--min-words",
        "1",
        "--max-words",
        "100",
      ]),
      /contact email is missing/i,
    );
  });
});

test("cover generator refuses input, template, and workflow-state output collisions", async () => {
  const inputPath = path.join(FIXTURES, "cover-letter-short.md");
  const templatePath = path.join(FIXTURES, "custom-cover-template.html");
  const originals = await Promise.all([
    readFile(inputPath, "utf8"),
    readFile(templatePath, "utf8"),
  ]);
  const common = [
    inputPath,
    "--template",
    templatePath,
    "--role",
    "Service Designer",
    "--company",
    "Example Systems",
    "--min-words",
    "1",
    "--max-words",
    "100",
  ];

  await expectFailure(
    runScript(COVER_SCRIPT, [...common, "--output", inputPath]),
    /output must differ from the Markdown input/i,
  );
  await expectFailure(
    runScript(COVER_SCRIPT, [...common, "--output", templatePath]),
    /output must differ from the HTML template/i,
  );

  await withTempDirectory(async (directory) => {
    const localInput = path.join(directory, "cover-letter.md");
    const statePath = path.join(directory, "workflow-state.json");
    await Promise.all([
      copyFile(inputPath, localInput),
      writeFile(statePath, "{}\n"),
    ]);
    await expectFailure(
      runScript(COVER_SCRIPT, [
        localInput,
        "--role",
        "Service Designer",
        "--company",
        "Example Systems",
        "--min-words",
        "1",
        "--max-words",
        "100",
        "--output",
        statePath,
      ]),
      /output must differ from the workflow state/i,
    );
    assert.equal(await readFile(statePath, "utf8"), "{}\n");
  });

  assert.equal(await readFile(inputPath, "utf8"), originals[0]);
  assert.equal(await readFile(templatePath, "utf8"), originals[1]);
});

test("cover generator validates workflow state before replacing output", async () => {
  await withTempDirectory(async (directory) => {
    const inputPath = path.join(directory, "cover-letter.md");
    const outputPath = path.join(directory, "cover-letter.html");
    await Promise.all([
      copyFile(path.join(FIXTURES, "cover-letter-short.md"), inputPath),
      writeFile(path.join(directory, "workflow-state.json"), "[]\n"),
      writeFile(outputPath, "sentinel output\n"),
    ]);

    await expectFailure(
      runScript(COVER_SCRIPT, [
        inputPath,
        "--role",
        "Service Designer",
        "--company",
        "Example Systems",
        "--min-words",
        "1",
        "--max-words",
        "100",
        "--output",
        outputPath,
      ]),
      /invalid workflow state json/i,
    );
    assert.equal(await readFile(outputPath, "utf8"), "sentinel output\n");
  });
});

test("v2 cover rendering requires recorded Markdown confirmation", async () => {
  await withTempDirectory(async (directory) => {
    const inputPath = path.join(directory, "cover-letter.md");
    const outputPath = path.join(directory, "cover-letter.html");
    await Promise.all([
      copyFile(path.join(FIXTURES, "cover-letter-short.md"), inputPath),
      writeFile(
        path.join(directory, "workflow-state.json"),
        `${JSON.stringify({ workflowVersion: 2, coverLetterChecks: {} })}\n`,
      ),
      writeFile(outputPath, "sentinel output\n"),
    ]);

    await expectFailure(
      runScript(COVER_SCRIPT, [
        inputPath,
        "--role",
        "Service Designer",
        "--company",
        "Example Systems",
        "--min-words",
        "1",
        "--max-words",
        "100",
        "--output",
        outputPath,
      ]),
      /Markdown confirmation is required/i,
    );
    assert.equal(await readFile(outputPath, "utf8"), "sentinel output\n");
  });
});

test("cover generator rejects explicit unsupported workflow versions", async () => {
  for (const workflowVersion of ["2", 3, null]) {
    await withTempDirectory(async (directory) => {
      const inputPath = path.join(directory, "cover-letter.md");
      const outputPath = path.join(directory, "cover-letter.html");
      const sentinel = "sentinel output\n";
      await Promise.all([
        copyFile(path.join(FIXTURES, "cover-letter-short.md"), inputPath),
        writeFile(
          path.join(directory, "workflow-state.json"),
          `${JSON.stringify({
            workflowVersion,
            coverLetterChecks: { markdown: "confirmed" },
          })}\n`,
        ),
        writeFile(outputPath, sentinel),
      ]);

      await expectFailure(
        runScript(COVER_SCRIPT, [
          inputPath,
          "--role",
          "Service Designer",
          "--company",
          "Example Systems",
          "--min-words",
          "1",
          "--max-words",
          "100",
          "--output",
          outputPath,
        ]),
        /Unsupported workflowVersion/,
      );
      assert.equal(await readFile(outputPath, "utf8"), sentinel);
    });
  }
});

test("default and custom templates keep STYLES_HREF in the stylesheet link", async () => {
  for (const templatePath of [
    DEFAULT_COVER_TEMPLATE,
    path.join(FIXTURES, "custom-cover-template.html"),
  ]) {
    const template = await readFile(templatePath, "utf8");
    assert.match(
      template,
      /<link\b[^>]*rel="stylesheet"[^>]*href="\{\{STYLES_HREF\}\}"/i,
    );
  }
});
