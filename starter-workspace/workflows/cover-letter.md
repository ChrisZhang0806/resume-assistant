# Cover Letter Phase

Read this file only when a cover letter is required or requested.

## Minimal Context

Use the confirmed analysis and target resume, contact/profile headings, `templates/cover-letter-writing-guidelines.md`, and one primary evidence source. Do not reload the full posting, evidence map, or fact base without a specific evidence gap.

## Draft

- Write in English unless requested otherwise.
- Default to one A4 page, exactly three short body paragraphs, and 220–300 body words.
- Use another length or structure only when the user/application explicitly requires it; record the override.
- Use two or three verified matching points led by one project or experience.
- Keep the voice restrained, specific, and human. Do not mirror the posting, repeat resume bullets, or invent research, connections, tools, metrics, identity, or status.

Save and present `cover-letter.md`. Stop before HTML/PDF generation until confirmed unless this gate was explicitly waived. In a v2 folder, record `coverLetterChecks.markdown: confirmed` or `waived` before rendering; the renderer fails closed while this value is absent.

## Render And Verify

```bash
npm run cover-letter -- "applications/{folder}/cover-letter.md" --role "Role Title" --company "Company Name"
npm run verify-layout -- "applications/{folder}/cover-letter.html" -v
npm run export-pdf -- "applications/{folder}/cover-letter.html"
```

For an explicit format override, pass matching `--paragraphs`, `--min-words`, and `--max-words`. For a compatible custom HTML template, add `--template path/to/template.html`; retain required placeholders and the `.cover-letter-body` verification hook. Pass matching page/custom options to layout and export.

Confirm names, role, company, evidence, links, layout, PDF path, and actual page count. Record the Markdown, HTML, PDF, layout, and page-count results.
