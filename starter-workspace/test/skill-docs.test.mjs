import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(testDir, "..");
const repositoryDir = path.resolve(workspaceDir, "..");
const agentsPath = path.join(workspaceDir, "AGENTS.md");
const skillPath = path.join(repositoryDir, "codex-skills", "resume-assistant", "SKILL.md");

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "SKILL.md must start with YAML frontmatter");
  return Object.fromEntries(
    match[1].split("\n").map((line) => {
      const separator = line.indexOf(":");
      assert.ok(separator > 0, `invalid frontmatter line: ${line}`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
  );
}

test("workspace phase routes remain present and bounded", async () => {
  const agents = await readFile(agentsPath, "utf8");
  const phaseFiles = [
    "setup.md",
    "job-search.md",
    "import-analysis.md",
    "resume-finalize.md",
    "cover-letter.md",
    "application-log.md",
  ];

  for (const filename of phaseFiles) {
    const relativePath = `workflows/${filename}`;
    assert.match(agents, new RegExp(relativePath.replace(".", "\\.")));
    const contents = await readFile(path.join(workspaceDir, relativePath), "utf8");
    assert.ok(Buffer.byteLength(contents) <= 12_000, `${relativePath} exceeds 12 KB`);
  }

  assert.ok(Buffer.byteLength(agents) <= 15_000, "AGENTS.md exceeds its always-on budget");

  const [coverWorkflow, coverGuidelines] = await Promise.all([
    readFile(path.join(workspaceDir, "workflows", "cover-letter.md"), "utf8"),
    readFile(
      path.join(workspaceDir, "templates", "cover-letter-writing-guidelines.md"),
      "utf8",
    ),
  ]);
  assert.match(coverWorkflow, /Choose The Letter's One Job/);
  assert.match(coverWorkflow, /Candidate Fingerprint And Rewrite Loop/);
  assert.match(coverGuidelines, /company-product user is never required/i);
});

test("repository skill metadata and instruction budget remain valid", async (t) => {
  try {
    await access(skillPath);
  } catch {
    t.skip("standalone starter copy has no adjacent Skill source");
    return;
  }

  const [skill, agents] = await Promise.all([
    readFile(skillPath, "utf8"),
    readFile(agentsPath, "utf8"),
  ]);
  const metadata = parseFrontmatter(skill);

  assert.deepEqual(Object.keys(metadata).sort(), ["description", "name"]);
  assert.match(metadata.name, /^[a-z0-9-]+$/);
  assert.ok(metadata.name.length <= 64);
  assert.ok(metadata.description.length > 0 && metadata.description.length <= 1024);
  assert.doesNotMatch(metadata.description, /[<>]/);
  assert.ok(
    Buffer.byteLength(skill) + Buffer.byteLength(agents) <= 20_000,
    "always-on Skill and workspace instructions exceed 20 KB",
  );

  await readFile(
    path.join(
      repositoryDir,
      "codex-skills",
      "resume-assistant",
      "references",
      "resume-assistant-workflow.md",
    ),
    "utf8",
  );
});
