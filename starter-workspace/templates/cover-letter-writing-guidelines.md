# Cover Letter Writing Guidelines

Use this guide only when a posting requires a cover letter or the user requests one. The letter is a specific job-match note, not a second resume.

## Default Format

- One A4 page.
- Exactly three short body paragraphs.
- 220–300 body words.
- Simple, professional, sincere English.
- A private rule, current user request, or application requirement may override length, structure, or the confirmation gate.

Resolve and record active constraints before drafting. Count body words before presenting or rendering the draft. Headers, address/contact lines, salutation, and signature are not body paragraphs. Pass explicit renderer options when the recorded format differs from the default.

## Contact Contract

- Candidate name and a valid email address are required.
- Location, phone, portfolio, and LinkedIn are optional.
- Remove an unavailable optional field instead of leaving a placeholder.
- Any supplied link or phone value must be valid; the renderer outputs only fields that are present.

## Choose One Unanswered Hiring Question

The letter should do one useful job that the confirmed resume does not already do:

- translate a non-obvious background into the target role;
- prove one central capability with a concrete example;
- clarify one material concern that could block an interview;
- explain why this kind of work is a credible next step now.

Select one primary question. Do not turn the letter into a second resume or a list of every possible qualification.

Being a company-product user is never required. Use product experience only when it is true and relevant. Company or role specificity may instead come from the work problem, audience, industry, team stage, public project, or the candidate's genuine reason for doing this kind of work.

## Minimal Evidence

Start from the confirmed `job-analysis.md`, target resume, and one primary evidence source. Read only the profile/contact headings and one additional differentiator needed for the letter. Do not load or restate the complete fact base.

Use two or three verified matching points total:

- one or two concrete needs from the posting;
- one strongest project or experience as primary proof;
- one differentiating background point only when it improves the match.

Never invent company research, personal connections, tools, credentials, metrics, outcomes, work authorization, identity details, or application channels.

## Candidate Fingerprint

A natural letter lets the reviewer see how the candidate notices, decides, and works. Include:

- at least two verified details another applicant could not copy from the posting;
- one observation, judgment, trade-off, or genuine work preference;
- one useful point that adds to, rather than paraphrases, the resume.

This does not require a personal anecdote. Do not force hobbies, humor, hardship, product fandom, or an origin story. A hobby belongs only when it explains relevant craft, observation, motivation, or the application asks for it.

## Three-Paragraph Structure

### Paragraph 1: Credible Connection

Explain why this role or work is a credible next step for this candidate. Open with a real connection, not a generic statement of enthusiasm.

### Paragraph 2: Primary Evidence

Use one project or experience. Show the context or friction point, the candidate's action or judgment, and the resulting value. Do not summarize several projects or repeat resume bullets verbatim.

### Paragraph 3: Relevant Dimension And Close

Address one material concern only when it genuinely affects screening. Otherwise add a relevant work preference or differentiator, explain practical value, and close simply. A specific portfolio or discussion handoff is optional.

## Paragraph Continuity

Build one chain: credible connection -> primary proof -> role value and close. Paragraph 2 should pick up the claim or work problem introduced in paragraph 1. Paragraph 3 should explain what the proof means for the target role; do not restart with an unrelated story or introduce a new major qualification.

## Evidence-Backed Voice

Open with a candidate-owned observation, decision, or reason for pursuing the work, not `I am writing to apply`. Use concrete nouns and verbs, restrained professional English, and varied sentence lengths. Let verified actions demonstrate qualities instead of naming traits without proof. When useful, compress context, action, and value into one compact work scene rather than an inventory of claims. Follow the candidate's writing sample, voice traits, and contractions preference when provided.

## Voice And Keyword Use

Use a few priority terms naturally when they are supported. Do not mirror the posting or keyword-stuff.

Prefer concrete context, judgment, and relevance. Avoid:

- `perfect fit`, `uniquely qualified`, or `passionate professional`;
- `I am excited to leverage my skills`;
- generic praise that could address any company;
- inflated adjectives and unsupported impact;
- paragraphs that merely convert resume bullets into prose.

The final draft should sound human-edited and candidate-specific. A useful detail is one another applicant could not copy from the job ad: project context, design or technical judgment, a career-transition explanation, or a targeted portfolio handoff.

## Optional Humanizer Edit

When `$humanizer` is installed, draft from verified evidence first, then run it on prose under `templates/humanizer-resume-guardrails.md`. Calibrate to a candidate-owned writing sample when available; otherwise keep the voice restrained and professional.

Preserve active word/paragraph limits, candidate fingerprint, facts, names, role/company details, metrics, links, and supported keywords. Reject invented anecdotes, opinions, research, connections, or specificity. Humanizer should improve rhythm and plain language without removing a verified observation, decision, trade-off, work preference, or transition reason.

## Resume And Portfolio Relationship

- The resume proves qualifications through facts, titles, tools, and outcomes.
- The letter explains why one strongest proof point matters to this role.
- The portfolio or interview carries detailed process and storytelling.

## Quality Gate

Before presenting `cover-letter.md`, verify:

- active body-word and paragraph limits are satisfied;
- correct candidate, company, role, and required email;
- optional contact fields are valid or removed;
- only verified evidence and supported keywords;
- one unanswered hiring question and one primary proof point;
- a continuous role connection -> proof -> role value/close paragraph chain;
- a candidate-owned opening and evidence-backed voice;
- candidate fingerprint requirements pass;
- at least one useful point is new relative to the resume;
- the role-swap and read-aloud tests pass;
- no resume repetition, forced product/company praise, keyword-spun boilerplate, or generic AI phrasing;
- any Humanizer diff was reviewed with facts, keywords, and format constraints unchanged;
- a useful specific portfolio or discussion handoff when relevant.

If a check fails, replace generic or duplicated content with verified context, judgment, or motivation; do not fix it with synonym swaps. Repeat the quality gate after each rewrite.

After the user confirms the Markdown draft, render HTML, verify layout, export PDF, and check actual page count. If the active confirmation gate is waived, continue directly through those steps.
