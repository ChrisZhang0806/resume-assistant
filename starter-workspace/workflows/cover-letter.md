# Cover Letter Phase

Read this file only when a cover letter is required or requested.

## Minimal Context

- Confirmed `job-analysis.md`
- Confirmed target resume
- `templates/cover-letter-writing-guidelines.md`
- Profile/contact headings needed for the letter
- One primary project or experience source heading, plus one differentiator only when useful
- `templates/humanizer-resume-guardrails.md` only when `$humanizer` is installed

Do not reload the complete evidence map, job posting, long case study, or full fact base unless the selected proof point cannot be verified from existing anchors.

## Resolve Active Constraints

Before drafting, resolve and record active page, paragraph, word-count, confirmation, and render rules from the application, current user request, and `.private-rules.md`.

- Generic default: one A4 page, exactly three short body paragraphs, and 220–300 body words.
- Pass matching `--paragraphs`, `--min-words`, and `--max-words` options when an override is active.
- When a rule gives only a maximum, use `--min-words 1` and that maximum instead of inventing a new minimum.
- If the confirmation gate is waived, continue through HTML/PDF and verification without pausing.

## Choose The Letter's One Job

Identify the one important question the confirmed resume leaves unanswered:

1. **Experience translation:** why a non-obvious background transfers to this role.
2. **Capability proof:** what concrete evidence shows the candidate can do the work.
3. **Concern clarification:** why one material concern should not stop an interview.
4. **Why this work now:** why this kind of role is a credible next step.

Use one primary purpose. Company-product use is optional and must never be manufactured. A genuine connection may instead come from the work problem, audience, industry, team stage, public project, or the candidate's reason for doing this work. Do not add mission praise or pretend to be a customer.

Record the selected question, proof source, role/company connection, and any concern worth addressing in `job-analysis.md`.

## Select Human Evidence

Choose one primary project or experience and collect only:

- a concrete situation, observation, or friction point;
- one action, decision, trade-off, or working preference;
- practical value, result, or lesson relevant to the role.

The draft must include at least two verified details another applicant could not copy from the posting, one sentence revealing judgment or a genuine work preference, and one useful point not already stated by the resume. Do not force hobbies, dramatic origin stories, product fandom, humor, or personal disclosure.

## Draft Rules

- Write in English unless requested otherwise.
- Follow the active constraints.
- Paragraph 1 explains why this role or work is a credible next step.
- Paragraph 2 uses one primary experience to show context, action or judgment, and practical value.
- Paragraph 3 addresses one material concern only when needed; otherwise add a relevant work preference or differentiator and close simply.
- Carry one idea across the paragraphs: role connection -> proof -> role value/close. Do not restart with unrelated evidence in paragraphs 2 or 3.
- Open with candidate-owned reasoning rather than `I am writing to apply`; let verified actions prove qualities instead of listing traits.
- Do not repeat resume bullets, mirror the posting, overpraise the company, or use generic AI promotion.
- Never invent research, connections, tools, metrics, identity, status, or application channels.

Use `templates/cover-letter-draft-template.md` only as a structure aid. Replace all placeholders and instructions before presenting the draft.

## Optional Humanizer Writing Gate

When `$humanizer` is installed, run it after the evidence-first draft under `templates/humanizer-resume-guardrails.md`.

- Use a candidate-owned writing sample when available; otherwise use restrained professional English.
- Preserve active limits, verified proof, names, role/company details, contacts, links, dates, metrics, and supported ATS terms.
- Reject invented anecdotes, opinions, company research, connections, humor, tools, metrics, or personality traits.
- Review the diff and reject unsupported specificity or protected-content changes.

## Candidate Fingerprint And Rewrite Loop

Run every check:

1. **Purpose:** the letter answers the selected question.
2. **Candidate fingerprint:** it contains the required specific details and one real judgment or work preference.
3. **Resume novelty:** at least one useful sentence adds reasoning, context, or motivation.
4. **Role-swap test:** changing only the role title would make the letter inaccurate or incomplete.
5. **Plain-language test:** it sounds natural when read aloud.
6. **Continuity and voice:** each paragraph follows from the prior one, the opening is candidate-owned, and every claimed quality is supported by evidence.
7. **Fact and format:** candidate, company, role, evidence, links, active limits, and supported terms remain correct.

If a check fails, replace generic or duplicated text with verified context, judgment, or motivation rather than synonyms, then repeat the full check.

## Cover-Letter Confirmation Gate

Save and present `cover-letter.md`. Stop before HTML/PDF generation until confirmed unless this gate was explicitly waived. In a v2 folder, record `coverLetterChecks.markdown: confirmed` or `waived`; the renderer fails closed while this value is absent.

## Render And Verify

```bash
npm run cover-letter -- "applications/{folder}/cover-letter.md" --role "Role Title" --company "Company Name"
npm run verify-layout -- "applications/{folder}/cover-letter.html" -v
npm run export-pdf -- "applications/{folder}/cover-letter.html"
```

Pass active format overrides explicitly. For a custom HTML layout, add `--template path/to/template.html`; retain renderer placeholders and the `.cover-letter-body` verification hook. Pass matching page/custom options to verification and export.

Confirm HTML/PDF exist, page count matches, links work, and company/role/contact details remain correct. If layout fails, shorten weak wording before changing spacing. Record Markdown, HTML, PDF, layout, and page-count results.
