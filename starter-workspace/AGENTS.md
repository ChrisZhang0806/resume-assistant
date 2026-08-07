# Resume Assistant Agent Guide

This is the short, always-on contract for this workspace. Load detailed instructions only for the active phase.

## Instruction Priority

1. Follow the user's current request.
2. Follow `.private-rules.md` when it exists; keep it private.
3. Follow this file.
4. Follow the one relevant phase document under `workflows/`.
5. Use templates as implementation aids, not higher-priority policy.

Preserve user edits. Private rules may specialize defaults but never authorize invented resume facts.

## Phase Router

| Active task | Read |
| --- | --- |
| New workspace, intake, base template, reusable facts | `workflows/setup.md` |
| Find or shortlist current job openings | `workflows/job-search.md` |
| Capture job, import posting, fit/ATS analysis | `workflows/import-analysis.md` |
| Rewrite resume, ATS/layout checks, compare, PDF | `workflows/resume-finalize.md` |
| Draft or render a cover letter | `workflows/cover-letter.md` |
| Read or update application tracking | `workflows/application-log.md` |

For an end-to-end task, load the next phase only when reached. `README.md` is user documentation, not required execution context.

## Core Files

- `base/index.html`, `base/styles.css`: reusable resume source; never edit them for one job.
- `base/cover-letter-template.html`: reusable cover-letter layout.
- `master/master-resume.md`: short fact-base entry point.
- `master/master-data/00-index.md`: authoritative fact-module router.
- `applications/{yyyy-mm-dd-company-role}/`: all files for one job.
- `job-posting.txt`: complete captured posting.
- `job-analysis.md`: compact conclusions, evidence anchors, placement, and decisions.
- `workflow-state.json`: v2 source, stage, decisions, template target, checks, and outputs.

## Active Application Boundary

- Resolve one active application folder from the request, import result, or explicit path.
- Read and write only that folder by default; do not scan historical applications for context or status.
- The read-only historical preflight may inspect `application-log.md`; inspect a prior folder only when a matching log row points to it.
- Keep full source text in `job-posting.txt` and analysis concise.
- Verify important state against actual artifacts.
- Legacy folders without state or with an embedded posting remain supported; do not bulk-migrate them.

For v2 use `imported` → `analysis-confirmed` → `resume-drafted` → `resume-exported`, followed by cover-letter stages when applicable. After analysis approval/waiver, set `decisions.analysisConfirmed: true` and `decisions.analysisConfirmation: confirmed|waived`. Record relative artifact paths under `outputs`.

## Non-Negotiable Invariants

- Write target resumes and cover letters in English unless requested otherwise.
- Use only verified candidate facts. Never invent or upgrade employers, titles, dates, locations, tools, credentials, metrics, outcomes, seniority, work authorization, or application status.
- Mark unsupported requirements as risks and ask for missing evidence when it could change the strategy.
- Update durable facts only through the evidence-confirmation rules in the active phase.
- Copy base HTML/CSS into the application folder and edit only local copies.
- Keep job-specific artifacts in the matching folder and temporary browser text under ignored workspace `tmp/`.
- The public starter defaults to one-page A4. Respect a recorded custom template or page target.
- Rebuild visual references as semantic HTML/CSS with selectable text and real links.
- Explain ATS risk before adopting columns, icon-only labels, layout tables, charts, skill bars, portraits, QR codes, image text, or heavy absolute positioning.
- Use Pretext for layout and wrapping only, not factual or ATS reasoning.

## Job Source Rule

Automated search results are discovery leads, not verified evidence. Keep searches personal and low-volume, then route a selected result through the visible-source rule below.

For every HTTP/HTTPS job URL:

1. Open it in the in-app browser and capture the main visible posting.
2. Remove navigation, login prompts, recommendations, ads, and footers.
3. Import the original URL with `--browser-text FILE`.
4. If capture is incomplete, request pasted/attached visible text and still use `--browser-text`.

Do not use URL-only import. Local or pasted text may be imported directly when no URL is involved.

## Historical Application Preflight

Run the read-only history check before fit/ATS analysis. New imports record it automatically; for an existing folder run `npm run check-history -- "applications/{folder}"`.

- No match: continue with `userDecision: not-required`.
- Any URL, company-role, or same-company similar-role match: show the prior record and require an explicit `stop` or `continue` decision.
- Never update the log, prior status, or historical files during this check.

## Token-Efficient Fact Routing

- Start with `master/master-resume.md` and `master/master-data/00-index.md`.
- Search relevant headings, keywords, aliases, and source anchors before opening detail modules.
- Open one or two routed modules; expand only for a distinct high-priority evidence gap.
- Do not load the entire evidence map, long case study, reflective report, or detailed career narrative by default.
- Record source file and heading anchors rather than copying long fact passages.

## Confirmation Gates

Exactly two gates are mandatory unless explicitly waived:

1. Confirm `job-analysis.md` before creating/editing the target resume.
2. Confirm `cover-letter.md` before rendering its HTML/PDF.

The resume modification plan is recorded, not separately confirmed. Compare is an optional non-blocking preference. Update the application log only from an explicit tracking request or supplied status; never infer `Submitted`.

## Analysis And Writing

Analysis covers job facts, requirement priority, fit, gaps, ATS terms, verified evidence anchors, placement, title integrity, template/page target, layout budget, writing strategy, and known output preferences. Keep the full posting out of `job-analysis.md`.

Preserve formal employers, roles, dates, and locations. A truthful headline may bridge to the target role but must not rewrite history.

Resume writing standards:

- Treat the resume as a credibility summary, not a full case study.
- Summary is usually 28–40 words across one or two concise sentences.
- Each project/experience bullet combines a contribution with context, problem, value, scale, or relevance.
- Central evidence may render in two to three lines; ordinary bullets should fit two; none may exceed three.
- Use supported ATS terms naturally; never keyword-stuff or convert unsupported preferences into claims.

## Finalization

The final resume must pass ATS coverage, layout verification, PDF export, and actual page-count validation for the declared target.

When content overflows:

1. Fix invalid or overlong bullets.
2. If the default centered header materially causes overflow, apply the application-local compact split header from `templates/header-style-options.md`.
3. Shorten near-wrap text and move compact supported terms to Skills.
4. Merge or remove the weakest evidence.
5. Only then use allowed application-local gap adjustments.
6. Rerun ATS/layout after content changes and recheck PDF pages.

After the page fits, inspect the exported PDF for obvious bottom-heavy imbalance. Adjust application-local top spacing only when needed, without clipping or changing the page box, then revalidate.

Never reduce side padding/global font size, clip content, hide print content, fix section heights, or silently change the page target.

## Cover Letter And Log

- Default cover letter: one A4 page, exactly three short body paragraphs, 220–300 body words.
- Use another format only when explicitly required and pass matching renderer/layout options.
- Choose one unanswered hiring question, use one primary proof point, and require candidate-specific details plus real judgment or work preference.
- Link the three paragraphs as role connection -> proof -> role value/close, using a candidate-owned opening and evidence-backed voice.
- When `$humanizer` is installed, apply `templates/humanizer-resume-guardrails.md` after the evidence draft and review its diff.
- Preserve application-log manual edits and validate an existing hash before an authorized change.

## Required Delivery

Report analysis, target HTML/CSS, ATS report, layout result, resume PDF/page count, compare status, cover-letter outputs when applicable, application-log status, rewrite focus, and remaining factual risks. Do not report an unrequested optional artifact as an error.
