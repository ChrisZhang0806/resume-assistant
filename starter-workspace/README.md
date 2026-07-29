# Resume Assistant Workspace

This is the operator quick start for a private Resume Assistant workspace. The included resume is a one-page A4 HTML/PDF template; custom templates and page targets are supported.

Agent policy lives in `AGENTS.md` and phase details under `workflows/`. First-run intake lives in `FIRST-TIME-SETUP.md`.

## First Run

1. Follow `FIRST-TIME-SETUP.md`.
2. Provide an existing resume/template source or complete `USER-INTAKE.md`.
3. Build reusable facts using the real routes in `master/master-data/00-index.md`.
4. Install and validate:

```bash
npm install
npm run audit
npm run verify-layout -- base/index.html -v
```

## Workspace Map

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Short invariant set and phase router |
| `workflows/` | Setup, job discovery, application, and tracking phases |
| `base/` | Reusable resume/CSS and cover-letter layout |
| `master/master-data/00-index.md` | Fact-module router |
| `master/master-data/` | Verified reusable facts |
| `templates/` | Analysis, cover-letter, custom-template, and header aids |
| `applications/` | One private folder per job |
| `application-log.md` | Optional tracking table |
| `scripts/` | Local validation and artifact helpers |

Do not edit base resume files for one job. Targeting belongs in `applications/{yyyy-mm-dd-company-role}/resume.html` and its local `styles.css`.

## Find Jobs

Search LinkedIn's public job listings without an account or API key:

```bash
npm run search-jobs -- search -q "Product Designer" -l "Berlin, Germany" --jobage 7 --limit 10 --format table
```

Retrieve one listing for quick triage:

```bash
npm run search-jobs -- detail 4430123456 --format plain
```

The command is adapted from the MIT-licensed `linkedin-search` CLI in `MadsLorentzen/ai-job-search` and uses the existing Node 20 runtime. LinkedIn automated access may conflict with its Terms of Service; keep use personal and low-volume. Search output is a lead, not verified evidence. Open a selected URL in the in-app browser and follow the normal import flow before analysis or resume work.

## Import A Job

For a URL, capture the complete visible job-detail text in the in-app browser, remove page chrome/noise, save it temporarily, then run:

```bash
npm run import-job -- "https://example.com/jobs/role" --browser-text "tmp/job-visible.txt"
```

URL-only import is disabled. A new v2 folder contains `job-posting.txt`, compact `job-analysis.md`, and `workflow-state.json`. Historical schemas remain supported and are not bulk-migrated.

After completing analysis, confirm it before target resume creation/editing.

## Build And Finalize A Resume

After analysis confirmation, record the modification plan and continue without a separate plan gate:

```bash
npm run check-ats -- "applications/yyyy-mm-dd-company-role/resume.html"
npm run verify-layout -- "applications/yyyy-mm-dd-company-role/resume.html" -v
npm run export-pdf -- "applications/yyyy-mm-dd-company-role/resume.html"
```

For a custom/multi-page template, pass the same declared `--pages N --custom-template` options to layout/export. Final output must pass ATS, layout, PDF creation, and actual page-count checks.

Compare is optional:

```bash
npm run compare -- "applications/yyyy-mm-dd-company-role/resume.html"
```

## Cover Letter

Default format is one A4 page, exactly three short body paragraphs, and 220–300 body words. Draft and confirm Markdown first, then run:

```bash
npm run cover-letter -- "applications/yyyy-mm-dd-company-role/cover-letter.md" --role "Role Title" --company "Company Name"
npm run verify-layout -- "applications/yyyy-mm-dd-company-role/cover-letter.html" -v
npm run export-pdf -- "applications/yyyy-mm-dd-company-role/cover-letter.html"
```

Use renderer and layout overrides only for an explicitly required format.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run doctor` | Check workspace readiness |
| `npm run check:scripts` | Syntax-check helper scripts |
| `npm test` | Run regression tests |
| `npm run audit` | Run syntax, tests, and doctor |
| `npm run search-jobs -- …` | Search or retrieve LinkedIn public job listings |
| `npm run import-job -- …` | Create/import a job workspace |
| `npm run check-ats -- …` | Verify reviewed keyword coverage |
| `npm run verify-layout -- …` | Check height, wrapping, and layout policy |
| `npm run compare -- …` | Generate optional compare preview |
| `npm run cover-letter -- …` | Render confirmed cover-letter Markdown |
| `npm run export-pdf -- …` | Export verified HTML to PDF |
| `npm run serve` | Preview at `http://127.0.0.1:8000/` |

## Gates, Fact Routing, And Privacy

Only analysis confirmation and cover-letter Markdown confirmation block by default. Modification plans, compare preference, and tracking are not extra gates. A generated file never means `Submitted`.

Start fact retrieval with `master/master-resume.md` and `master/master-data/00-index.md`, search relevant headings, and open one or two routed modules. Avoid loading/copying long sources by default.

Keep real facts, contacts, applications, PDFs, job captures, notes, local instructions, and reports out of public repositories. Review staged files even when `.gitignore` is present.
