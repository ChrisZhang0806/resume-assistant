import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkApplicationHistory,
  parseApplicationLog,
} from "../scripts/check-application-history.mjs";

const LOG = `# Resume Application Log

| ID | Application Date | Company | Role | Location | Work Arrangement | Salary Range | Job URL | Job Content Summary | Resume PDF | Application Method | Application Status | Follow-up Notes | Recruiter Feedback | Result | Last Updated | Updated By |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-06-24 | Example Product Co. | Product Designer | Remote | Remote | Not disclosed | https://www.linkedin.com/jobs/view/1234567890/?tracking=old | Product design | applications/example/resume.pdf | Online | Submitted | - | - | - | 2026-06-24 | User |
| 2 | 2026-06-26 | Acme Studio | UX Researcher | Toronto | Hybrid | Not disclosed | https://example.com/jobs/ux | Research | applications/acme/resume.pdf | Online | Rejected | - | - | Rejected | 2026-06-27 | User |
`;

const COMPACT_LOG = `# Application Log

| Date | Company | Role | Location | Status | Application Folder | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-06-24 | Example Product Co. | Product Designer | Remote | Submitted | applications/example | First application |
`;

async function withLog(callback, markdown = LOG) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "resume-history-test-"));
  const logPath = path.join(directory, "application-log.md");
  await writeFile(logPath, markdown, "utf8");
  try {
    await callback(logPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("application log parser preserves the fields used for duplicate checks", () => {
  const rows = parseApplicationLog(LOG);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].Company, "Example Product Co.");
  assert.equal(rows[0]["Application Status"], "Submitted");
});

test("application log parser accepts the compact starter schema", () => {
  const rows = parseApplicationLog(COMPACT_LOG);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Company, "Example Product Co.");
  assert.equal(rows[0].Status, "Submitted");
});

test("compact starter rows participate in company-role matching", async () => {
  await withLog(async (logPath) => {
    const result = await checkApplicationHistory({
      logPath,
      company: "Example Product Company",
      role: "Product Designer",
      currentSource: "https://example.com/jobs/product-design",
      checkedAt: "2026-07-13",
    });
    assert.equal(result.matchType, "company-role");
    assert.equal(result.matches[0].applicationDate, "2026-06-24");
    assert.equal(result.matches[0].status, "Submitted");
    assert.equal(result.matches[0].resumePdf, "applications/example");

    const similarRole = await checkApplicationHistory({
      logPath,
      company: "Example Product Co.",
      role: "Senior Product Designer",
      checkedAt: "2026-07-13",
    });
    assert.equal(similarRole.matchType, "same-company-similar-role");
  }, COMPACT_LOG);
});

test("different source URLs still match the same normalized company and role without writing the log", async () => {
  await withLog(async (logPath) => {
    const before = await readFile(logPath, "utf8");
    const result = await checkApplicationHistory({
      logPath,
      company: "Example Product Co.",
      role: "Product Designer",
      currentSource: "https://recruiter.example/jobs/943",
      checkedAt: "2026-07-13",
    });
    const after = await readFile(logPath, "utf8");

    assert.equal(after, before, "history check must be read-only");
    assert.equal(result.status, "complete");
    assert.equal(result.matchType, "company-role");
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].status, "Submitted");
    assert.equal(result.requiresUserDecision, true);
    assert.equal(result.userDecision, "pending");
  });
});

test("tracking-only URL differences are classified as an exact URL match", async () => {
  await withLog(async (logPath) => {
    const result = await checkApplicationHistory({
      logPath,
      company: "Example Product Co.",
      role: "Product Designer",
      currentSource: "https://www.linkedin.com/jobs/view/1234567890/?newTracking=1",
      checkedAt: "2026-07-13",
    });
    assert.equal(result.matchType, "exact-url");
    assert.equal(result.matches[0].matchType, "exact-url");
  });
});

test("unmatched company and role pass without a user decision", async () => {
  await withLog(async (logPath) => {
    const result = await checkApplicationHistory({
      logPath,
      company: "New Company",
      role: "Learning Designer",
      currentSource: "https://example.com/jobs/new",
      checkedAt: "2026-07-13",
    });
    assert.equal(result.matchType, "none");
    assert.deepEqual(result.matches, []);
    assert.equal(result.requiresUserDecision, false);
    assert.equal(result.userDecision, "not-required");
  });
});
