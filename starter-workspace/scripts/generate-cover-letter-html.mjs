#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

main().catch((error) => {
  console.error(`Cover letter HTML generation failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.inputPath) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = path.resolve(args.inputPath);
  const outputPath = path.resolve(
    args.outputPath || inputPath.replace(/\.md$/i, ".html"),
  );
  const markdown = await readFile(inputPath, "utf8");
  const letter = parseCoverLetter(markdown, args);
  const html = renderCoverLetter(letter, relativeStylesPath(outputPath));

  await writeFile(outputPath, html);
  console.log(`Created ${path.relative(process.cwd(), outputPath)}`);
}

function parseArgs(argv) {
  const args = {
    inputPath: "",
    outputPath: "",
    role: "",
    company: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--output" || arg === "-o") {
      args.outputPath = argv[++index] || "";
    } else if (arg.startsWith("--output=")) {
      args.outputPath = arg.slice("--output=".length);
    } else if (arg === "--role") {
      args.role = argv[++index] || "";
    } else if (arg.startsWith("--role=")) {
      args.role = arg.slice("--role=".length);
    } else if (arg === "--company") {
      args.company = argv[++index] || "";
    } else if (arg.startsWith("--company=")) {
      args.company = arg.slice("--company=".length);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.inputPath) {
      args.inputPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/generate-cover-letter-html.mjs <cover-letter.md> [options]

Options:
  --role ROLE           Role shown in the cover letter title.
  --company COMPANY     Company shown in the cover letter title.
  --output, -o FILE     HTML output path. Defaults to the Markdown path with .html.
  --help, -h            Show this help.

Example:
  node scripts/generate-cover-letter-html.mjs applications/example/cover-letter.md --role "Product Designer" --company "Company"
`);
}

function parseCoverLetter(markdown, args) {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const name = stripHeading(lines[0] || "Your Name");
  const location = lines[1] || "";
  const contactLine = lines[2] || "";
  const linksLine = lines[3] || "";
  const salutationIndex = lines.findIndex((line) => /^Dear\b/i.test(line));
  const signoffIndex = lines.findIndex((line) => /^(Sincerely|Best),?$/i.test(line));
  const bodyStart = salutationIndex >= 0 ? salutationIndex + 1 : 4;
  const bodyEnd = signoffIndex >= 0 ? signoffIndex : lines.length;
  const paragraphs = lines.slice(bodyStart, bodyEnd);
  const email = firstEmail(contactLine);
  const phone = contactLine
    .split("|")
    .map((item) => item.trim())
    .find((item) => !item.includes("@")) || "";
  const links = linksLine.split("|").map((item) => item.trim()).filter(Boolean);
  const portfolio = links.find((item) => !/linkedin/i.test(item)) || "";
  const linkedin = links.find((item) => /linkedin/i.test(item)) || "";
  const inferred = inferRoleAndCompany(markdown);

  return {
    name,
    location,
    email,
    phone,
    portfolio,
    linkedin,
    salutation: salutationIndex >= 0 ? lines[salutationIndex] : "Dear Hiring Team,",
    signoff: signoffIndex >= 0 ? lines[signoffIndex].replace(/,$/, ",") : "Sincerely,",
    role: args.role || inferred.role || "Role",
    company: args.company || inferred.company || "Company",
    paragraphs,
  };
}

function renderCoverLetter(letter, stylesHref) {
  const body = letter.paragraphs
    .map((paragraph) => `<p>${formatInlineText(paragraph)}</p>`)
    .join("\n\n          ");
  const portfolioHref = toUrl(letter.portfolio);
  const linkedinHref = toUrl(letter.linkedin);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(letter.name)} - ${escapeHtml(letter.company)} Cover Letter</title>
    <link rel="stylesheet" href="${stylesHref}" />
  </head>
  <body>
    <main class="letter-shell" aria-label="Cover letter preview">
      <article class="cover-letter">
        <header class="cover-letter-header">
          <section class="cover-contact" aria-label="Contact information">
            <h1>${escapeHtml(letter.name)}</h1>
            <p>
              <a href="mailto:${escapeAttribute(letter.email)}">${escapeHtml(letter.email)}</a><br />
              <a href="${escapeAttribute(portfolioHref)}">${escapeHtml(letter.portfolio)}</a><br />
              <a href="${escapeAttribute(linkedinHref)}">${escapeHtml(letter.linkedin)}</a><br />
              ${escapeHtml(letter.phone)}<br />
              ${escapeHtml(letter.location)}
            </p>
          </section>
        </header>

        <section class="cover-letter-body">
          <h2>
            Application for the position of <span>${escapeHtml(letter.role)}</span> at
            <span>${escapeHtml(letter.company)}</span>
          </h2>

          <p>${escapeHtml(letter.salutation)}</p>

          ${body}

          <div class="cover-signoff">
            <p>${escapeHtml(letter.signoff)}</p>
            <p>${escapeHtml(letter.name)}</p>
          </div>
        </section>
      </article>
    </main>
  </body>
</html>
`;
}

function inferRoleAndCompany(text) {
  const match = text.match(/apply for the\s+(.+?)\s+role at\s+([A-Z0-9][A-Za-z0-9 &.-]+)/i);
  if (!match) return {};

  return {
    role: match[1].trim(),
    company: match[2].replace(/[.!?].*$/, "").trim(),
  };
}

function stripHeading(line) {
  return line.replace(/^#+\s*/, "").trim();
}

function firstEmail(line) {
  const match = line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function relativeStylesPath(outputPath) {
  const relative = path.relative(
    path.dirname(outputPath),
    path.join(path.dirname(outputPath), "styles.css"),
  );
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function toUrl(value) {
  if (!value) return "#";
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (/^linkedin\.com\//i.test(value)) return `https://www.${value}/`.replace(/\/+$/, "/");
  return `https://${value}`;
}

function linkify(html) {
  return html.replace(/\b((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/[A-Za-z0-9_-]+|[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?:\/[^\s<]*)?)\b/g, (value) => {
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return `<a href="${escapeAttribute(href)}">${value}</a>`;
  });
}

function formatInlineText(value) {
  const links = [];
  const tokenPrefix = "__COVER_LINK_";
  const withTokens = String(value).replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_match, text, href) => {
      const token = `${tokenPrefix}${links.length}__`;
      links.push(
        `<a href="${escapeAttribute(href)}">${escapeHtml(text)}</a>`,
      );
      return token;
    },
  );

  let html = linkify(escapeHtml(withTokens));
  links.forEach((link, index) => {
    html = html.replace(`${tokenPrefix}${index}__`, link);
  });
  return html;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
