# Job Discovery Phase

Read this file only when the user asks to find, search, or monitor job openings.

## Purpose

Use the local LinkedIn search command to discover a small set of current leads, then route only user-selected postings into the existing browser capture and import-analysis workflow.

The command reads LinkedIn's public jobs pages without authentication. Automated access may conflict with LinkedIn's Terms of Service. Use it only for personal, low-volume searches: one page and at most 10 results per query, no bulk crawling, no scheduled polling, and no people-profile scraping.

## Search

Build queries from the user's confirmed target roles, location preferences, and `reports/job-search-query-library.md` when present. Prefer two or three focused role queries over one large Boolean query.

```bash
npm run search-jobs -- search \
  --query "Product Designer" \
  --location "Berlin, Germany" \
  --jobage 7 \
  --limit 10 \
  --format json
```

Supported filters:

- `--location` / `-l`: required LinkedIn location string
- `--query` / `-q`: role or keywords
- `--jobage`: postings from the last 0-365 days
- `--remote`: `remote`, `hybrid`, or `onsite`
- `--page`: one LinkedIn result page, 10 jobs per page
- `--limit` / `-n`: 0-10 results
- `--format`: `json`, `table`, or `plain`

Run independent focused queries in parallel when practical. Stop on rate limits; do not retry manually after the command's bounded backoff.

## Review

Treat search output as discovery data, not verified application evidence.

1. Remove exact duplicate URLs and repeated company-title combinations within the current result set.
2. Compare likely matches against `application-log.md` read-only. Do not update the log.
3. Exclude clearly closed, out-of-location, or hard-gate failures when the output proves the issue; otherwise label uncertainty.
4. Present a short table with title, company, location, posting date, URL, and a provisional High / Medium / Low fit.
5. Do not fetch every description. Ask the user which result should enter full analysis.

For one selected listing, optional CLI detail is:

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
5. Continue through the mandatory historical check, E/S/A priority analysis, and analysis confirmation gate.

Do not create a resume, application folder, or `Submitted` log entry from search output alone.
