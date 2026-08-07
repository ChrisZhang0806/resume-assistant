# Job Discovery Phase

Read this file only when the user asks to find, search, or monitor job openings.

## Purpose

Use the local dual-source search command to discover a small set of current leads, then route only user-selected postings into the existing browser capture and import-analysis workflow.

The command reads public LinkedIn and Indeed data without authentication. Automated access may conflict with either platform's Terms of Service. Use it only for personal, low-volume searches: one page per source and at most 10 merged results per query, no bulk crawling, no scheduled polling, and no people-profile scraping.

## Search

Build queries from the user's confirmed target roles, transferable evidence, location preferences, and `reports/job-search-query-library.md` when present. Prefer several focused queries over one large Boolean query because broad full-text searches are noisy.

```bash
npm run search-jobs -- search \
  --query "Product Designer" \
  --location "Toronto, Ontario, Canada" \
  --jobage 7 \
  --limit 10 \
  --format json
```

Supported filters:

- `--location` / `-l`: required location string for both sources; LinkedIn accepts locations worldwide, while Indeed is fixed to Canada
- `--query` / `-q`: role or keywords; `title:"..."` terms are post-filtered against returned titles
- `--jobage`: postings from the last 0-365 days
- `--remote`: `remote`, `hybrid`, or `onsite`; Indeed work mode is filtered heuristically and must be verified from the posting
- `--page`: one result page per source, 10 jobs per page
- `--limit` / `-n`: 0-10 merged, deduplicated results
- `--format`: `json`, `table`, or `plain`

Run independent focused queries in parallel when practical. Stop on rate limits; do not retry manually after the command's bounded backoff.
Check source warnings before reporting coverage; one source may fail while the other still returns results.

## Location Coverage

Do not treat one location string as complete coverage. When relevant to the user's constraints, search these variants separately:

1. Each target city or region.
2. Remote plus the target country, using labels accepted by the platform.
3. The target country without a city constraint.
4. A broader region such as North America or Europe when the user is eligible and the platform accepts it.

Use a 7-day current pass and, when needed, a 30-90-day backfill. Retain older leads only when the original employer or ATS page still accepts applications. Before reporting no suitable results, state which queries, locations, date windows, and sources were actually checked.

## Retrieval Quality Control

Use two passes for each active role family:

1. **Precision pass:** search two to four title aliases, using `title:"..."` when exact title filtering is needed.
2. **Recall pass:** search one responsibility cluster plus one industry or work-context cluster without requiring a title.

Review results before changing the query, and adjust only one dimension at a time:

- If more than half the results are irrelevant, split the title family or tighten one responsibility/context cluster.
- If the query reaches the 10-result limit, treat it as saturated and split it before claiming coverage.
- If fewer than three plausible results appear, widen the location, date window, or one context constraint, not all three together.
- Keep a newly observed title or alias temporary until it recurs across two independent employers or clearly represents a standard job family.

## Review

Treat search output as discovery data, not verified application evidence.

1. Check the automatic company-title-location deduplication and remove any remaining cross-post duplicates.
2. Compare likely matches against `application-log.md` read-only. Do not update the log.
3. Exclude clearly closed, out-of-location, or hard-gate failures when the output proves the issue; otherwise label uncertainty.
4. Do not assign High fit from a title or snippet alone. Verify responsibilities, experience, location, work mode, employment type, and application status from the visible posting; label incomplete postings `Unverified`.
5. Present a short table with source, title, company, location, posting date, URL, and a provisional High / Medium / Low / Unverified fit.
6. Do not fetch every description. Ask the user which result should enter full analysis.

For one selected LinkedIn listing, optional CLI detail is:

```bash
npm run search-jobs -- detail <linkedin-job-id-or-url> --format plain
```

CLI detail helps triage but does not replace the workspace's visible-source rule.

## Route Into Resume Workflow

After the user selects a job:

1. Open the job URL in the in-app browser.
2. Capture the complete visible posting text.
3. Load `workflows/import-analysis.md`.
4. Import with the original URL and `--browser-text`.
5. Continue through the mandatory historical check, requirement-priority analysis, and analysis confirmation gate.

Do not create a resume, application folder, or `Submitted` log entry from search output alone.
