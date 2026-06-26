---
name: resume-assistant
description: Tailor verified, job-specific English resumes and cover letters from a Resume Assistant workspace. Use when the user asks Codex to analyze a job posting, import a job URL or pasted description, customize a target resume from base/index.html and master/master-data facts, build or adapt resume/cover letter templates from HTML, PDF, Word, screenshots, or Figma Dev Mode references, assess ATS risks, generate compare previews or PDFs, verify A4 layout with Pretext, draft a cover letter, update application-log.md, or maintain reusable resume facts without inventing experience.
---

# Resume Assistant

## First Steps

1. Read the local project instructions first if present: `AGENTS.md`, `agents.md`, or `Skills.md`. If they conflict with this skill, follow the local project instructions.
2. Read `references/resume-assistant-workflow.md` before executing a resume customization, cover letter, PDF, compare preview, application log update, or master facts update.
3. Confirm the workspace has the required project files: `base/index.html`, `base/styles.css`, `master/master-resume.md`, `master/master-data/`, `scripts/`, `applications/`, and `application-log.md`.
4. Keep all job-specific outputs inside `applications/{yyyy-mm-dd}-{company}-{role}/`; never edit `base/index.html` for a specific job.

## Operating Rules

- Use English for target resumes and cover letters unless the user explicitly asks otherwise.
- When the user has just installed or deployed the skill, opened a fresh starter workspace, or reports that starter placeholders remain, run first-run onboarding before job tailoring. Give the user concrete setup choices: provide an existing resume or template source, complete manual intake facts, and choose the default or custom template path.
- Do not answer first-run setup with only "fill the placeholders." Ask for one useful next input, such as an attached resume PDF/DOCX, screenshots, Figma Dev Mode reference, existing HTML/CSS, pasted work history, or permission to use the default ATS-friendly template.
- Treat verified facts as the boundary. Use only the job posting, `master/master-data/`, `master/master-resume.md`, and the base resume as evidence.
- Mark unsupported job requirements as risks or ask the user for the missing experience. If the gap is found during job-fit analysis and the user responds with concrete reusable experience, treat it as confirmed for this workflow, update the appropriate `master/master-data/` module and `master/master-data/evidence-map.md` by default, record the update in `job-analysis.md`, then tell the user what was updated. If the user volunteers reusable facts outside a missing-evidence analysis question, ask for confirmation before updating the fact base.
- When importing a resume to build the fact base or checking setup readiness, do not treat structural guide phrases such as `target role`, `job family`, `application role`, `user's strongest`, or `strongest evidence` as placeholders. Trust `npm run doctor` placeholder examples or explicit starter prompts such as `Add ...`, `[Your Name]`, `Target keyword 1`, `email@example.com`, and `your-profile`.
- Preserve user edits. Read existing target files and logs before modifying them.
- Use Pretext only for layout, wrapping, and height verification; never as a substitute for factual analysis or ATS reasoning.
- Keep certificates out of Education bullets. If no separate Certification section is used, place certificates in the most relevant Skills group text, not in a heading.
- Write target resumes as credibility summaries, not mini case studies. The resume should make the reader trust the candidate and want to open the portfolio; the portfolio can explain process and storytelling.
- Keep project and experience bullets within rendered line limits: no bullet may exceed three lines; central evidence may use two to three lines, ordinary bullets should fit two lines, and weak or secondary bullets should fit one line.
- Avoid AI-sounding resume copy. Use natural professional language grounded in concrete products, domains, scale, responsibilities, and outcomes; avoid inflated adjectives, generic claims, and overly polished template phrasing.
- For each target resume, copy `base/index.html` to `applications/{folder}/resume.html` and `base/styles.css` to `applications/{folder}/styles.css`. Edit only those application-local copies. Do not modify the base files for a specific job.
- The starter resume template is one-page and ATS-friendly by default, but custom resume and cover letter templates are allowed. If the user declares a custom template or multi-page target, follow the declared page target instead of forcing one page.
- Users do not need an existing HTML resume. During setup, they may provide a PDF, Word document, screenshot, image, Figma Dev Mode reference, exported CSS, or design notes. Rebuild those sources into semantic `base/index.html`, `base/styles.css`, and optionally `base/cover-letter-template.html`.
- If a requested template appears ATS-risky, such as heavy icon use, two-column/sidebar layout, image-based text, decorative charts, tables, or complex visual hierarchy, explain the risk and ask the user to confirm whether to continue before building or using it. Offer an ATS-first adaptation when possible.
- The target resume contact row must stay on one line, must not wrap, and must not exceed the resume width. Shorten the visible LinkedIn text when needed while preserving the link target.
- For the default starter template, do not change target resume side padding. If layout optimization needs gap changes, allowed gap values are only `2px` or `4px`; do not use `3px` or other values. If the user explicitly provides a custom gap rule, follow that user-provided rule, verify with `--allowed-gaps`, and record it. For custom templates, preserve the template's own spacing system unless the user asks for a redesign.
- For the default starter template, do not add inline `<style>` blocks for target resume layout. Do not add vertical spacing with `margin-top` or `margin-bottom` on sections, entries, skill groups, or lists. Do not set `.resume` to `overflow: hidden`, and do not use print CSS to clip or hide overflow. For custom templates, do not use CSS clipping to hide overflow.

## Standard Flow

1. If the workspace is fresh, incomplete, or still contains starter placeholders, first help the user choose a setup path: existing resume import, manual fact intake, default template, or custom template. Do not start job-specific tailoring until the reusable base template and master fact base are ready enough to support verified claims.
2. For every user-provided job URL, first try to open the page in the browser and capture the visible job-detail text, then run `scripts/import-job.mjs` with `--browser-text`. If browser capture is unavailable or incomplete, try other source-specific methods; if those fail, ask the user to paste the visible job description. URL-only fetch is a fallback and must be reviewed for missing content or page noise.
3. Read required master facts and the relevant detailed modules selected by the job type.
4. If setup is incomplete or the user wants a custom template, help create or adapt `base/index.html`, `base/styles.css`, and/or `base/cover-letter-template.html` from the user's source files before tailoring a job.
5. Write `job-analysis.md` with job details, fit, gaps, ATS keywords, evidence mapping, placement strategy, template mode, page target, ATS template risks, layout budget, and writing strategy.
6. Stop for analysis confirmation unless the user explicitly asked to skip confirmation or directly generate.
7. After confirmation, write or present a section-level modification plan, then immediately create and edit `applications/{folder}/resume.html` and `applications/{folder}/styles.css`.
8. Run `node scripts/verify-layout.mjs "applications/{folder}/resume.html" -v`; add `--pages N --custom-template` when the user has a custom or multi-page template. Compress content or use target CSS spacing overrides until the resume fits the declared page target and passes relevant policy checks.
9. After the target resume HTML is generated and verified, ask whether the user wants a compare preview unless they already gave a compare preference. Generate `compare.html` only when requested; otherwise continue to PDF/export and later workflow steps.
10. Export the resume PDF and verify the PDF page count matches the declared page target. The default target is exactly one page.
11. Decide whether a cover letter is required or requested. If yes, draft Markdown first and stop for cover letter confirmation before generating HTML/PDF.
12. Ask before updating `application-log.md`; never mark a job `Submitted` without user confirmation.

## Required Final Delivery

Report the target HTML, target CSS, compare preview path if generated or `Not requested`, resume PDF, `job-analysis.md`, cover letter files if generated, application-log status, Pretext result, PDF page count, key rewrite focus, and any remaining factual risks.
