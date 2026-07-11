# First-Time Setup Checklist

Use this checklist only to prepare a reusable workspace. Agent execution details live in `workflows/setup.md`.

## 1. Choose Inputs

Provide one or more verified fact sources:

- existing resume in PDF, DOCX, HTML/CSS, screenshot/image, or Figma form;
- completed `USER-INTAKE.md`;
- pasted confirmed work history, projects, education, skills, links, and contact details.

Choose the built-in one-page A4 template or a custom template rebuilt from a supplied design source.

## 2. Record Preferences

- target market, language, role families, and industries;
- location and remote/hybrid preferences;
- work authorization only if the user chooses to record it;
- resume template mode/source and page target;
- cover-letter template mode/page target;
- whether cover letters are normally needed;
- ATS risk preference for complex visual designs.

The default cover letter is one A4 page, exactly three short body paragraphs, and 220–300 body words.

## 3. Build The Reusable Base

Replace explicit starter content in `base/index.html` with truthful reusable information: name/positioning, contacts, summary, strongest evidence, relevant experience, education, skills, and applicable certification.

Keep `base/index.html` and `base/styles.css` job-neutral after setup. Each application receives local copies.

For custom designs, follow `templates/custom-template-intake.md`. Rebuild non-HTML sources as semantic HTML/CSS with selectable text, real links, and editable sections.

## 4. Build The Fact Base

Use `master/master-data/00-index.md` as the filename and routing authority. Keep `master/master-resume.md` short and store detailed facts in the most specific profile, skill, project, experience, or education module.

For each durable fact, preserve the source, scope, date/context, and limits. Never strengthen vague or unsupported claims.

## 5. Protect Privacy

Keep filled facts, contacts, applications, generated documents, imported postings, browser captures, research reports, and `.private-rules.md` out of public repositories. Do not rely on `git add -A` in a filled workspace.

## 6. Validate

```bash
npm install
npm run audit
npm run verify-layout -- base/index.html -v
```

For a custom/multi-page template, add its declared `--pages N --custom-template` options. Resolve placeholders and blocking checks before importing a real job.
