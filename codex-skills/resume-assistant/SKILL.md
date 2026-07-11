---
name: resume-assistant
description: Tailor verified, job-specific English resumes and cover letters from a Resume Assistant workspace. Use for job capture and analysis, target resume HTML/CSS, ATS and layout checks, compare previews, PDFs, cover letters, application tracking, reusable facts, or template setup without inventing experience.
---

# Resume Assistant

## Instruction Loading

1. Look for local `AGENTS.md`, `agents.md`, or `Skills.md`.
2. If local instructions exist, follow their phase router. Do not also load `references/resume-assistant-workflow.md` by default.
3. Open the fallback reference only when local instructions are absent/incomplete or explicitly route to it.
4. If local `.private-rules.md` exists and local instructions require it, read it and keep it private.
5. Load only files needed for the active phase; do not front-load the whole workflow.

## Core Contract

- Use verified candidate facts only. Never invent or upgrade employers, titles, dates, locations, tools, credentials, metrics, outcomes, seniority, work authorization, or application status.
- Preserve user edits. Keep job-specific files under one active `applications/{yyyy-mm-dd-company-role}/`; never edit reusable base HTML/CSS for one job.
- Respect the workspace's declared template and page target. The public starter defaults to one-page A4.
- For HTTP/HTTPS job URLs, capture complete visible job-detail text through the browser and import the original URL with `--browser-text`. URL-only import is not allowed.
- Route through `master/master-data/00-index.md`; search relevant headings before opening one or two detail modules. Do not load the whole evidence map or long narratives by default.
- Keep complete posting text in `job-posting.txt`, compact conclusions and one evidence-placement matrix in `job-analysis.md`, and machine-readable phase/check state in `workflow-state.json` when supported.
- Unsupported requirements remain risks. Confirm missing facts instead of inventing evidence.
- Use Pretext for layout only. Run ATS, layout, export, and actual PDF page-count checks against the same declared target.
- Default cover letter: one A4 page, exactly three short body paragraphs, 220–300 body words, and verified evidence only unless another format is explicitly required.

## Gates And Preferences

Only two gates are mandatory unless explicitly waived:

1. Confirm job analysis before creating/editing the target resume.
2. Confirm cover-letter Markdown before rendering HTML/PDF.

Record/present the resume modification plan and proceed without a separate gate. Compare is optional and non-blocking. Update application tracking only from explicit user intent or status; never infer `Submitted`.

## Standard Route

1. Complete setup when the reusable base or fact base still has explicit placeholders.
2. Capture/import the posting into one active application folder.
3. Retrieve only relevant evidence anchors, classify requirements/ATS terms, map placement, and confirm analysis.
4. Record the plan; copy base HTML/CSS into the application folder and rewrite local files.
5. Run ATS and layout checks; revise supported content without clipping or silently changing the target.
6. Generate compare only when requested, export PDF, and verify actual page count.
7. If needed, draft and confirm the cover letter before rendering/verifying/exporting it.
8. Update tracking only from explicit intent or status.

## Delivery

Report analysis, target HTML/CSS, ATS report, layout result, resume PDF/page count, compare status, cover-letter files when applicable, application-log status, rewrite focus, and remaining factual risks.
