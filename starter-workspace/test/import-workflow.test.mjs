import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(TEST_DIR, "..");
const IMPORT_SCRIPT = path.join("scripts", "import-job.mjs");

function runImport(args, cwd = WORKSPACE) {
  return spawnSync(process.execPath, [IMPORT_SCRIPT, ...args], {
    cwd,
    encoding: "utf8",
  });
}

async function withTempDir(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "resume-import-test-"));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function digest(content) {
  return createHash("sha256").update(content).digest("hex");
}

test("v2 import separates complete source, compact analysis, and core state", async () => {
  await withTempDir(async (outputRoot) => {
    const result = runImport([
      "scripts/fixtures/sample-job.html",
      "--out-root",
      outputRoot,
      "--date",
      "2026-07-10",
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const application = path.join(outputRoot, "2026-07-10-acme-studio-product-designer");
    const [analysis, source, rawState] = await Promise.all([
      readFile(path.join(application, "job-analysis.md"), "utf8"),
      readFile(path.join(application, "job-posting.txt"), "utf8"),
      readFile(path.join(application, "workflow-state.json"), "utf8"),
    ]);
    const state = JSON.parse(rawState);

    assert.match(analysis, /workflow-version: 2/);
    assert.match(analysis, /State file: `workflow-state\.json`/);
    assert.match(analysis, /Modification plan: present after analysis confirmation; not a separate gate/);
    assert.doesNotMatch(analysis, /## Full Job Description/);
    assert.match(source, /Product Designer/);
    assert.match(source, /design systems and accessibility/i);
    assert.equal(state.workflowVersion, 2);
    assert.equal(state.stage, "imported");
    assert.equal(state.decisions.analysisConfirmed, false);
    assert.equal(state.decisions.analysisConfirmation, "pending");
    assert.equal(state.source.sha256, digest(source));
    assert.deepEqual(Object.keys(state).sort(), [
      "applicationDate",
      "applicationFolder",
      "checks",
      "decisions",
      "job",
      "outputs",
      "source",
      "stage",
      "template",
      "updatedAt",
      "workflowVersion",
    ]);
    assert.deepEqual(state.outputs, {
      jobPosting: "job-posting.txt",
      jobAnalysis: "job-analysis.md",
      workflowState: "workflow-state.json",
    });
    assert.doesNotMatch(analysis, /## Application .* Score/i);
  });
});

test("job URLs require browser text and preserve the original URL", async () => {
  await withTempDir(async (directory) => {
    const outputRoot = path.join(directory, "applications");
    const rejected = runImport([
      "https://example.com/jobs/designer",
      "--out-root",
      outputRoot,
      "--date",
      "2026-07-10",
    ]);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Direct URL fetching is disabled/);

    const visibleTextPath = path.join(directory, "visible-job.txt");
    await writeFile(
      visibleTextPath,
      `Product Designer\nExample Company\n\n${"Design accessible product flows, prototypes, and design-system components with engineers and researchers. ".repeat(8)}`,
      "utf8",
    );
    const imported = runImport([
      "https://example.com/jobs/designer",
      "--browser-text",
      visibleTextPath,
      "--out-root",
      outputRoot,
      "--date",
      "2026-07-10",
      "--company",
      "Example Company",
      "--role",
      "Product Designer",
    ]);
    assert.equal(imported.status, 0, imported.stderr || imported.stdout);

    const application = path.join(outputRoot, "2026-07-10-example-company-product-designer");
    const [analysis, stateText] = await Promise.all([
      readFile(path.join(application, "job-analysis.md"), "utf8"),
      readFile(path.join(application, "workflow-state.json"), "utf8"),
    ]);
    assert.match(analysis, /Captured via: in-app-browser/);
    assert.equal(JSON.parse(stateText).job.source, "https://example.com/jobs/designer");
  });
});

test("keyword inference does not treat training or email as AI", async () => {
  await withTempDir(async (outputRoot) => {
    const sourcePath = path.join(outputRoot, "training-role.txt");
    await writeFile(
      sourcePath,
      "Training Program Designer\nAcme Learning\n\nDesign training materials, email communications, accessible workshops, prototypes, usability tests, stakeholder reviews, and responsive learning content.",
      "utf8",
    );
    const result = runImport([
      sourcePath,
      "--out-root",
      outputRoot,
      "--date",
      "2026-07-10",
      "--company",
      "Acme Learning",
      "--role",
      "Training Program Designer",
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const analysis = await readFile(
      path.join(outputRoot, "2026-07-10-acme-learning-training-program-designer", "job-analysis.md"),
      "utf8",
    );
    const shouldUse = analysis.match(/### Should Use\n\n([\s\S]*?)\n\n### Optional/)?.[1] || "";
    assert.doesNotMatch(shouldUse, /^- AI$/m);
  });
});

test("truncated analysis remains partial while job-posting keeps the complete text", async () => {
  await withTempDir(async (outputRoot) => {
    const sourcePath = path.join(outputRoot, "long-role.txt");
    const longDescription = `Long Role\nAcme\n\n${"Detailed responsibility and qualification. ".repeat(700)}`;
    await writeFile(sourcePath, longDescription, "utf8");

    const result = runImport([
      sourcePath,
      "--out-root",
      outputRoot,
      "--date",
      "2026-07-10",
      "--company",
      "Acme",
      "--role",
      "Long Role",
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const application = path.join(outputRoot, "2026-07-10-acme-long-role");
    const state = JSON.parse(await readFile(path.join(application, "workflow-state.json"), "utf8"));
    const source = await readFile(path.join(application, "job-posting.txt"), "utf8");
    assert.equal(state.job.extractionStatus, "partial");
    assert.ok(source.length > 20_000);
    assert.equal(state.source.sha256, digest(source));
  });
});

test("force replaces the v2 set while preserving unrelated legacy files", async () => {
  await withTempDir(async (directory) => {
    const outputRoot = path.join(directory, "applications");
    const application = path.join(outputRoot, "2026-07-10-acme-studio-product-designer");
    await mkdir(application, { recursive: true });
    await writeFile(path.join(application, "resume.html"), "legacy resume", "utf8");

    const first = runImport([
      "scripts/fixtures/sample-job.html",
      "--out-root",
      outputRoot,
      "--date",
      "2026-07-10",
    ]);
    assert.equal(first.status, 0, first.stderr || first.stdout);

    const replacementPath = path.join(directory, "replacement.txt");
    await writeFile(
      replacementPath,
      `Product Designer\nAcme Studio\n\nREPLACEMENT SOURCE\n${"Build and improve accessible product workflows with a cross-functional team. ".repeat(8)}`,
      "utf8",
    );
    const forced = runImport([
      replacementPath,
      "--out-root",
      outputRoot,
      "--date",
      "2026-07-10",
      "--company",
      "Acme Studio",
      "--role",
      "Product Designer",
      "--force",
    ]);
    assert.equal(forced.status, 0, forced.stderr || forced.stdout);

    const [source, analysis, rawState, legacy] = await Promise.all([
      readFile(path.join(application, "job-posting.txt"), "utf8"),
      readFile(path.join(application, "job-analysis.md"), "utf8"),
      readFile(path.join(application, "workflow-state.json"), "utf8"),
      readFile(path.join(application, "resume.html"), "utf8"),
    ]);
    assert.match(source, /REPLACEMENT SOURCE/);
    assert.match(analysis, new RegExp(digest(source)));
    assert.equal(JSON.parse(rawState).source.sha256, digest(source));
    assert.equal(legacy, "legacy resume");
    assert.equal((await readdir(outputRoot)).some((name) => name.includes(".import-")), false);
  });
});

test("template render failure leaves existing artifacts unchanged", async () => {
  await withTempDir(async (directory) => {
    const miniWorkspace = path.join(directory, "workspace");
    await Promise.all([
      mkdir(path.join(miniWorkspace, "scripts", "fixtures"), { recursive: true }),
      mkdir(path.join(miniWorkspace, "templates"), { recursive: true }),
    ]);
    await Promise.all([
      copyFile(path.join(WORKSPACE, IMPORT_SCRIPT), path.join(miniWorkspace, IMPORT_SCRIPT)),
      copyFile(
        path.join(WORKSPACE, "scripts", "fixtures", "sample-job.html"),
        path.join(miniWorkspace, "scripts", "fixtures", "sample-job.html"),
      ),
    ]);
    const validTemplate = await readFile(
      path.join(WORKSPACE, "templates", "job-analysis-template.md"),
      "utf8",
    );
    await writeFile(
      path.join(miniWorkspace, "templates", "job-analysis-template.md"),
      `${validTemplate}\n{{UNRESOLVED_CORE_FIELD}}\n`,
      "utf8",
    );

    const outputRoot = path.join(directory, "applications");
    const application = path.join(outputRoot, "2026-07-10-acme-studio-product-designer");
    await mkdir(application, { recursive: true });
    const originals = {
      "job-posting.txt": "original source\n",
      "job-analysis.md": "original analysis\n",
      "workflow-state.json": "{\"original\":true}\n",
    };
    await Promise.all(
      Object.entries(originals).map(([name, content]) =>
        writeFile(path.join(application, name), content, "utf8"),
      ),
    );

    const result = runImport([
      "scripts/fixtures/sample-job.html",
      "--out-root",
      outputRoot,
      "--date",
      "2026-07-10",
      "--force",
    ], miniWorkspace);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unresolved job-analysis template fields/);

    for (const [name, content] of Object.entries(originals)) {
      assert.equal(await readFile(path.join(application, name), "utf8"), content);
    }
    assert.equal((await readdir(outputRoot)).some((name) => name.includes(".import-")), false);
  });
});
