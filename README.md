# Resume Assistant Skill And Starter Workspace

This repository contains a Codex Skill and a sanitized starter workspace for building an AI-assisted resume tailoring workflow.

The workflow helps an agent create job-specific English resumes from a target job posting, a modular master fact base, and a reusable base resume HTML file. It can also generate cover letters, compare previews, PDFs, and application-log entries while keeping all resume claims grounded in verified facts.

For each target resume, the workflow copies both the base HTML and base CSS into the application folder. Job-specific content and layout tuning should happen only in those application-local copies.

The starter workspace includes a generic ATS-friendly resume template in `starter-workspace/base/index.html`. The default resume layout is designed as a one-page A4 HTML/PDF resume, with layout verification scripts to check height, contact-row overflow, padding changes, unsafe CSS, and other common formatting failures. This default is not mandatory: users can replace the resume and cover letter templates with their own HTML/CSS and declare a different page target. Users do not need to start with HTML; the workflow can help recreate a template from a PDF, Word/DOCX resume, screenshot, image, Figma Dev Mode reference, exported CSS, or design notes.

## Workflow Overview

The workspace separates reusable source material from job-specific outputs. User inputs and verified facts feed the master fact base. The base resume provides the reusable layout. For every target job, the agent analyzes the posting, copies the base resume into an application folder, rewrites only the application-local target files, verifies layout, and exports final deliverables.

![Resume Assistant workflow overview](starter-workspace/docs/workflow-overview-image2.png)

## Base Resume Template Preview

The starter workspace includes a reusable one-page base resume template that can be copied into each target application folder before job-specific rewriting.

![Base resume template preview](starter-workspace/docs/base-resume-template.png)

## What Is Included

- `codex-skills/resume-assistant/`: installable Codex Skill for the Resume Assistant workflow.
- `starter-workspace/`: sanitized workspace that users copy privately before adding personal facts.
- `starter-workspace/base/`: reusable one-page ATS-friendly resume template, CSS, and cover letter template.
- `starter-workspace/docs/`: README images for the workflow overview and base resume template preview.
- `starter-workspace/master/`: modular master fact base.
- `starter-workspace/applications/`: generated job-specific resumes, cover letters, compare previews, PDFs, and job analyses.
- `starter-workspace/application-log.md`: sanitized application tracking template.
- `starter-workspace/templates/custom-template-intake.md`: checklist for creating a custom template from PDF, Word/DOCX, screenshots, Figma references, or design notes.

## Recommended Use

Use the starter workspace as a private workspace. Resume facts, target resumes, PDFs, application logs, and imported job descriptions often contain personal data and should not be committed to a public repository.

## Custom Templates

The included template is meant to be a safe default, not a lock-in. Users may replace:

- `starter-workspace/base/index.html`
- `starter-workspace/base/styles.css`
- `starter-workspace/base/cover-letter-template.html`

Template sources can include:

- Existing HTML/CSS.
- PDF resume.
- Word or DOCX resume.
- Screenshot or image of a resume design.
- Figma Dev Mode reference, Figma screenshot, or exported design specs.
- Existing website styles, exported CSS, or written design notes.

The agent should rebuild these sources as semantic HTML/CSS with selectable text and real links. It should not create an image-only resume, because that is difficult to edit and weak for ATS parsing.

When using a custom template, tell the agent before tailoring resumes:

- Whether the resume template is default or custom.
- Template source type.
- Resume page target: 1 page, 2 pages, or another explicit limit.
- Cover letter page target: 1 page, 2 pages, or another explicit limit.
- Whether strict one-page output is required.
- Whether the template uses different section class names or a different contact/header structure.

Some visual resume designs are less ATS-friendly. If the source design uses many icons, two columns, a sidebar, tables, charts, skill bars, image-based text, portraits, QR codes, or complex decorative layout, the agent should warn the user and ask for confirmation before building or using it. Users can choose an ATS-first adaptation, a more visual-faithful template with parsing risk, or the default starter template.

For the default starter template, layout verification assumes a one-page A4 resume:

```bash
npm run verify-layout -- "applications/yyyy-mm-dd-company-role/resume.html" -v
```

For a custom two-page resume template, pass the page target and custom-template mode:

```bash
npm run verify-layout -- "applications/yyyy-mm-dd-company-role/resume.html" -v --pages 2 --custom-template
```

Custom templates should still keep job-specific outputs inside `applications/{date-company-role}/`. The agent should copy the custom base HTML/CSS into the application folder and edit only those local copies.

## Recommended Models

This skill works best with a reasoning-capable Codex/OpenAI model that can read multiple local files, edit HTML/CSS/Markdown, run shell commands, and follow evidence and layout constraints across a multi-step workflow.

- **Recommended:** use the strongest reasoning model available in Codex for full resume tailoring, especially when importing job postings, mapping evidence, rewriting bullets, checking layout, exporting PDF, and updating logs. In OpenAI's public [model docs](https://platform.openai.com/docs/models), GPT-5.5 is currently presented as the flagship model for complex reasoning, coding, and professional work.
- **Good alternatives:** use GPT-5.4-class models for normal resume tailoring when cost or availability matters.
- **Lighter tasks:** use smaller models such as GPT-5.4 mini for simple setup help, README edits, small copy changes, script checks, or `npm run doctor` troubleshooting.
- **Avoid for full tailoring:** very small, non-reasoning, or chat-only models. They are more likely to miss unsupported claims, overwrite files, ignore layout limits, or produce AI-sounding resume copy.

Model names and availability change over time. If you are not sure which model to pick, choose the newest high-reasoning Codex model available in your Codex app or CLI.

## Install The Codex Skill

Copy the skill folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
mkdir -p ~/.codex/skills/resume-assistant
cp -R codex-skills/resume-assistant/. ~/.codex/skills/resume-assistant/
```

Then start a new Codex thread and invoke:

```text
Use $resume-assistant to tailor my resume for this job posting.
```

## Start A New Resume Workspace

Copy the sanitized starter workspace into a private working folder:

```bash
cp -R starter-workspace ~/Documents/my-resume-assistant
cd ~/Documents/my-resume-assistant
npm install
npm run doctor
```

Then follow:

1. `FIRST-TIME-SETUP.md`
2. `USER-INTAKE.md`
3. `AGENTS.md`

## After Deployment: What To Do Next

After installing the skill and copying `starter-workspace/` into a private folder, the user should choose a setup path before tailoring jobs:

1. Use an existing resume: provide a PDF, Word/DOCX file, screenshot, image, Figma Dev Mode reference, existing HTML/CSS, exported CSS, or design notes.
2. Start without a resume: fill `USER-INTAKE.md` or paste work history, projects, education, skills, target roles, and contact details so the agent can build `master/master-data/`.
3. Choose a template path: use the built-in one-page ATS-friendly template, or ask the agent to rebuild a custom resume and cover letter template from the user's source files.

Useful first message in a new Codex thread:

```text
Use $resume-assistant to set up my resume workspace. I can provide [existing resume / work history / custom template source]. Please help me build the master fact base, choose a resume template, and prepare the workspace before tailoring jobs.
```

If the user wants a custom template with many icons, two columns, a sidebar, tables, charts, skill bars, image-based text, portraits, QR codes, or complex decorative layout, the agent should explain the ATS risk and ask whether to use an ATS-first adaptation, the visual-faithful design, or the default template.

## Usage Flow

The intended workflow is:

1. Install the skill into `~/.codex/skills/resume-assistant`.
2. Copy `starter-workspace/` into a private local workspace.
3. Decide whether to use the built-in template or create a custom template from HTML, PDF, Word/DOCX, screenshot, image, Figma Dev Mode, exported CSS, or design notes.
4. Fill the base resume and modular `master/master-data/` fact base with verified personal facts.
5. Run `npm install` and `npm run doctor`. On a fresh starter workspace, doctor runs strict first-run checks for setup docs, privacy defaults, and a clean `applications/` folder. Later runs automatically become workspace-friendly and non-blocking for existing application outputs.
6. Start a Codex thread and ask `$resume-assistant` to tailor the resume for a job URL or pasted job description.
7. Let the skill create `applications/{yyyy-mm-dd-company-role}/job-analysis.md` and present the job-fit analysis for confirmation.
8. After confirmation, the skill copies the base resume and CSS into the application folder, rewrites only the local target files, and runs layout verification using the user's declared page target.
9. After the target HTML is verified, choose whether to generate an optional base-vs-target compare preview.
10. Export the resume PDF, confirm the PDF page count matches the user's page target, then decide whether a cover letter is required.
11. If needed, draft and confirm the cover letter before generating HTML/PDF.
12. Update `application-log.md` only after the user confirms the application status.

Useful commands:

Check workspace readiness at any time:

```bash
npm run doctor
```

```bash
npm run import-job -- "https://example.com/jobs/product-designer"
npm run verify-layout -- "applications/yyyy-mm-dd-company-role/resume.html" -v
npm run export-pdf -- "applications/yyyy-mm-dd-company-role/resume.html"
```

For job URLs, prefer opening the page in the browser, copying the visible job detail text, and importing with the original URL plus `--browser-text`:

```bash
npm run import-job -- "https://www.linkedin.com/jobs/view/123" --browser-text "/tmp/job-visible.txt"
```

URL-only import is a fallback. Review the imported `job-analysis.md` for missing job details, login text, recommendations, alerts, or other page noise before continuing.

Generate a compare preview only if the user wants to review the base-vs-target changes:

```bash
npm run compare -- "applications/yyyy-mm-dd-company-role/resume.html"
```

If a cover letter is needed:

```bash
npm run cover-letter -- "applications/yyyy-mm-dd-company-role/cover-letter.md" --role "Role Title" --company "Company Name"
npm run export-pdf -- "applications/yyyy-mm-dd-company-role/cover-letter.html"
```

## Privacy Checklist Before Publishing

Before pushing a fork or modified copy publicly, make sure it does not include:

- Real `master/master-data/` facts.
- Real `master/master-resume.md`.
- Real application-log entries.
- Generated `starter-workspace/applications/` contents.
- Imported job text, screenshots, PDFs, or temporary files.
- Personal contact details, portfolio URLs, phone numbers, or private application notes.

The root `.gitignore` is designed to protect this repository's private working files while allowing the installable skill and sanitized starter workspace to be committed.

## License

MIT. See `LICENSE`.
