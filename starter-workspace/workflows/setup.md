# Setup Phase

Read this file only when preparing a new reusable workspace, importing an existing resume, building the fact base, or changing the base template.

## Inputs

Use one or more verified sources:

- an existing PDF, DOCX, HTML/CSS resume, screenshot, image, or Figma reference;
- completed `USER-INTAKE.md`;
- confirmed work history, projects, education, skills, links, and contact details.

Choose the built-in one-page A4 template or record a custom template and explicit page target. Rebuild non-HTML references as semantic HTML/CSS with selectable text and real links; do not embed a page image as the resume.

## Build The Reusable Base

1. Replace explicit placeholders in `base/index.html` with confirmed reusable content.
2. Keep `base/index.html` and `base/styles.css` job-neutral after setup.
3. Use `templates/custom-template-intake.md` when adapting another design.
4. Explain ATS risk before adopting columns, icon-only labels, layout tables, charts, skill bars, portraits, QR codes, image text, or heavy absolute positioning.

## Build The Fact Base

Keep `master/master-resume.md` short. Use `master/master-data/00-index.md` as the authoritative router to profile, skills, project, experience, and education modules. Store facts at their most specific source and add evidence-map entries only for reusable verified claims.

Do not invent or upgrade titles, employers, dates, locations, tools, credentials, metrics, outcomes, seniority, work authorization, or status.

## Privacy

Treat the working copy as private. Do not publish filled fact files, contact details, application records, imported postings, PDFs, browser captures, or `.private-rules.md`. `.gitignore` is a safety layer, not permission to stage the whole workspace.

## Validate

From the workspace root run:

```bash
npm install
npm run audit
npm run verify-layout -- base/index.html -v
```

For a custom or multi-page template, add its declared `--pages N --custom-template` options. Setup is complete when facts are truthful and routed, explicit placeholders are gone, template preferences are recorded, and required checks pass.
