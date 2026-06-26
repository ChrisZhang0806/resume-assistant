# First-Time Setup Checklist

Use this checklist before creating the first tailored resume for a new user.

## 0. Choose A Setup Path

Start by choosing the source for the reusable workspace:

1. Existing resume path: use a PDF resume, Word/DOCX resume, screenshot/image, Figma Dev Mode reference, existing HTML/CSS, exported CSS, or design notes. Use it to build the base resume template and extract confirmed facts.
2. Manual facts path: complete `USER-INTAKE.md` or paste work history, projects, education, skills, target roles, and contact details. Use the answers to build `master/master-data/`.
3. Template path: use the built-in one-page ATS-friendly template, or create a custom resume and cover letter template from the user's source files.

Suggested first message for the agent:

```text
Use $resume-assistant to set up my resume workspace. I can provide [existing resume / work history / custom template source]. Please help me build the master fact base, choose a resume template, and prepare the workspace before tailoring jobs.
```

Do not start a job-specific tailoring task until the reusable base template and master fact base are ready enough to support verified claims.

## 1. Confirm The User's Goal

- Target country or market:
- Target role families:
- Preferred industries:
- Preferred locations or remote/hybrid preference:
- Work authorization or visa constraints, if relevant:
- Resume language:
- Resume template: default / custom
- Template source type: HTML / PDF / Word or DOCX / screenshot or image / Figma Dev Mode / exported CSS / design notes
- Template source files or links:
- Resume page target: 1 page / 2 pages / other explicit limit
- Strict one-page resume required: yes / no
- Cover letter template: default / custom
- Cover letter page target:
- ATS risk choice if the preferred design is complex: ATS-first adaptation / visual-faithful template / default template
- Whether the user wants cover letters by default:
- Preferred cover letter tone and length:

## 2. Replace Base Resume Placeholders

Open `base/index.html` and replace every instructional placeholder:

- Name and target role.
- Contact links and email.
- Short professional summary.
- Strongest project.
- Two or three most relevant experiences.
- Education.
- Skills.
- Certification, or remove the section if not needed.

Keep the HTML structure and CSS classes intact unless the user intentionally replaces the template with a custom design. `base/index.html` and `base/styles.css` are reusable base files and should not be edited for individual job applications after setup. For each target resume, copy both files into the application folder and edit only those local copies.

## 3. Customize Templates If Needed

The default resume template is one-page and ATS-friendly, but users may provide their own resume or cover letter template. They do not need to have HTML. They may start from:

- Existing HTML/CSS.
- PDF resume.
- Word or DOCX resume.
- Screenshot or image of a resume design.
- Figma Dev Mode reference, Figma screenshot, or exported design specs.
- Existing website styles, exported CSS, or written design notes.

If the user provides a non-HTML source, rebuild it as semantic HTML/CSS with selectable text, real links, and editable sections. Do not create an image-only resume.

Replace the relevant base files before tailoring jobs:

- `base/index.html`
- `base/styles.css`
- `base/cover-letter-template.html`

Record the page target and template mode in `USER-INTAKE.md`. If the custom template uses different section class names, headings, contact markup, or page dimensions, document those differences so the agent knows how to edit it.

Before using a custom design, check for ATS risks:

- Heavy icon use, especially icons replacing text labels.
- Two-column, sidebar, timeline, or split reading-order layouts.
- Tables used for layout.
- Charts, skill bars, portraits, QR codes, or decorative graphics.
- Text embedded inside images.
- Tiny text, low contrast, unusual fonts, absolute positioning, or overlapping layers.

If these risks are present, ask the user to choose `ATS-first adaptation`, `visual-faithful template`, or `default template` before building or using the template.

## 4. Review The Cover Letter Template

Open `base/cover-letter-template.html` and confirm the visual style is acceptable. This file is a reusable layout template; individual cover letters should be drafted as Markdown in each application folder and then converted to HTML.

## 5. Fill The Master Fact Base

Complete these files in English:

- `master/master-data/profile.md`
- `master/master-data/skills.md`
- `master/master-data/projects/primary-project.md`
- `master/master-data/experience/experience-1.md`
- `master/master-data/experience/experience-2.md`
- `master/master-data/education-certification.md`
- `master/master-data/evidence-map.md`

The master fact base should contain more detail than the base resume. The target resume will select and compress the most relevant facts for each job.

## 6. Build The Evidence Map

For each target role family, map job keywords to real evidence:

- Keyword or requirement.
- Strongest project or experience proving it.
- Source file.
- Where it should appear in the target resume.

Do not add unsupported keywords just because a job description asks for them.

## 7. Run A Basic Local Check

```bash
npm run doctor
npm run check:scripts
npm run verify-layout -- base/index.html -v
npm run serve
```

`npm run doctor` checks the workspace structure, installed dependencies, privacy defaults, script syntax, base resume layout, cover letter layout, and PDF export readiness. On a fresh starter workspace, it runs strict first-run checks for setup docs, `.gitignore`, and a clean `applications/` folder; later runs automatically become non-blocking for existing application outputs. Open `http://localhost:8000/base/index.html` and inspect the base resume. With the default template, it should be readable and close to one page before any tailoring begins. For a custom multi-page template, run `npm run verify-layout -- base/index.html -v --pages 2 --custom-template` or replace `2` with the user's target.

## 8. First Tailoring Task

Use a real job posting:

```bash
npm run import-job -- "https://example.com/job-posting"
```

Then follow `AGENTS.md`: analyze first, ask for user confirmation, prepare and present a modification plan, then create the application-folder HTML for review. Do not wait for separate plan confirmation unless the user explicitly asks for it.

If a cover letter is required, draft it after the resume is confirmed, ask the user to approve the Markdown, then generate HTML and PDF.
