# Resume Header Style Options

Use this file as a reusable reference for optional target-resume header layouts.
Do not edit `base/index.html` or `base/styles.css` only to apply one of these
styles. Copy the relevant markup and CSS into the application-local
`resume.html` and `styles.css`, then run layout verification and export a fresh
PDF.

## Option: Labeled Inline Contact Row

Use this option when the default centered header is acceptable but the contact
row needs clearer labels and full-width distribution. This style keeps the
contact row on one line, uses the normal base contact font size, emphasizes only
the labels, and spreads the four contact groups across the resume width.

### HTML Pattern

```html
<ul class="contact-list" aria-label="Contact information">
  <li>
    <span class="contact-label">Portfolio:</span>
    <a href="https://portfolio.example">portfolio.example</a>
  </li>
  <li>
    <span class="contact-label">LinkedIn:</span>
    <a href="https://www.linkedin.com/in/your-profile/">Your Profile</a>
  </li>
  <li><span class="contact-label">Email:</span> name@example.com</li>
  <li><span class="contact-label">Phone:</span> +1 (000) 000-0000</li>
</ul>
```

### CSS Pattern

```css
.contact-list {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 0;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  color: var(--black);
  font-size: 10px;
  line-height: 14px;
  letter-spacing: 0;
  white-space: nowrap;
}

.contact-list li {
  flex: 0 0 auto;
}

.contact-label {
  color: var(--black);
  font-weight: 500;
}
```

### Usage Notes

- This style is useful when the target resume has enough horizontal space and
  the user wants a clearer contact line without reducing font size.
- Keep portfolio and LinkedIn as blue underlined links through the global `a`
  style.
- Keep email and phone as plain text unless the user asks to make them clickable.
- If the row becomes too wide, shorten visible link text first; if it still
  fails, consider the Compact Split Header option below.

## Option: Compact Split Header

Use this option when a one-page target resume is close to the page limit and the
default centered header plus horizontal contact row consumes too much vertical
space. This style keeps the name and role on the left, stacks contact details on
the right, and preserves the default starter template side padding.

### HTML Pattern

```html
<header class="resume-header">
  <div class="identity-block">
    <h1>Candidate Name</h1>
    <p class="role">Target Role Title</p>
  </div>

  <ul class="contact-list" aria-label="Contact information">
    <li>+1 (000) 000-0000</li>
    <li>name@example.com</li>
    <li><a href="https://portfolio.example">portfolio.example</a></li>
    <li>
      <a href="https://www.linkedin.com/in/your-profile/">linkedin.com/in/your-profile</a>
    </li>
  </ul>
</header>
```

### CSS Pattern

```css
.resume-header {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.identity-block {
  min-width: 0;
}

.resume-header h1 {
  color: var(--midnight-blue);
  font-family: "Avenir Next", Avenir, Arial, sans-serif;
  font-size: 28px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: -1.4px;
  text-align: left;
}

.role {
  margin-top: 4px;
  color: var(--midnight-blue);
  font-family: "Avenir Next", Avenir, Arial, sans-serif;
  font-size: 16px;
  font-weight: 500;
  line-height: normal;
  letter-spacing: -0.48px;
  text-align: left;
}

.contact-list {
  width: auto;
  min-width: 170px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
  flex-wrap: nowrap;
  gap: 2px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  color: #000000;
  font-size: 10px;
  line-height: 14px;
  letter-spacing: 0;
  text-align: right;
  white-space: nowrap;
}

.contact-list li {
  flex: 0 0 auto;
}

.contact-list a {
  color: var(--accent-blue);
  text-decoration-line: underline;
  text-decoration-thickness: from-font;
  text-underline-offset: 1px;
}
```

### Usage Notes

- Apply only to a target resume inside `applications/{folder}/` unless the user
  explicitly wants to change the reusable base template.
- Keep phone and email as plain text unless the user asks to make them clickable.
- Style portfolio and LinkedIn as blue underlined links.
- Keep visible LinkedIn text readable, such as
  `linkedin.com/in/your-profile`, while preserving the full URL in `href`.
- If contact text becomes too wide, shorten visible link text before changing
  page padding or global font size.
