# Resume Assistant Workflow Reference

Use this standalone fallback only when a workspace has no complete local `AGENTS.md`, `agents.md`, or `Skills.md`. Do not load it in addition to a complete local phase router.

## Purpose

Find a small set of current job leads when requested, then create truthful, job-specific English resumes from a complete selected posting, a reusable fact base, and a base HTML/CSS template. Optional outputs include compare previews, cover letters, PDFs, and application tracking.

## Invariants

- Use verified facts only; never invent or upgrade history, evidence, credentials, metrics, status, or authorization.
- Preserve user edits and keep each job under one `applications/{yyyy-mm-dd-company-role}/` folder.
- Never edit reusable base HTML/CSS for one application.
- Respect the declared template/page target; the public starter defaults to one-page A4.
- Use semantic selectable text and real links; explain ATS risk for visually complex layouts.
- Read one active application by default; do not scan or bulk-migrate historical folders.

## Setup

Before the first job, build a truthful base resume and modular fact base. Start from an existing resume, confirmed work history, intake answers, or a custom-template reference. Use `master/master-data/00-index.md` as the authoritative router.

Treat working copies as private. Do not publish filled facts, contacts, application records, imported postings, generated documents, or local private instructions.

## Capture And Import

When the user asks to find jobs and the workspace provides a local search phase, run focused, personal, low-volume searches and present a provisional shortlist. Treat results as leads, do not fetch people profiles or create application files, and wait for the user to select a posting.

For every HTTP/HTTPS job URL, open the page in the browser, capture complete visible job-detail text, remove page chrome/noise, and import the original URL with `--browser-text`. URL-only import is forbidden. If capture is incomplete, request pasted/attached visible text.

New v2 folders use:

- `job-posting.txt` for complete cleaned source text;
- `job-analysis.md` for compact conclusions and one evidence-placement matrix;
- `workflow-state.json` for source, stage, decisions, template target, checks, and outputs.

Legacy folders without state remain supported.

## Selective Analysis

Read `master/master-resume.md` and `master/master-data/00-index.md`, search relevant headings/aliases, then open only matching source sections and one or two routed detail modules. Expand only for a distinct central evidence gap.

Analysis must cover job facts, requirement priority, fit, gaps, ATS terms, verified evidence anchors, placement, truthful title strategy, template/page target, layout budget, writing strategy, and known output preferences. Unsupported requirements remain risks.

When a focused evidence question produces a reusable confirmed fact, update the most specific module and relevant evidence-map entry, record it, and report it. Confirm volunteered durable facts outside that flow.

## Confirmation Gates

Unless explicitly waived:

1. Confirm `job-analysis.md` before creating/editing target resume files.
2. Confirm `cover-letter.md` before rendering cover-letter HTML/PDF.

The resume modification plan is not another gate. Compare is optional and non-blocking. Application-log work requires explicit tracking intent or a supplied status.

## Rewrite And Validate

After analysis confirmation, copy base HTML/CSS into the application folder, record a section plan, and rewrite only from confirmed evidence anchors. Preserve formal employers, titles, dates, locations, semantic structure, and real links.

Write a credibility summary rather than a mini case study. Central bullets may use two to three rendered lines; ordinary bullets should fit two; none may exceed three.

Run:

```bash
npm run check-ats -- "applications/{folder}/resume.html"
npm run verify-layout -- "applications/{folder}/resume.html" -v
```

For overflow, fix weak/overlong bullets, shorten near-wrap text, move compact supported terms to Skills, merge/remove weak evidence, then use only allowed local gap adjustments. Never clip/hide content, reduce global font/side padding, or silently change the page target.

Generate compare only when requested:

```bash
npm run compare -- "applications/{folder}/resume.html"
```

After ATS and layout pass:

```bash
npm run export-pdf -- "applications/{folder}/resume.html"
```

Export is fail-closed. Confirm the PDF is non-empty and actual page count matches the declared target.

## Cover Letter

Write one only when required or requested. Use confirmed analysis/resume, contact facts, and one primary evidence source. Default to exactly three short body paragraphs and 220–300 body words on one A4 page unless another format is explicitly required.

Choose one important question the resume leaves unanswered. Build around one primary proof point, at least two verified candidate-specific details, and one observation, judgment, trade-off, or genuine work preference. Do not force company praise, product use, hobbies, or personal disclosure. Require resume novelty, role-swap, read-aloud, fact, and format checks. When `$humanizer` is installed, apply the workspace guardrails after the evidence draft and review its diff.

After Markdown confirmation:

```bash
npm run cover-letter -- "applications/{folder}/cover-letter.md" --role "Role Title" --company "Company Name"
npm run verify-layout -- "applications/{folder}/cover-letter.html" -v
npm run export-pdf -- "applications/{folder}/cover-letter.html"
```

Match explicit overrides with renderer/layout options and verify names, evidence, links, layout, PDF path, and actual page count.

## Application Log And Delivery

Update tracking only from explicit intent/status and never infer `Submitted`. Validate a stored hash before changing a hashed log, preserve manual edits, and make the narrow authorized update.

Report analysis, target HTML/CSS, ATS/layout results, resume PDF/page count, compare status, cover-letter outputs when applicable, log status, rewrite focus, and remaining factual risks.
