# Resume Assistant Workflow Reference

This file is the full execution reference for the `resume-assistant` Codex Skill. If the target repository contains a newer `AGENTS.md`, `agents.md`, or `Skills.md`, follow the local project instructions first.

## Purpose

Use this workflow to create job-specific English target resumes from:

- A target job posting URL or pasted job description.
- A modular master resume fact base.
- A base resume HTML file.
- Optional user preferences such as date, emphasis, PDF, cover letter, or file naming rules.

The workflow can also help users create their base resume and cover letter templates from PDF, Word, screenshot, image, Figma Dev Mode, exported CSS, or design notes before generating cover letters, optional compare previews, resume PDFs, and application-log updates.

## Expected Project Files

| File / Directory | Purpose |
| --- | --- |
| `base/index.html` | Fixed base resume layout and starting content. Never edit it directly for a specific job. Users may replace it with a custom resume template during setup. |
| `base/styles.css` | Base resume and cover letter styles, print sizing, and responsive rules. Users may replace or edit it for a custom template during setup. |
| `base/cover-letter-template.html` | Reusable cover letter HTML template. Users may replace it with a custom cover letter template during setup. |
| `master/master-resume.md` | Entry point for the master fact base. |
| `master/master-data/` | Modular source-of-truth facts for profile, skills, projects, experience, education, and evidence mapping. |
| `applications/` | Job-specific output folders. |
| `application-log.md` | Application tracking table, if the workspace uses one. |
| `templates/custom-template-intake.md` | Optional checklist for creating custom templates from PDF, Word/DOCX, screenshots, Figma references, exported CSS, or design notes. |
| `scripts/import-job.mjs` | Imports job posting text and creates a first `job-analysis.md`. |
| `scripts/verify-layout.mjs` | Uses Pretext to measure A4 height and wrapping. |
| `scripts/generate-compare-preview.mjs` | Creates a base-vs-target compare preview. |
| `scripts/generate-cover-letter-html.mjs` | Converts confirmed cover letter Markdown to HTML. |
| `scripts/export-resume-pdf.mjs` | Exports resume or cover letter HTML to PDF. |

## Non-Negotiable Rules

- Write target resumes and cover letters in English by default.
- Use verified facts only. Evidence may come from the job posting, `master/master-data/`, `master/master-resume.md`, or the base resume.
- Do not invent companies, titles, dates, locations, tools, certificates, metrics, outcomes, work authorization, or application channels.
- Do not edit `base/index.html` or `base/styles.css` for a specific job. Copy both files into `applications/{task-folder}/` and edit only the application-local copies.
- The starter resume template is one-page and ATS-friendly by default, but it is not mandatory. Users may bring their own resume and cover letter templates and declare a different page target.
- Users do not need to start with HTML. During setup, they may provide a PDF resume, Word resume, screenshot/image of a resume, Figma Dev Mode reference, exported CSS, or visual notes. Convert those sources into editable semantic HTML/CSS before tailoring jobs.
- Treat visual template reconstruction as a setup task, not as job-specific tailoring. The reusable output should be `base/index.html`, `base/styles.css`, and optionally `base/cover-letter-template.html`.
- If the user's preferred template appears ATS-risky, explain the specific risks and ask for confirmation before building or using it. Offer an ATS-first adaptation when possible.
- If the user declares a custom template or multi-page target, follow that target. Do not force the resume or cover letter back to one page unless the user asks for strict one-page output.
- If a job requires a skill or experience with no supporting evidence, ask the user for the missing experience during analysis. If the user responds with concrete reusable facts, treat that answer as confirmed for this workflow, update the appropriate `master/master-data/` module and `master/master-data/evidence-map.md` by default, then tell the user exactly what was updated.
- When importing a resume into the fact base or checking whether setup is complete, do not use broad keyword searches for terms such as `target role`, `job family`, `application role`, `user's strongest`, or `strongest evidence` as placeholder checks. These phrases can be valid structural guidance. Use `npm run doctor` and its reported placeholder examples, or check for explicit starter prompts such as `Add ...`, `[Your Name]`, `Target keyword 1`, `email@example.com`, and `your-profile`.
- Preserve user edits. Read existing files and logs before modifying them.
- Use Pretext only for layout, wrapping, and height. Do not use it as a substitute for factual checking, job-fit analysis, or ATS reasoning.
- Never merge certificates into Education bullets. If there is no Certification section, place certificates in the most relevant Skills group text, not in a Skills heading.

## Required Inputs

Before generating a target resume, confirm the workspace has:

1. A job posting URL or complete pasted job description.
2. `master/master-resume.md` and `master/master-data/`.
3. Base resume HTML: `base/index.html`.
4. User preferences such as application date, emphasis, PDF need, cover letter need, and naming requirements.
5. Template preferences if the user is not using the default one-page starter template: resume template mode, resume page target, cover letter template mode, cover letter page target, and any structural notes.

If a job posting, master facts, or base resume is missing, explain the missing item and do not fabricate content.

## Post-Install And First-Run Onboarding

Run this onboarding when the user has just installed or deployed the skill, opened a fresh starter workspace, reports that `npm run doctor` found starter placeholders, or asks what to do next before their first tailoring task.

Do not only tell the user to fill placeholders. Give a concrete setup menu and ask for one useful next input:

1. Existing resume path: ask the user to attach or point to a PDF resume, Word/DOCX resume, screenshot/image, Figma Dev Mode reference, existing HTML/CSS, exported CSS, or design notes. Use the source to build or update `base/index.html`, `base/styles.css`, and the master fact base.
2. Manual facts path: ask the user to complete `USER-INTAKE.md` or paste work history, projects, education, skills, target roles, and contact details. Convert confirmed facts into `master/master-data/`.
3. Template path: ask whether to use the built-in one-page ATS-friendly template or create a custom resume and cover letter template. Record page targets and cover letter preferences before tailoring jobs.

Suggested first-run prompt for the user:

```text
Use $resume-assistant to set up my resume workspace. I can provide [existing resume / work history / custom template source]. Please help me build the master fact base, choose a resume template, and prepare the workspace before tailoring jobs.
```

Before importing or rewriting for a target job, confirm that the base template and master fact base are ready enough to support verified claims. If they are not ready, continue setup instead of starting job-specific tailoring.

## Job Import

For every user-provided job URL, prefer capturing visible job text through the browser before running the importer. This protects against anti-scraping controls, dynamic rendering, authentication gates, redirects, and pages that return boilerplate or incomplete HTML to direct fetch. This is especially important for LinkedIn, Job Bank, Greenhouse, Lever, Workday, company ATS pages, authenticated pages, dynamic pages, and pages that may rate-limit direct fetches.

URL-only fetch is a fallback path, not the preferred workflow for job links. If the current Codex environment does not expose a browser DOM/text extraction tool, ask the user to paste the visible job detail text into the thread or provide a text file copied from the browser. Then import with `--browser-text` and use the original job URL as the source argument. For LinkedIn, URL-only fetch should be treated as a last-resort debugging path.

Standard process:

1. Open the job link in the in-app browser.
2. Extract visible text from the main job-detail area. If no extraction tool is available, ask the user for the copied visible job detail text.
3. Remove navigation, login prompts, recommended jobs, footers, ads, and unrelated noise.
4. Save the clean visible job text to a temporary text file.
5. Import with `--browser-text`:

```bash
node scripts/import-job.mjs "https://example.com/jobs/product-designer" --browser-text "/tmp/job-visible.txt"
```

Use URL-only import only as a fallback or debugging step:

```bash
node scripts/import-job.mjs "https://example.com/jobs/product-designer"
```

If URL-only import is used, record the fallback reason and job-description completeness risk in `job-analysis.md`. Review the extracted text for navigation, login, recommendations, alerts, boilerplate, and missing job sections before analysis.

Useful options:

- `--date YYYY-MM-DD`
- `--company "Company Name"`
- `--role "Role Title"`
- `--browser-text FILE`
- `--force`

## Template Customization

The default starter workspace includes a generic one-page ATS-friendly resume template and a one-page cover letter template. These are safe defaults, not requirements.

Users may customize or replace:

- `base/index.html`
- `base/styles.css`
- `base/cover-letter-template.html`

### Accepted Template Sources

If the user does not have HTML/CSS, help them build a reusable template from:

- PDF resume: use the PDF as a visual reference, extract available text, and rebuild semantic HTML/CSS rather than embedding the PDF as an image.
- Word or DOCX resume: use the document structure and text as the primary source, then recreate the style in HTML/CSS.
- Screenshot or image: use it as a visual reference only; ask for the resume text or extract it if possible, then rebuild real selectable text in HTML.
- Figma Dev Mode or Figma screenshots: use layout dimensions, typography, colors, and spacing as reference. Recreate the resume as semantic HTML/CSS instead of relying on image slices.
- Existing website or exported CSS: reuse only the relevant typography, spacing, and visual system, then keep resume content as text.

Do not create image-only resumes. The generated base resume must contain selectable text, real links, semantic sections, and editable CSS.

### ATS Risk Review

Before adopting a custom template, inspect the source design for ATS risks:

- Heavy icon use, especially icons replacing text labels.
- Two-column, sidebar, or timeline layouts that split reading order.
- Tables used for layout.
- Charts, skill bars, portraits, QR codes, or decorative graphics.
- Text embedded inside images or screenshots.
- Unusual fonts, tiny text, low contrast, or dense decorative styling.
- Complex absolute positioning, overlapping layers, or non-linear reading order.

If these risks are present, pause and ask the user to confirm one of these directions:

- `ATS-first adaptation`: keep the user's visual direction but simplify to a mostly single-column, text-first layout.
- `Visual-faithful template`: preserve the design more closely while accepting potential ATS parsing risk.
- `Default template`: use the built-in one-page ATS-friendly starter template.

Record the user's choice in `USER-INTAKE.md` or `job-analysis.md` before using the template.

Ask for or read the user's template preferences before tailoring:

- Resume template mode: `default` or `custom`.
- Template source type: HTML, PDF, Word/DOCX, screenshot/image, Figma Dev Mode, exported CSS, or design notes.
- Resume page target: usually `1`, `2`, or another explicit page count.
- Strict one-page resume required: `yes` or `no`.
- Cover letter template mode: `default` or `custom`.
- Cover letter page target.
- Structural notes: section class names, headings, contact/header structure, page dimensions, or other edit landmarks.

For the default template, use the standard verifier:

```bash
node scripts/verify-layout.mjs "applications/{folder}/resume.html" -v
```

For a custom or multi-page template, pass the page target and custom-template mode:

```bash
node scripts/verify-layout.mjs "applications/{folder}/resume.html" -v --pages 2 --custom-template
```

Use the user's actual page target instead of `2`. For custom templates, the verifier skips the starter template's fixed padding, gap, and inline-style policies, but still checks height budget, contact-row overflow when `.contact-list` exists, and clipping rules. PDF page count remains authoritative.

## Master Facts Reading Rules

Every resume task must read:

- `master/master-resume.md`
- `master/master-data/00-index.md`
- `master/master-data/evidence-map.md`
- `master/master-data/profile.md`
- `master/master-data/skills.md`

Then read detailed modules based on the job type. Common routes:

- UX, product, AI product, portfolio-heavy, or technical product roles: read the strongest project module.
- eLearning, instructional, onboarding, learning design, or digital experience roles: read the strongest relevant experience module.
- Media, content, visual design, or production roles: read the relevant media or creative experience module.
- Business analysis, product analysis, technical communication, complex systems, risk, data, or knowledge-management roles: read the relevant analytical experience module.
- Cover letters, portfolio bios, interviews, or career-transition narratives: read any profile narrative module if present.
- In most cases, read `master/master-data/education-certification.md` unless education and certification are clearly irrelevant.

Do not copy long master modules into the resume. Use `evidence-map.md` to identify the strongest evidence, then read detailed modules only for context.

## Master Facts Maintenance

`master/master-data/` is the durable source of truth. `master/master-resume.md` is only an entry point.

Ask the user before adding facts when information is missing. If the missing evidence is identified during job-fit analysis and the user answers that gap with concrete reusable experience, treat the answer as confirmed for this workflow and write it into the fact base by default. If the user volunteers reusable facts outside a missing-evidence analysis question, ask for confirmation before updating the fact base.

Update the most specific module, update `master/master-data/evidence-map.md` when keyword matching is affected, record the update in `job-analysis.md`, and tell the user what was updated:

| New Fact Type | Update File |
| --- | --- |
| Positioning, contact, location, target roles | `master/master-data/profile.md` |
| Career narrative, portfolio about text, cover letter material | a profile narrative module if present |
| Skills, tools, methods, languages | `master/master-data/skills.md` |
| Project facts | the relevant file under `master/master-data/projects/` |
| Work experience facts | the relevant file under `master/master-data/experience/` |
| Education, certificates, coursework, languages | `master/master-data/education-certification.md` |
| Facts affecting keyword matching | also update `master/master-data/evidence-map.md` |

## Full Workflow

### 1. Create The Target Workspace

Create an independent folder for every job:

```text
applications/{yyyy-mm-dd}-{company}-{role}/
```

Naming rules:

- Use lowercase kebab-case.
- Use English or clear English transliteration for company and role.
- Replace spaces with hyphens.
- Remove special characters, parentheses, slashes, and punctuation.
- Add a time suffix or `-v2` if the same company and role need multiple versions on the same day.

The final folder should contain:

- `job-analysis.md`
- `resume.html`
- `styles.css`
- `compare.html`, only if the user requests a compare preview
- Resume PDF
- Cover letter Markdown, HTML, and PDF if required or requested

### 2. Capture And Log The Job Posting

In `job-analysis.md`, record:

- Source link and capture date.
- Company, role, location, work mode, salary range, seniority, job function, and industry.
- Complete job description text.
- Responsibilities, deliverables, requirements, and job details.
- Must-haves, nice-to-haves, keywords, and evidence needed.

If the job posting cannot be captured completely, write what is available, then ask the user for the missing job description. Do not rewrite the resume while the job information is incomplete.

### 3. Analyze Fit, Gaps, ATS, And Writing Strategy

The analysis must include:

- Job Summary
- Matching Degree: High / Medium / Low
- Requirement Match
- Missing Or Risky Requirements
- Transferable Evidence
- ATS Analysis
- Keyword Priority
- Keyword Placement Strategy
- Pretext Layout Budget And Compression Strategy
- Template Mode And Page Target
- ATS Template Risk Review
- Localization And Human Voice Analysis
- Writing Strategy

Use this matching matrix:

| Job Requirement | Master Resume Evidence | Target Resume Location | Rewrite Strategy |
| --- | --- | --- | --- |
| Requirement or keyword | Verified evidence | Summary / Project / Experience / Skills | How to express it |

After finishing the analysis, present it to the user for confirmation. Do not create or edit the target HTML before analysis confirmation unless the user explicitly asked to skip confirmation or directly generate.

If the analysis finds a job requirement that has no evidence in `master/master-data/`, ask the user for the missing experience before finalizing the strategy. When the user supplies concrete experience or project details in response, update the relevant source module and `master/master-data/evidence-map.md` automatically, record the update in `job-analysis.md`, and notify the user that the fact base has been updated.

### 4. Prepare The Resume Modification Plan

After analysis confirmation, prepare a section-level modification plan. Include:

- Which sections will be rewritten.
- The goal of each section.
- Which keywords will be placed where.
- Which content will be preserved, compressed, or removed.
- Whether role title, project title, experience bullets, skills groups, or links will change.
- Which requested content cannot be included because it lacks evidence.
- Layout budget: which sections are likely to consume height, where long keywords can be placed more efficiently, and what to compress first if the resume overflows.
- Template mode and page target: whether the default one-page template is used or a custom/multi-page template changes the verification command.
- ATS template risk review: whether the selected template uses icons, columns, tables, images, charts, or other complex layout patterns, and whether the user confirmed the risk.
- Bullet hierarchy and line budget: which bullets deserve two to three rendered lines, which should fit two lines, and which secondary bullets should be one line.
- Human voice constraints: how to keep the target resume natural, professional, and free of AI-sounding template language.

Write or present the plan, then proceed directly to creating and rewriting the target HTML. The user reviews the generated HTML result. Do not wait for a separate modification-plan confirmation unless the user explicitly asks for that gate.

### 5. Rewrite The Target Resume

1. Copy `base/index.html` to `applications/{folder}/resume.html`. If the user supplied a custom base template during setup, copy that custom base file.
2. Copy `base/styles.css` to `applications/{folder}/styles.css`. If the user supplied custom CSS during setup, copy that custom CSS file.
3. Keep the target HTML stylesheet path as `styles.css`, pointing to the application folder's local CSS copy.
4. Edit only `resume.html` and the application-local `styles.css`.
5. Preserve HTML structure, indentation, CSS classes, visual hierarchy, and the template's existing side padding. For the default starter template, preserve the 40px side padding. For custom templates, preserve the custom template's own spacing system unless the user asks for a redesign.
6. Update `job-analysis.md` with the modification scope, target HTML path, and target CSS path.

Write the resume as a credibility layer, not a portfolio case study. Use the resume to show what the candidate has done, where, at what scale, and why it matters. Leave detailed process, step-by-step methods, meeting history, and full storytelling to the portfolio or interview unless a job requirement specifically needs that evidence in the resume.

Rewrite priority:

1. Summary
2. Skills
3. Selected project
4. Experience
5. Role title, only if factually accurate
6. Education / Certification

### 6. Verify Resume Layout

Run the verifier with the user's page target. For the default one-page starter template, run:

```bash
node scripts/verify-layout.mjs "applications/{folder}/resume.html" -v
```

For a custom two-page template, run:

```bash
node scripts/verify-layout.mjs "applications/{folder}/resume.html" -v --pages 2 --custom-template
```

Replace `2` with the user's declared resume page target.

Check:

- Core job requirements are covered.
- Every new claim has supporting evidence.
- HTML structure, links, contact details, and dates are correct.
- The contact row stays on one line, does not wrap, and does not exceed the resume width. Shorten the visible LinkedIn text if needed, while keeping the full link target in `href`.
- Total height fits the declared A4 page budget. The default budget is one page, 842px. A two-page target uses `--pages 2`.
- Desktop preview and print sizing do not show obvious overflow.
- Text does not overlap, crowd, or wrap abnormally.
- Project and experience bullets respect the line budget: no bullet exceeds three rendered lines; central evidence may use two to three lines, ordinary bullets fit two lines, and weak or secondary bullets fit one line.
- Target resume left and right padding are unchanged from the selected base template.
- For the default starter template, the verifier reports no layout policy issues. A height pass is not enough if horizontal overflow, unsafe CSS, illegal gap values, changed side padding, or contact-row overflow are reported.
- For custom templates, the verifier may run in `--custom-template` mode, but PDF page count and visible rendering remain authoritative.

If Pretext reports overflow or very low remaining space:

1. Use verbose section heights to find the expensive section.
2. Inspect long bullets, summary sentences, and skills groups that create extra wrap lines, especially any bullet that violates the line budget.
3. Shorten near-threshold lines by a few words when that can save a full line.
4. Move keywords to Skills when they do not need a long bullet.
5. Compress or merge weak bullets before changing spacing.
6. If content is already concise but still close to the limit, adjust only the application folder's local CSS copy. Do not modify `base/styles.css`.
7. For the default starter template, gap values changed for target resume layout optimization must be exactly `2px` or `4px`. Do not use `0`, `1px`, `3px`, values above `4px`, fractional values, or unrelated gap values. If the user explicitly provides a custom gap rule, follow that user-provided rule, run the verifier with `--allowed-gaps`, and record the rule in `job-analysis.md`. For custom templates, preserve the template's own spacing system unless the user asks for a redesign.
8. Do not change target resume side padding, page target, global font size, or fixed section heights to force a fit. If the user wants a different page target, record it as a template preference and verify against that target.
9. For the default starter template, do not add inline `<style>` blocks for target resume layout. Edit the application folder's `styles.css` copy instead. For custom templates that already use inline styles, do not add clipping rules to hide overflow.
10. For the default starter template, do not add `margin-top` or `margin-bottom` to `.section`, `.entry`, `.skill-group`, or `ul`; this stacks with flex gaps and creates phantom whitespace. Use existing gap controls only. For custom templates, use the template's established spacing approach.
11. Do not set `.resume` to `overflow: hidden`, and do not use fixed page height together with `overflow: hidden` in `@media print`; those rules clip bottom padding/content instead of proving the resume fits.
12. Re-run verification after each content or spacing change and record the final result, contact-row status, padding status, target CSS path, and any gap adjustments in `job-analysis.md`.

### 7. Offer Optional Compare Preview

After `resume.html` has been generated and passes layout verification, ask whether the user wants to review a base-vs-target compare preview, unless the user already gave a compare preference.

If the user wants a compare preview, run:

```bash
node scripts/generate-compare-preview.mjs "applications/{folder}/resume.html"
```

Confirm `compare.html` exists and is non-empty. Record the path in `job-analysis.md`.

If the user does not want a compare preview, do not generate `compare.html`. Record `Compare preview: Not requested` in `job-analysis.md` and continue with the PDF/export and later workflow steps. The compare-choice prompt is only about review format; it is not a resume modification confirmation gate.

### 8. Export Resume PDF

Run:

```bash
node scripts/export-resume-pdf.mjs "applications/{folder}/resume.html"
```

Only export the final resume PDF after verification passes for the declared page target. Confirm the PDF exists and is non-empty.

Check the PDF page count with an available local tool such as `pdfinfo`, `file`, or rendering inspection. By default, the resume PDF must be exactly one page. If the user declared a two-page or other explicit target, the PDF must match that target. If Pretext passes but the PDF page count differs from the declared target, treat the PDF result as authoritative, compress or adjust the target HTML, re-run Pretext with the same `--pages` / `--custom-template` settings, regenerate the compare preview only if it was requested/generated, and export the PDF again.

### 9. Decide Whether A Cover Letter Is Needed

After the resume PDF succeeds, decide whether a cover letter is needed:

- The job explicitly requires one.
- The application form provides one and the user wants to submit it.
- The user asks for one.

If not needed, record `Cover letter: Not requested / Not required` in `job-analysis.md`.

### 10. Generate Cover Letter

Before writing, read:

- `job-analysis.md`
- `master/master-data/profile.md`
- Any profile narrative module if useful
- The most relevant project or experience module
- The confirmed target resume HTML or text

Writing rules:

- English, exactly three short body paragraphs by default.
- Default length: about 220-300 body words.
- Short mode: 150-220 words for application text boxes, email-style notes, optional low-priority cover notes, or very low-priority roles.
- Detailed mode: 300-350 words only for strong-match roles or postings that explicitly ask for a more detailed letter. Do not exceed 350 words unless the employer gives a longer required format.
- Natural, specific, sincere, and restrained.
- Treat the letter as a job-match note, not a second resume: open with a concrete role match, use one strongest project or experience as the main proof point, add one differentiating background point only if it strengthens the match, and close within the third paragraph with company value or a specific portfolio discussion point.
- Build around 2-3 true matching points.
- Avoid phrases such as `I am thrilled`, `perfect fit`, `uniquely qualified`, `passionate professional`, and `I am excited to leverage my skills`.
- Do not keyword-stuff or mirror the job posting so closely that the letter reads like keyword-spun boilerplate.
- Because many applicants now use AI-generated cover letters, treat the final draft as a human-edited proof-of-thinking note: include concrete project context, design judgment, portfolio direction, or career-transition explanation that another applicant could not copy from the job ad.
- Do not invent company research, personal connections, outcome metrics, tool experience, identity status, or application channels.
- Leave layout room when role names, company names, or contact details are long.
- Before presenting the Markdown draft, count the body words, confirm exactly three body paragraphs, confirm the selected length mode is appropriate, and revise if any requirement fails.

File flow:

1. Create `cover-letter.md` in the application folder.
2. Present the Markdown draft to the user for confirmation.
3. After confirmation, generate HTML:

```bash
node scripts/generate-cover-letter-html.mjs "applications/{folder}/cover-letter.md" --role "Role Title" --company "Company Name"
```

4. Run Pretext layout verification:

```bash
node scripts/verify-layout.mjs "applications/{folder}/cover-letter.html" -v
```

5. If it overflows the declared cover letter page target, shorten paragraphs, merge paragraphs, or remove weak motivation sentences before adjusting spacing.
6. Export PDF:

```bash
node scripts/export-resume-pdf.mjs "applications/{folder}/cover-letter.html"
```

7. Check page count, links, contact details, company name, and role title.
8. Record Markdown, HTML, PDF, and verification results in `job-analysis.md`.

### 11. Update The Application Log

After the resume PDF is generated and the cover letter decision is handled, ask the user whether the job has been submitted or should be recorded as pending.

Before editing `application-log.md`:

1. Read the full file.
2. Compute SHA-256 after removing the `agent-log-hash` comment line.
3. Compare it with the existing hash comment.
4. If the hash differs, warn the user and preserve manual edits.
5. After updating or appending a record, recompute and write the new hash.

Do not mark a job `Submitted` just because a PDF was generated. Only mark it submitted if the user confirms.

## Writing Standards

### Resume

- Summary: 1-2 short paragraphs, one sentence each, usually 28-40 words total.
- Project and experience bullets: usually 15-31 words, ideally 20-28, but the rendered line budget is stricter than the word count.
- No bullet may exceed three rendered lines in the target resume. Use three lines only for central, high-value evidence; ordinary bullets should fit two lines; weak or secondary bullets should fit one line.
- Each bullet should express one core contribution.
- Each experience usually gets 1-2 bullets; weakly related experience may keep one bullet.
- Skills should use compact comma-separated keywords.
- Use target keywords naturally. Do not keyword-stuff.
- The resume's job is credibility; the portfolio's job is storytelling. Do not turn resume bullets into mini case studies.
- Prefer these concise structures: `Action + Product/Domain + Outcome`, `Problem + Solution`, or `Responsibility + Scale`.
- Emphasize product/domain, responsibility, scale, and value. Omit routine process detail such as meeting counts, wireframe volume, or step-by-step methods unless the job explicitly needs that proof.
- Keep the voice natural and professionally conventional. A resume should sound like a real designer or product candidate, not like generated marketing copy.

Preferred verbs:

- `Designed`
- `Developed`
- `Created`
- `Translated`
- `Evaluated`
- `Refined`
- `Analyzed`
- `Collaborated`
- `Delivered`
- `Supported`
- `Simplified`

Avoid:

- `Responsible for`
- `Worked on`
- `Helped with`
- `Utilized` when `Used` is clearer
- `Leveraged`
- `Passionate`
- `Dynamic`
- `Detail-oriented`
- `Self-starter`
- `Cutting-edge`
- `Robust`
- `Seamless`
- `Game-changing`
- `Innovative solutions`
- `Significant impact`

### Cover Letter

- English by default.
- Exactly three short body paragraphs by default.
- Usually 220-300 body words; use 150-220 words for short text boxes or low-priority notes and 300-350 words only for strong-match or employer-requested detailed letters.
- Sound like a real applicant: natural, restrained, and specific.
- Do not repeat the full resume. Add motivation and 2-3 strongest proof points.

## Confirmation Gates

Mandatory gates:

1. Analysis confirmation: job information, fit, risks, ATS, keywords, and writing strategy.
2. Cover letter confirmation: confirm the Markdown draft before HTML/PDF generation when a cover letter is needed.

The resume modification plan is not a blocking confirmation gate by default. After analysis confirmation, write or present the plan and proceed to the target HTML. If the user asks to restore a modification-plan confirmation gate, pause and wait.

## Final Delivery

The final response must include:

- Target HTML path.
- Target CSS path.
- Compare preview path if generated, or `Not requested`.
- Resume PDF path.
- Cover letter Markdown, HTML, and PDF paths if generated.
- `job-analysis.md` path.
- Whether `application-log.md` was updated.
- Resume template mode, page target, and Pretext result: total height, remaining space, or overflow.
- Cover letter Pretext result if generated.
- PDF page-count result and whether it matches the declared page target.
- Key rewrite focus.
- Remaining risks or facts needing user confirmation.

## Failure Handling

- Job page unavailable: ask the user to paste the complete job description.
- Missing master facts: ask the user to confirm the missing information before updating facts.
- Template source is image-only or hard to parse: ask for the resume text or Word/PDF source before building the base template.
- Custom template has ATS risks: explain the risks and ask whether to simplify, preserve, or use the default template.
- Unsupported requirement: mark as a risk; do not invent evidence.
- PDF export failure: deliver verified HTML and record the failure.
- Cover letter longer than the declared page target: shorten the text before changing spacing.
- User-edited files: preserve manual changes and do not overwrite them.
