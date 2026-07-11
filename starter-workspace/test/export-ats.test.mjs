import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertWorkflowConfirmation,
  assertSafeOutputPath,
  ensureOutputDirectory,
  parseArgs,
  parsePdfPageCount,
  resolveLayoutOptions,
  runLayoutVerification,
  updateWorkflowStateAfterExport,
} from "../scripts/export-resume-pdf.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.dirname(TEST_DIRECTORY);
const EXPORT_SCRIPT = path.join(WORKSPACE_ROOT, "scripts/export-resume-pdf.mjs");
const ATS_SCRIPT = path.join(WORKSPACE_ROOT, "scripts/check-ats-keywords.mjs");

async function temporaryDirectory(t, prefix = "resume-export-test-") {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(directory, { force: true, recursive: true }));
  return directory;
}

function runCli(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
  });
}

test("PDF export is fail-closed when layout verification fails", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "resume.html");
  const outputPath = path.join(directory, "resume.pdf");
  const previousPdf = "previous-pdf-remains-intact";

  await writeFile(
    htmlPath,
    `<!doctype html>
<html>
  <head><style>.resume { gap: 8px; }</style></head>
  <body><main class="resume"><header class="resume-header"><h1>Test Candidate</h1></header></main></body>
</html>`,
    "utf8",
  );
  await writeFile(outputPath, previousPdf, "utf8");

  const result = runCli(EXPORT_SCRIPT, [htmlPath, "--output", outputPath]);

  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Layout verification failed/);
  assert.equal(await readFile(outputPath, "utf8"), previousPdf);
});

test("input/output path protection preserves the HTML", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "resume.html");
  const html = '<main class="resume">Original HTML</main>';
  await writeFile(htmlPath, html, "utf8");

  await assert.rejects(
    assertSafeOutputPath(htmlPath, htmlPath),
    /Input and output paths must be different/,
  );

  const result = runCli(EXPORT_SCRIPT, [htmlPath, "--output", htmlPath]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Input and output paths must be different/);
  assert.equal(await readFile(htmlPath, "utf8"), html);
});

test("output parent directories are created before staging", async (t) => {
  const directory = await temporaryDirectory(t);
  const outputPath = path.join(directory, "nested", "exports", "resume.pdf");
  await ensureOutputDirectory(outputPath);
  await access(path.dirname(outputPath));
});

test("layout options support CLI aliases and are forwarded unchanged", () => {
  const args = parseArgs([
    "resume.html",
    "--pages=2",
    "--custom-template",
    "--allowed-gaps",
    "1px,3px",
  ]);
  assert.equal(args.pages, 2);
  assert.equal(args.templateMode, "custom");
  assert.deepEqual(args.allowedGaps, ["1px", "3px"]);

  const resumePath = path.join("fixtures", "resume.html");
  const verifyScript = path.join("scripts", "verify-layout.mjs");
  let invocation;
  runLayoutVerification(
    resumePath,
    { pages: 2, templateMode: "custom", allowedGaps: ["1px", "3px"] },
    {
      verifyScript,
      spawnSyncImpl(command, forwardedArgs, options) {
        invocation = { command, forwardedArgs, options };
        return { status: 0, signal: null };
      },
    },
  );

  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.forwardedArgs, [
    verifyScript,
    resumePath,
    "--pages",
    "2",
    "--template-mode",
    "custom",
    "--allowed-gaps",
    "1px,3px",
  ]);
  assert.deepEqual(invocation.options, { stdio: "inherit" });
});

test("v2 exports require the matching recorded confirmation", () => {
  const statePath = "/synthetic/workflow-state.json";
  assert.throws(
    () =>
      assertWorkflowConfirmation(
        {
          workflowVersion: 2,
          decisions: {
            analysisConfirmed: false,
            analysisConfirmation: "pending",
          },
        },
        "resume",
        statePath,
      ),
    /Analysis confirmation is required/,
  );
  assert.doesNotThrow(() =>
    assertWorkflowConfirmation(
      {
        workflowVersion: 2,
        decisions: {
          analysisConfirmed: true,
          analysisConfirmation: "confirmed",
        },
      },
      "resume",
      statePath,
    ),
  );
  assert.throws(
    () =>
      assertWorkflowConfirmation(
        { workflowVersion: 2, coverLetterChecks: { markdown: "pending" } },
        "coverLetter",
        statePath,
      ),
    /Markdown confirmation is required/,
  );
  assert.doesNotThrow(() =>
    assertWorkflowConfirmation(
      { workflowVersion: 2, coverLetterChecks: { markdown: "waived" } },
      "coverLetter",
      statePath,
    ),
  );
});

test("resume export rejects explicit unsupported workflow versions", () => {
  const statePath = "/synthetic/workflow-state.json";

  for (const workflowVersion of ["2", 3, null]) {
    assert.throws(
      () =>
        assertWorkflowConfirmation(
          {
            workflowVersion,
            decisions: {
              analysisConfirmed: true,
              analysisConfirmation: "confirmed",
            },
          },
          "resume",
          statePath,
        ),
      /Unsupported workflowVersion/,
    );
  }
});

test("workflow state supplies cover-letter layout defaults", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "cover-letter.html");
  await writeFile(htmlPath, '<main class="cover-letter">Letter</main>', "utf8");
  await writeFile(
    path.join(directory, "workflow-state.json"),
    `${JSON.stringify({
      workflowVersion: 2,
      template: {
        resumeMode: "default",
        resumePages: 1,
        coverLetterMode: "custom",
        coverLetterPages: 2,
        allowedGaps: ["1px", "3px"],
      },
    })}\n`,
    "utf8",
  );

  assert.deepEqual(await resolveLayoutOptions(htmlPath), {
    documentType: "coverLetter",
    pages: 2,
    templateMode: "custom",
    allowedGaps: ["1px", "3px"],
  });
});

test("resume state records ATS passed only when ATS actually passed", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "resume.html");
  const statePath = path.join(directory, "workflow-state.json");
  await writeFile(htmlPath, '<main class="resume">Resume</main>', "utf8");
  await writeFile(
    statePath,
    `${JSON.stringify({
      workflowVersion: 2,
      stage: "resume-drafted",
      checks: { ats: "pending", layout: "pending", pdf: "pending" },
    })}\n`,
    "utf8",
  );

  await assert.rejects(
    updateWorkflowStateAfterExport({
      htmlPath,
      documentType: "resume",
      pdfPath: path.join(directory, "resume.pdf"),
      pdfPages: 1,
      atsPassed: false,
    }),
    /without a passed ATS check/,
  );
  let state = JSON.parse(await readFile(statePath, "utf8"));
  assert.equal(state.stage, "resume-drafted");
  assert.equal(state.checks.ats, "pending");

  await updateWorkflowStateAfterExport({
    htmlPath,
    documentType: "resume",
    pdfPath: path.join(directory, "resume.pdf"),
    pdfPages: 1,
    atsPassed: true,
  });
  state = JSON.parse(await readFile(statePath, "utf8"));
  assert.equal(state.checks.ats, "passed");
  assert.equal(state.checks.layout, "passed");
  assert.equal(state.checks.pdf, "passed");
  assert.equal(state.outputs.resumePdf, "resume.pdf");
});

test("workflow-state without job analysis blocks resume export before state changes", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "resume.html");
  const statePath = path.join(directory, "workflow-state.json");
  const initialState = {
    workflowVersion: 2,
    stage: "resume-drafted",
    decisions: {
      analysisConfirmed: true,
      analysisConfirmation: "confirmed",
    },
    checks: { ats: "pending", layout: "pending", pdf: "pending" },
  };
  await writeFile(
    htmlPath,
    '<html><head><style>.resume { gap: 2px; }</style></head><body><main class="resume">Resume</main></body></html>',
    "utf8",
  );
  await writeFile(statePath, `${JSON.stringify(initialState)}\n`, "utf8");

  const result = runCli(EXPORT_SCRIPT, [
    htmlPath,
    "--output",
    path.join(directory, "resume.pdf"),
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /job-analysis\.md not found/);
  assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), initialState);
});

test("confirmation rejection does not create or overwrite the ATS report", async (t) => {
  for (const existingReport of [null, "sentinel ATS report\n"]) {
    const directory = await temporaryDirectory(t, "resume-confirmation-gate-test-");
    const htmlPath = path.join(directory, "resume.html");
    const analysisPath = path.join(directory, "job-analysis.md");
    const statePath = path.join(directory, "workflow-state.json");
    const reportPath = path.join(directory, "ats-keyword-check.md");

    await Promise.all([
      writeFile(
        htmlPath,
        '<html><body><main class="resume"><section class="summary"><p>Product design</p></section></main></body></html>',
        "utf8",
      ),
      writeFile(
        analysisPath,
        "## ATS Keywords\n\n### Must Use\n\n- Product design\n",
        "utf8",
      ),
      writeFile(
        statePath,
        `${JSON.stringify({
          workflowVersion: 2,
          decisions: {
            analysisConfirmed: false,
            analysisConfirmation: "pending",
          },
        })}\n`,
        "utf8",
      ),
      ...(existingReport === null
        ? []
        : [writeFile(reportPath, existingReport, "utf8")]),
    ]);

    const result = runCli(EXPORT_SCRIPT, [
      htmlPath,
      "--output",
      path.join(directory, "resume.pdf"),
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Analysis confirmation is required/);

    if (existingReport === null) {
      await assert.rejects(access(reportPath), { code: "ENOENT" });
    } else {
      assert.equal(await readFile(reportPath, "utf8"), existingReport);
    }
  }
});

test("cover-letter export records separate checks", async (t) => {
  const directory = await temporaryDirectory(t);
  const htmlPath = path.join(directory, "cover-letter.html");
  const statePath = path.join(directory, "workflow-state.json");
  await writeFile(htmlPath, '<main class="cover-letter">Letter</main>', "utf8");
  await writeFile(
    statePath,
    `${JSON.stringify({
      workflowVersion: 2,
      stage: "resume-exported",
      checks: { ats: "passed", layout: "passed", pdf: "passed", pdfPages: 1 },
    })}\n`,
    "utf8",
  );

  await updateWorkflowStateAfterExport({
    htmlPath,
    documentType: "coverLetter",
    pdfPath: path.join(directory, "cover-letter.pdf"),
    pdfPages: 1,
  });
  const state = JSON.parse(await readFile(statePath, "utf8"));
  assert.deepEqual(state.checks, {
    ats: "passed",
    layout: "passed",
    pdf: "passed",
    pdfPages: 1,
  });
  assert.equal(state.stage, "cover-letter-exported");
  assert.deepEqual(state.coverLetterChecks, {
    layout: "passed",
    pdf: "passed",
    pdfPages: 1,
  });
});

test("pure-Node PDF page-count helper reads the page tree", () => {
  const pdf = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Pages /Kids [2 0 R 3 0 R] /Count 2 >>
endobj
2 0 obj
<< /Type /Page /Parent 1 0 R >>
endobj
3 0 obj
<< /Type /Page /Parent 1 0 R >>
endobj
%%EOF`, "latin1");

  assert.equal(parsePdfPageCount(pdf), 2);
  assert.throws(
    () => parsePdfPageCount(Buffer.from("%PDF-1.7\n%%EOF", "latin1")),
    /No readable PDF page tree/,
  );
});

test("ATS check fails when an unsupported keyword is visibly present", async (t) => {
  const directory = await temporaryDirectory(t, "resume-ats-test-");
  const resumePath = path.join(directory, "resume.html");
  const analysisPath = path.join(directory, "job-analysis.md");
  const reportPath = path.join(directory, "ats-report.md");
  await writeFile(
    analysisPath,
    `## ATS Keywords

### Must Use

- User research

### Unsupported / Do Not Use

- Kubernetes
`,
    "utf8",
  );
  await writeFile(
    resumePath,
    `<!doctype html><html><body><main class="resume">
      <section class="summary"><p>User research shaped the product direction.</p></section>
      <section><h2>Skills</h2><p>Kubernetes</p></section>
    </main></body></html>`,
    "utf8",
  );

  const result = runCli(ATS_SCRIPT, [
    resumePath,
    "--analysis",
    analysisPath,
    "--report",
    reportPath,
  ]);
  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Remove every Unsupported \/ Do Not Use keyword/);
  assert.match(await readFile(reportPath, "utf8"), /Unsupported Keyword Removal Required/);
});

test("hidden content neither satisfies Must Use nor triggers unsupported coverage", async (t) => {
  const directory = await temporaryDirectory(t, "resume-ats-test-");
  const resumePath = path.join(directory, "resume.html");
  const analysisPath = path.join(directory, "job-analysis.md");
  const reportPath = path.join(directory, "ats-report.md");
  await writeFile(
    analysisPath,
    `## ATS Keywords

### Must Use

- Kubernetes

### Unsupported / Do Not Use

- Terraform
`,
    "utf8",
  );
  await writeFile(
    resumePath,
    `<!doctype html><html><body><main class="resume">
      <script>Kubernetes Terraform</script>
      <style>.keyword::after { content: "Kubernetes Terraform"; }</style>
      <p hidden>Kubernetes Terraform</p>
      <p aria-hidden="true">Kubernetes Terraform</p>
      <p style="display: none">Kubernetes Terraform</p>
      <p class="sr-only">Kubernetes Terraform</p>
      <section class="summary"><p>Visible product design experience.</p></section>
    </main></body></html>`,
    "utf8",
  );

  const result = runCli(ATS_SCRIPT, [
    resumePath,
    "--analysis",
    analysisPath,
    "--report",
    reportPath,
  ]);
  const report = await readFile(reportPath, "utf8");
  assert.notEqual(result.status, 0);
  assert.match(report, /\| Must Use \| Kubernetes \| Missing \|/);
  assert.match(report, /\| Unsupported \/ Do Not Use \| Terraform \| Missing \|/);
  assert.doesNotMatch(report, /Unsupported Keyword Removal Required/);
});

test("ATS report cannot overwrite either input", async (t) => {
  const directory = await temporaryDirectory(t, "resume-ats-test-");
  const resumePath = path.join(directory, "resume.html");
  const analysisPath = path.join(directory, "job-analysis.md");
  const resume = '<main class="resume"><p>User research</p></main>';
  const analysis = "## ATS Keywords\n\n### Must Use\n\n- User research\n";
  await writeFile(resumePath, resume, "utf8");
  await writeFile(analysisPath, analysis, "utf8");

  for (const protectedPath of [resumePath, analysisPath]) {
    const result = runCli(ATS_SCRIPT, [
      resumePath,
      "--analysis",
      analysisPath,
      "--report",
      protectedPath,
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ATS report must not overwrite/);
  }
  assert.equal(await readFile(resumePath, "utf8"), resume);
  assert.equal(await readFile(analysisPath, "utf8"), analysis);
});
