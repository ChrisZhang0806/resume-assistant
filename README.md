# Resume Assistant Skill And Starter Workspace

This repository distributes:

- `codex-skills/resume-assistant/`: an installable Codex Skill;
- `starter-workspace/`: a private working template for verified, job-specific resumes, cover letters, PDFs, and application tracking.

The included resume is a one-page A4 ATS-oriented starting point, not a requirement. Users may provide another semantic HTML/CSS template and explicit page target.

![Resume Assistant workflow overview](starter-workspace/docs/workflow-overview-image2.png)

## Repository Roles

| Location | Responsibility |
| --- | --- |
| `codex-skills/resume-assistant/SKILL.md` | Minimal cross-workspace Skill contract |
| `codex-skills/resume-assistant/references/` | Fallback when local workflow instructions are absent |
| `starter-workspace/AGENTS.md` | Short always-on local rules and phase router |
| `starter-workspace/workflows/` | Phase-specific setup, analysis, resume, cover-letter, and tracking rules |
| `starter-workspace/master/` | Reusable verified fact-base template |
| `starter-workspace/base/` | Reusable HTML/CSS templates |
| `starter-workspace/applications/` | Private job-specific outputs |

## Install The Skill

```bash
mkdir -p ~/.codex/skills/resume-assistant
cp -R codex-skills/resume-assistant/. ~/.codex/skills/resume-assistant/
```

The installed Skill is a copy. Reinstall after changing repository Skill files, then start a new Codex task.

## Create A Private Workspace

```bash
cp -R starter-workspace ~/Documents/my-resume-assistant
cd ~/Documents/my-resume-assistant
npm install
npm run doctor
```

Then follow `FIRST-TIME-SETUP.md`, optional `USER-INTAKE.md`, and the workspace `README.md`.

## Workflow

1. Build a reusable fact base and base HTML/CSS template.
2. Capture visible job-page text and import it with the original URL plus `--browser-text`.
3. Keep complete source in `job-posting.txt`, compact conclusions in `job-analysis.md`, and v2 machine state in `workflow-state.json`.
4. Confirm analysis, then rewrite only application-local HTML/CSS.
5. Run ATS, layout, PDF, and actual page-count checks.
6. Generate compare only when requested.
7. If needed, confirm cover-letter Markdown before rendering HTML/PDF.
8. Track status only from explicit user intent; never infer submission.

The only default confirmation gates are job analysis and cover-letter Markdown.

## Custom Templates

The agent can rebuild a reusable template from HTML/CSS, PDF, DOCX, screenshot/image, Figma reference, exported CSS, or design notes. The result should use semantic selectable text and real links, not an image-only page.

Review multi-column reading order, icon-only labels, tables, charts, skill bars, portraits, QR codes, image text, and heavy absolute positioning before adopting a visually complex template.

![Base resume template preview](starter-workspace/docs/base-resume-template.png)

## Privacy

Treat every filled working copy as private. Before publishing, check for real facts, contact details, portfolio links, job text, browser captures, generated files, application records, local instructions, temporary files, and research reports.

`.gitignore` is a safety layer, not a guarantee. Create public changes from a clean checkout and review staged files explicitly.

## License

MIT. See `LICENSE`.
