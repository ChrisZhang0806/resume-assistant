# Import And Analysis Phase

Read this file only for job capture, import, fit/ATS analysis, or the analysis confirmation gate.

## Capture And Import

For every HTTP/HTTPS job link, browser-visible job-detail text is mandatory. Open the page, capture the main posting, remove navigation and unrelated content, save it temporarily, then run:

```bash
npm run import-job -- "https://example.com/jobs/role" --browser-text "tmp/job-visible.txt"
```

Do not run URL-only import. If complete text cannot be captured, ask for pasted or attached visible text and still import it with the original URL plus `--browser-text`.

New v2 imports create:

- `job-posting.txt`: complete cleaned source text;
- `job-analysis.md`: compact conclusions and one evidence-placement matrix;
- `workflow-state.json`: source, stage, decisions, template target, checks, and output paths.

`--force` replaces all three control artifacts. Inspect an existing folder before using it. Historical folders without state or with an embedded posting remain valid and are not bulk-migrated.

## Historical Application Preflight

Every new import records a read-only `historyCheck` in `workflow-state.json` and a matching `history-check` block in `job-analysis.md`. For an existing application folder, run:

```bash
npm run check-history -- "applications/{folder}"
```

- If the check is incomplete, stop and resolve the missing company, role, or application log.
- If no match exists, keep `userDecision: "not-required"` and continue.
- If a prior URL, company-role, or same-company similar-role match exists, show the prior date, status, URL, and stored resume/folder when available. Ask whether to stop or continue, then record that explicit decision in both analysis and state.
- Never update `application-log.md`, prior application status, or historical files during this check.

## Selective Fact Retrieval

1. Read `master/master-resume.md` and `master/master-data/00-index.md`.
2. Extract central responsibilities, must-haves, repeated terms, screening tools, and useful nice-to-haves.
3. Search relevant headings and aliases in files named by the index.
4. Open only matching source sections and one or two routed detail modules.
5. Expand only when a distinct high-priority requirement still lacks evidence.

Do not load the complete evidence map, long case study, reflective report, or detailed career narrative by default.

## Analysis Contract

Use `templates/job-analysis-template.md`. Complete job facts, priority rationale, fit, gaps, supported and unsupported ATS terms, evidence anchors, placement strategy, title integrity, writing strategy, template mode, page target, and stated output preferences.

Keep complete source text in `job-posting.txt`. Use one Evidence And Placement Matrix rather than duplicating requirement, keyword, evidence, and placement tables.

Unsupported requirements remain risks. If a focused gap question produces a reusable confirmed fact, update the most specific fact module and relevant evidence-map entry, record it in the analysis, and report the update. Confirm volunteered durable facts outside that gap flow.

## State And Gate

- Import starts at `stage: imported` with analysis confirmation pending.
- After explicit confirmation, set `decisions.analysisConfirmed: true`, `decisions.analysisConfirmation: confirmed`, and `stage: analysis-confirmed`.
- After an explicit waiver, set `decisions.analysisConfirmed: true`, `decisions.analysisConfirmation: waived`, and the same stage.
- Treat state as an index and verify important claims against files.

Present the completed analysis and stop before creating or editing target HTML unless the user explicitly waived this gate. A general request to tailor or generate a resume is not itself a waiver. The later modification plan is recorded, not separately confirmed.
