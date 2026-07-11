# Resume Rewrite And Finalization Phase

Read this file after analysis confirmation, or when diagnosing/finalizing an existing target resume.

## Read First

- confirmed `job-analysis.md` and adjacent `workflow-state.json`, when present;
- existing application-local `resume.html` and `styles.css`, when present;
- `master/master-data/00-index.md`;
- only source headings/modules referenced by the confirmed evidence plan.

Do not inspect other application folders to infer strategy or status. Legacy folders remain valid and do not require migration.

## Create And Rewrite

1. Record a section-level modification plan in `job-analysis.md`; it is not a confirmation gate.
2. Copy base HTML/CSS into the application folder when local targets do not exist.
3. Preserve user edits, semantic structure, links, truthful formal history, and local stylesheet references.
4. Rewrite only from confirmed evidence anchors.
5. Record changed sections and relative output paths. For v2, use `stage: resume-drafted` after local files exist.

Write a credibility summary, not a mini case study. Each bullet should combine a contribution with context, problem, value, scale, or relevance. No bullet may exceed three rendered lines.

## ATS Gate

```bash
npm run check-ats -- "applications/{folder}/resume.html"
```

Every supported Must Use term must appear naturally. Reclassify unsupported terms as risks instead of forcing them into the resume. Rerun ATS after keyword-bearing content changes.

## Layout Gate

Default one-page A4 template:

```bash
npm run verify-layout -- "applications/{folder}/resume.html" -v
```

Custom/multi-page template:

```bash
npm run verify-layout -- "applications/{folder}/resume.html" -v --pages N --custom-template
```

Fix invalid or overlong bullets first, then shorten near-wrap text, move compact supported terms to Skills, and merge/remove weak evidence. Only after content is concise should application-local default-template gaps use allowed values. Never clip content, hide print content, reduce side padding/global font size, or silently change the page target.

## Compare And PDF

Compare is optional and non-blocking. Generate it only when requested:

```bash
npm run compare -- "applications/{folder}/resume.html"
```

After ATS and layout pass:

```bash
npm run export-pdf -- "applications/{folder}/resume.html"
```

Export is fail-closed. Confirm the PDF is non-empty and its actual page count matches the declared target. Record ATS, layout, compare status, PDF path, and page count in the analysis/state.

For a v2 folder, export also requires `decisions.analysisConfirmed: true` and `decisions.analysisConfirmation: confirmed|waived`; legacy folders without state remain compatible.
