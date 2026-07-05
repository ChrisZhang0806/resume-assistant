# Resume Assistant Agent Guide

This file defines the workflow and quality rules for a Resume Assistant workspace. Use it whenever an agent tailors a resume, writes a cover letter, generates PDFs, creates compare previews, or updates the master fact base.

## Purpose

Generate job-specific English target resumes from:

- A target job posting URL or complete pasted job description.
- A modular master resume fact base under `master/master-data/`.
- The reusable base resume HTML in `base/index.html`.

When needed, help the user first create a reusable HTML/CSS resume template from PDF, Word, screenshot, image, Figma Dev Mode, exported CSS, or design notes. Then continue with a cover letter, optional compare preview, PDF export, and application tracking.

## Project Structure

| File / Directory | Purpose |
| --- | --- |
| `base/index.html` | Reusable base resume layout and starter content. Do not edit it directly for a job application. Users may replace it with a custom resume template during setup. |
| `base/styles.css` | Reusable resume and cover letter styles, print rules, and responsive layout. Users may replace or edit it for a custom template during setup. |
| `base/cover-letter-template.html` | Reusable cover letter HTML template. Users may replace it with a custom cover letter template during setup. |
| `FIRST-TIME-SETUP.md` | Setup checklist for a new user. |
| `USER-INTAKE.md` | Intake form for collecting resume facts. |
| `master/master-resume.md` | Entry point for the modular master fact base. |
| `master/master-data/` | Source-of-truth facts for profile, skills, projects, experience, education, and evidence mapping. |
| `applications/` | Job-specific output folders. |
| `templates/job-analysis-template.md` | Optional manual template for job analysis. |
| `templates/cover-letter-draft-template.md` | Optional starter for cover letter drafts. |
| `templates/cover-letter-writing-guidelines.md` | Reusable strategy guide for job-specific cover letter drafts. |
| `templates/custom-template-intake.md` | Optional checklist for creating custom templates from PDF, Word/DOCX, screenshots, Figma references, or design notes. |
| `templates/header-style-options.md` | Optional reusable resume header and contact-row styles for target-resume layout optimization. |
| `scripts/import-job.mjs` | Imports job posting content and creates a first `job-analysis.md`. |
| `scripts/generate-compare-preview.mjs` | Generates a base-vs-target compare preview. |
| `scripts/generate-cover-letter-html.mjs` | Converts confirmed cover letter Markdown to printable HTML. |
| `scripts/export-resume-pdf.mjs` | Exports resume or cover letter HTML to PDF. |

## First-Time Setup For A New User

Before tailoring the first resume, collect enough information to build the base resume and master fact base. If these inputs are missing, do not start a job-specific rewrite.

When the workspace is newly deployed, `npm run doctor` reports starter placeholders, or the user asks what to do next, do not only tell the user to fill placeholders. Offer a concrete first-run setup menu:

1. Existing resume path: ask for a PDF resume, Word/DOCX resume, screenshot/image, Figma Dev Mode reference, existing HTML/CSS, exported CSS, or design notes.
2. Manual facts path: ask the user to complete `USER-INTAKE.md` or paste work history, projects, education, skills, target roles, and contact details.
3. Template path: ask whether to use the built-in one-page ATS-friendly template or create a custom resume and cover letter template. Record page targets and ATS risk decisions before tailoring jobs.

Suggested first-run prompt to offer the user:

```text
Use $resume-assistant to set up my resume workspace. I can provide [existing resume / work history / custom template source]. Please help me build the master fact base, choose a resume template, and prepare the workspace before tailoring jobs.
```

Recommended setup sequence:

1. Ask the user to complete `USER-INTAKE.md`.
2. Replace all placeholders in `base/index.html` with a truthful, reusable base resume.
3. Fill `master/master-data/` with detailed English source facts.
4. Build `master/master-data/evidence-map.md` so job keywords can be matched to verified evidence.
5. Record template preferences in `USER-INTAKE.md`, especially if the user wants a custom or multi-page resume or cover letter template.

### Base Resume HTML

Open `base/index.html` and replace instructional placeholders:

- Name and target role.
- Contact links, email, phone, and portfolio.
- Short professional summary.
- Strongest selected project.
- Two or three relevant experiences.
- Education.
- Skills.
- Certification, or remove the section if not relevant.

After setup, treat `base/index.html` and `base/styles.css` as reusable base files. For each job, copy both files into `applications/{date-company-role}/` and edit only the application-local copies.

### Template Customization

The default resume template is one-page and ATS-friendly, but it is not mandatory. Users may replace `base/index.html`, `base/styles.css`, or `base/cover-letter-template.html` with their own templates before tailoring jobs. Users do not need existing HTML/CSS; they may provide PDF, Word/DOCX, screenshots, images, Figma Dev Mode references, exported CSS, or design notes.

When a generated one-page target resume has layout pressure or contact-row readability issues, check `templates/header-style-options.md` before making broader layout changes. The labeled inline contact row can be used for clearer one-line contact formatting; the compact split header can be copied into the application-local `resume.html` and `styles.css` as an optional space-saving header style. After applying either option, verify with Pretext and export a fresh PDF.

When building a template from non-HTML sources:

- Use PDF or screenshot files as visual references, not as image-only resume output.
- Use Word/DOCX files as the best source for text structure and resume content.
- Use Figma Dev Mode or screenshots for typography, spacing, color, and layout references.
- Rebuild the template as semantic HTML/CSS with selectable text, real links, and editable sections.
- Keep reusable template output in `base/index.html`, `base/styles.css`, and optionally `base/cover-letter-template.html`.

Before adopting a custom template, inspect it for ATS risks:

- Heavy icon use, especially icons replacing text labels.
- Two-column, sidebar, timeline, or split reading-order layouts.
- Tables used for layout.
- Charts, skill bars, portraits, QR codes, or decorative graphics.
- Text embedded inside images.
- Tiny text, low contrast, unusual fonts, absolute positioning, or overlapping layers.

If ATS risks are present, explain the risk and ask the user to choose one direction before building or using the template:

- `ATS-first adaptation`: simplify the design into a mostly single-column text-first layout.
- `Visual-faithful template`: preserve the design more closely while accepting parsing risk.
- `Default template`: use the built-in ATS-friendly starter template.

If the user uses a custom or multi-page template, record:

- Resume template mode: default or custom.
- Template source type: HTML, PDF, Word/DOCX, screenshot/image, Figma Dev Mode, exported CSS, or design notes.
- Resume page target: 1 page, 2 pages, or another explicit limit.
- Strict one-page resume required: yes or no.
- Cover letter template mode and page target.
- ATS risk choice: ATS-first adaptation, visual-faithful template, or default template.
- Template structure notes, such as section class names, headings, contact markup, or page dimensions.

### Master Resume Fact Base

Fill the modules in this order:

1. `master/master-data/profile.md`: contact details, target roles, professional positioning, work authorization, and location preferences.
2. `master/master-data/skills.md`: verified skills, tools, methods, languages, and collaboration strengths.
3. `master/master-data/projects/primary-project.md`: detailed project context, process, tools, deliverables, and results.
4. `master/master-data/experience/experience-1.md`: strongest or most recent experience, including responsibilities, projects, tools, collaborators, and outcomes.
5. `master/master-data/experience/experience-2.md`: secondary experience, freelance work, volunteer work, or transferable background.
6. `master/master-data/education-certification.md`: education, certificates, coursework, awards, and languages.
7. `master/master-data/evidence-map.md`: map common job keywords to real evidence and source files.

All master facts should be written in professional English because target resumes are English by default.

### Evidence Integrity

Only use user-confirmed facts. Do not invent:

- Companies, schools, titles, dates, or locations.
- Skills, tools, software, languages, or credentials.
- Project outcomes, user counts, revenue, growth, savings, or other metrics.
- Team size, client scale, product launch status, or work authorization.

If a job asks for a requirement that is not supported by the fact base, ask the user for the missing experience during analysis. If the user replies with concrete reusable experience or project details, treat that answer as confirmed for this workflow, update the relevant `master/master-data/` module and `master/master-data/evidence-map.md` by default, and tell the user what was updated.

### Placeholder Checks

When importing a resume into the fact base or checking whether setup is complete, do not use broad keyword searches for terms such as `target role`, `job family`, `application role`, `user's strongest`, or `strongest evidence` as placeholder checks. These phrases can be valid structural guidance.

Use `npm run doctor` and its reported placeholder examples, or check only for explicit starter prompts such as `Add ...`, `[Your Name]`, `Target keyword 1`, `email@example.com`, and `your-profile`. Do not rewrite structural headings just to silence a broad keyword match.

## Utility Commands

Check workspace readiness:

```bash
npm run doctor
```

Import a job posting:

```bash
npm run import-job -- "https://example.com/jobs/product-designer"
```

Generate an optional compare preview:

```bash
npm run compare -- "applications/yyyy-mm-dd-company-role/resume.html"
```

Generate cover letter HTML from a confirmed Markdown draft:

```bash
npm run cover-letter -- "applications/yyyy-mm-dd-company-role/cover-letter.md" --role "Role Title" --company "Company Name"
```

Export HTML to PDF:

```bash
npm run export-pdf -- "applications/yyyy-mm-dd-company-role/resume.html"
```

Run local script checks:

```bash
npm run check:scripts
```

Verify layout:

```bash
npm run verify-layout -- "applications/yyyy-mm-dd-company-role/resume.html" -v
```

For a custom two-page template:

```bash
npm run verify-layout -- "applications/yyyy-mm-dd-company-role/resume.html" -v --pages 2 --custom-template
```

## Core Principle

Resume tailoring must stay inside the boundary of verified facts. The goal is not to exaggerate the candidate. The goal is to select, order, and phrase the candidate's real evidence in the language of the target job.

## Required Inputs For Each Resume Task

Every target resume needs:

1. A target job URL or complete pasted job description.
2. `master/master-resume.md` and the relevant `master/master-data/` modules.
3. Base resume file: `base/index.html`.
4. User preferences such as file naming, date, emphasis, PDF need, cover letter need, application status, template mode, and page target.

If any required input is missing, explain the missing item and ask for it before rewriting.

## Job-Specific Workflow

### 1. Create The Target Workspace

Create a folder for each job:

```text
applications/{yyyy-mm-dd}-{company}-{role}/
```

Use lowercase kebab-case. Remove special characters, parentheses, slashes, and punctuation.

The folder should contain:

- `job-analysis.md`
- Target resume HTML: `resume.html`
- Target resume `styles.css`
- `compare.html`, only if the user requests a compare preview
- Resume PDF
- Cover letter Markdown, HTML, and PDF if needed

### 2. Capture The Job Posting

For every user-provided job URL, prefer reading the visible job page text through the browser, then importing with `--browser-text` when the project script supports it. This protects against anti-scraping controls, dynamic rendering, authentication gates, redirects, and pages that return boilerplate or incomplete HTML to direct fetch:

```bash
npm run import-job -- "https://example.com/jobs/product-designer" --browser-text "/tmp/job-visible.txt"
```

URL-only fetch is a fallback path, not the preferred workflow for job links. If the current Codex environment does not expose a browser DOM/text extraction tool, ask the user to paste the visible job detail text or provide a copied text file. Save that text and run the importer with `--browser-text` using the original job URL as the source. For LinkedIn, URL-only fetch should be treated as a last-resort debugging path.

Remove unrelated navigation, login prompts, recommended jobs, footers, and ads. If the page cannot be captured completely, ask the user to paste the missing job description before continuing.

### 3. Read Master Facts

Always read:

- `master/master-resume.md`
- `master/master-data/00-index.md`
- `master/master-data/evidence-map.md`
- `master/master-data/profile.md`
- `master/master-data/skills.md`

Then read detailed modules based on the job:

- Product, UX, technical, creative, or portfolio-heavy roles: `master/master-data/projects/primary-project.md`
- Roles matching the user's strongest experience: `master/master-data/experience/experience-1.md`
- Transferable or career-transition roles: `master/master-data/experience/experience-2.md`
- Most tasks: `master/master-data/education-certification.md`

Use `evidence-map.md` to choose the strongest evidence. Do not load or copy unnecessary long sections by default.

### 4. Maintain Master Facts

If new reusable facts are needed outside a missing-evidence analysis question, ask the user to confirm them first. When the user supplies concrete facts in response to a missing-evidence question, treat the answer as confirmed for this workflow and update the fact base automatically:

- Add profile, contact, role direction, or location facts to `master/master-data/profile.md`.
- Add skills, tools, methods, or languages to `master/master-data/skills.md`.
- Add project facts to the relevant file under `master/master-data/projects/`.
- Add experience facts to the relevant file under `master/master-data/experience/`.
- Add education, certificates, courses, awards, or languages to `master/master-data/education-certification.md`.
- Update `master/master-data/evidence-map.md` when the new fact affects keyword matching.

### 5. Analyze Fit Before Rewriting

Before editing target HTML, write a job analysis that includes:

- Job Summary
- Matching Degree: High / Medium / Low
- Requirement Match
- Missing Or Risky Requirements
- Transferable Evidence
- ATS Analysis
- Keyword Priority
- Keyword Placement Strategy
- Layout Budget And Compression Strategy
- Localization And Human Voice Analysis
- Writing Strategy
- Template Mode And Page Target
- ATS Template Risk Review

Use this matrix:

| Job Requirement | Master Resume Evidence | Target Resume Location | Rewrite Strategy |
| --- | --- | --- | --- |
| Requirement or keyword | Verified evidence from `master/master-data/` | Summary / Project / Experience / Skills | How to express it |

Present the analysis to the user for confirmation. Do not create or modify target HTML before analysis confirmation unless the user explicitly asks to skip confirmation or directly generate.

If the analysis finds a requirement with no evidence in `master/master-data/`, ask the user for the missing experience before finalizing the strategy. When the user provides concrete reusable facts, update the relevant source module and `master/master-data/evidence-map.md` automatically, record the update in `job-analysis.md`, and notify the user that the fact base has been updated.

### 6. Prepare The Modification Plan

After analysis confirmation, prepare a section-level plan:

- Which sections will change.
- The goal for each section.
- Which keywords will be placed where.
- Which content will be kept, compressed, or removed.
- Whether role title, project title, experience bullets, skill groups, or links will change.
- Which content cannot be written because it lacks evidence.
- What to compress first if layout becomes tight.
- Template mode and page target, including whether verification should use `--custom-template` and `--pages N`.
- ATS template risk review, including whether the source design uses icons, columns, tables, image text, charts, or other complex layout patterns and whether the user confirmed the risk.
- Bullet hierarchy and line budget: which bullets deserve two to three rendered lines, which should fit two lines, and which secondary bullets should be one line.
- Human voice constraints: how to keep the resume natural, professional, and free of AI-sounding template language.

Present or record this plan, then proceed directly to the target HTML. The user reviews the generated HTML result. Do not wait for a separate plan confirmation unless the user explicitly asks for one.

### 7. Rewrite The Resume

1. Copy `base/index.html` to `applications/{folder}/resume.html`. If the user supplied a custom base template during setup, copy that custom base file.
2. Copy `base/styles.css` to `applications/{folder}/styles.css`. If the user supplied custom CSS during setup, copy that custom CSS file.
3. Keep the target HTML stylesheet path as `styles.css`, pointing to the application folder's local CSS copy.
4. Edit only `resume.html` and the application-local `styles.css`.
5. Preserve HTML structure, CSS classes, indentation, visual hierarchy, and the selected template's side padding. For the default starter template, preserve the 40px side padding. For custom templates, preserve the custom template's spacing system unless the user asks for a redesign.
6. Record the target HTML path, target CSS path, and changed sections in `job-analysis.md`.

Write the resume as a credibility layer, not a portfolio case study. Use it to show what the candidate has done, where, at what scale, and why it matters. Leave detailed process, step-by-step methods, meeting history, and full storytelling to the portfolio or interview unless a job requirement specifically needs that evidence in the resume.

Rewrite priority:

1. Summary
2. Skills
3. Selected Project
4. Experience
5. Role title, if factually accurate
6. Education / Certification

Certificates must not be merged into Education bullets. If no Certification section is used, place certificates in the most relevant Skills group text.

### 8. Verify Layout

If the workspace includes a layout verifier, run it after editing. For the default one-page starter template:

```bash
npm run verify-layout -- "applications/{folder}/resume.html" -v
```

For a custom two-page template:

```bash
npm run verify-layout -- "applications/{folder}/resume.html" -v --pages 2 --custom-template
```

Replace `2` with the user's declared page target.

Record total height, remaining space, or overflow in `job-analysis.md`.
Treat layout verification as both a height check and a policy check. With the default starter template, a resume is not ready if the verifier reports horizontal overflow, contact-row overflow, unsafe CSS, changed side padding, or illegal gap values. With a custom template, use `--custom-template` and keep the user's declared page target as the source of truth.

If the resume overflows:

- Shorten text before changing spacing.
- Shorten any project or experience bullet that exceeds its line budget: maximum three rendered lines, two lines for ordinary bullets, one line for weak or secondary bullets.
- Move keywords to Skills when that saves line height.
- Merge or remove weak bullets before changing CSS.
- Adjust only the application folder's local CSS copy. Do not modify `base/styles.css`.
- Keep the contact row on one line. It must not wrap or exceed the resume width; shorten the visible LinkedIn text if needed while preserving the full link target.
- Do not change target resume side padding. For the default starter template, this means preserving 40px left/right padding. For custom templates, preserve the custom template's chosen side padding.
- For the default starter template, gap values changed for target resume optimization must be exactly `2px` or `4px`; do not use `0`, `1px`, `3px`, values above `4px`, fractional values, or unrelated gap values. If the user explicitly provides a custom gap rule, follow that user-provided rule, run the verifier with `--allowed-gaps`, and record it. For custom templates, use the template's own spacing system unless the user asks for a redesign.
- For the default starter template, do not add inline `<style>` blocks for target resume layout. Edit the application folder's `styles.css` copy instead. For custom templates that already use inline styles, do not add clipping rules to hide overflow.
- For the default starter template, do not add `margin-top` or `margin-bottom` to `.section`, `.entry`, `.skill-group`, or `ul`; use existing flex gap controls only. For custom templates, use the template's established spacing approach.
- Do not set `.resume` to `overflow: hidden`, and do not use fixed page height together with `overflow: hidden` in print CSS; those rules clip content instead of proving a fit.
- Do not change global font size, page target, or fixed section heights to force a fit. If the user wants a different page target, record it and verify against it.

### 9. Offer Optional Compare Preview

After `resume.html` has been generated and passes layout verification, ask whether the user wants to review a base-vs-target compare preview, unless the user already gave a compare preference.

If the user wants a compare preview, run:

```bash
npm run compare -- "applications/{folder}/resume.html"
```

Confirm `compare.html` exists and is non-empty, then record its path in `job-analysis.md`.

If the user does not want a compare preview, do not generate `compare.html`. Record `Compare preview: Not requested` in `job-analysis.md` and continue with PDF export, cover letter decision, and application-log handling. The compare-choice prompt is only about review format; it is not a resume modification confirmation gate.

### 10. Export Resume PDF

After layout verification passes, run:

```bash
npm run export-pdf -- "applications/{folder}/resume.html"
```

Confirm the PDF exists and is non-empty. By default, check that the resume PDF is exactly one page. If the user declared a two-page or other explicit page target, the PDF must match that target. If the PDF page count differs from the declared target, treat that as a layout failure even if the HTML verifier passed.

### 11. Decide On Cover Letter

Do not end immediately after the resume PDF. Decide whether a cover letter is needed:

- The job explicitly requires one.
- The application form provides one and the user wants to submit one.
- The user asks for one.

If not needed, record `Cover letter: Not requested / Not required` in `job-analysis.md`.

### 12. Generate Cover Letter

Before writing, read:

- `job-analysis.md`
- `master/master-data/profile.md`
- `templates/cover-letter-writing-guidelines.md`
- The most relevant project or experience module
- The confirmed target resume

Write in English. By default, every cover letter must use exactly three short body paragraphs and about 220-300 body words unless the user or application form explicitly requires a different format. Use 150-220 words for application text boxes, email-style notes, optional low-priority cover notes, or very low-priority roles. Use 300-350 words only for strong-match roles or postings that explicitly ask for a more detailed letter, and do not exceed 350 words unless the employer gives a longer required format. Use simple, easy-to-understand language, keep the tone sincere and restrained, avoid exaggeration, and clearly explain how the candidate's skills can create value for the company. Treat the cover letter as a job-match note, not a second resume: open with a concrete job-role match, use one strongest project or experience as the main proof point, add one differentiating background point only if it strengthens the match, and close within the third paragraph with company value or a specific portfolio discussion point.

Use 2-3 verified matching points total. Natural job keywords are useful, but do not keyword-stuff or mirror the job posting so closely that the letter reads like keyword-spun boilerplate. Avoid template phrases such as `perfect fit`, `uniquely qualified`, `passionate professional`, `I am excited to leverage my skills`, and generic company praise. Because many applicants now use AI-generated cover letters, treat the final draft as a human-edited proof-of-thinking note: include concrete project context, design judgment, portfolio direction, or career-transition explanation that another applicant could not copy from the job ad.

Before presenting the Markdown draft, count the body words, confirm the draft has exactly three body paragraphs, confirm the selected length mode is appropriate, and revise if any requirement fails.

File flow:

1. Create `cover-letter.md` in the application folder.
2. Present the Markdown draft to the user for confirmation.
3. After confirmation, generate HTML with `npm run cover-letter`.
4. Verify layout.
5. Export PDF.
6. Check page count, links, contact details, company name, and role title.
7. Record all paths and validation results in `job-analysis.md`.

### 13. Update Application Log

If the workspace uses `application-log.md`, ask before updating it. Do not mark a job `Submitted` unless the user confirms submission.

Before editing a hashed log:

1. Read the full file.
2. Compute SHA-256 after removing the `agent-log-hash` comment line.
3. Compare it with the existing hash.
4. If it differs, warn the user and preserve manual edits.
5. Recompute and write the new hash after updating.

## Resume Writing Standards

- Summary: 1-2 short paragraphs, one sentence each, usually 28-40 words total.
- Project and experience bullets must pass the bullet quality gate before layout compression: each bullet should answer at least 2 of these questions, and central/high-value bullets should answer 3 when space allows: What did the candidate do? Who or what product/business context was it for? What problem did it address? What experience, workflow, quality, efficiency, or collaboration did it improve? Why is it relevant to the target role?
- Do not write project or experience bullets as task lists that only say what was done. If a bullet lacks purpose, user/business context, problem, or value, revise it before shortening it for layout.
- Project and experience bullets: usually 15-31 words, ideally 20-28, but the rendered line budget is stricter than word count.
- No bullet may exceed three rendered lines in the target resume. Use three lines only for central, high-value evidence; ordinary bullets should fit two lines; weak or secondary bullets should fit one line.
- Each bullet should express one core contribution.
- Each experience usually gets 1-2 bullets.
- Weakly related experience may keep one bullet.
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

## Confirmation Gates

Mandatory gates:

1. Analysis confirmation before target HTML creation or editing.
2. Cover letter Markdown confirmation before cover letter HTML/PDF generation.

The modification plan is not a blocking gate by default. Present or record it after analysis confirmation, then proceed to target HTML. Pause only if the user explicitly asks for plan confirmation.

## Final Delivery Checklist

Final delivery should include:

- Target HTML path.
- Target CSS path.
- Compare preview path if generated, or `Not requested`.
- Resume PDF path.
- Cover letter Markdown, HTML, and PDF paths if generated.
- `job-analysis.md` path.
- Application-log update status.
- Layout verification results.
- PDF page-count result and whether it matches the declared page target.
- Key rewrite focus.
- Remaining factual risks or user-confirmation needs.

## Failure Handling

- Job page unavailable: ask the user to paste the complete job description.
- Missing master facts: ask the user to confirm facts before adding them.
- Template source is image-only or hard to parse: ask for the resume text or Word/PDF source before building the base template.
- Custom template has ATS risks: explain the risks and ask whether to simplify, preserve, or use the default template.
- Unsupported job requirement: mark as a risk; do not invent evidence.
- PDF export failure: deliver verified HTML and record the failure.
- Cover letter longer than the declared page target: shorten the text first.
- User-edited files: preserve manual changes and do not overwrite them.
