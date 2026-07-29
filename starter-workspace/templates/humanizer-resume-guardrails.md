# Humanizer Guardrails For Job Materials

Use the installed `blader/humanizer` Skill as a language-editing gate after an evidence-first draft. The current reviewed installation is Humanizer v2.8.2.

Humanizer may improve rhythm, specificity of phrasing, sentence variety, and candidate voice. It must not change the evidence model, application strategy, document structure, or validation requirements.

## Allowed Scope

- Resume: Summary and candidate-authored project or experience prose.
- Cover letter: salutation, body prose, and signoff wording when appropriate.
- Voice calibration: use only a writing sample the candidate owns or supplied. If none is available, use restrained, professional English rather than inventing a personality.

Do not run Humanizer on names, contact details, links, formal employers, formal job titles, dates, locations, credentials, certifications, section headings, compact Skills lists, role/company names, or machine-readable workflow data.

## Protected Content

Before the pass, make a compact checklist of:

- every verified fact, metric, outcome, tool, credential, date, and evidence boundary in scope;
- every supported ATS `Must Use` term and any exact product, platform, domain, or method wording;
- every verified cover-letter observation, judgment, trade-off, work preference, transition reason, and candidate-specific detail;
- the active word, paragraph, page, bullet-line, HTML, and template constraints.

Humanizer changes language only. It must not add anecdotes, opinions, humor, tangents, uncertainty, casual fragments, unsupported specificity, company research, or new claims. For resumes, disable the Skill's optional personality-and-soul additions. For cover letters, warmth may come only from the candidate's verified details and demonstrated voice; preserve those human signals instead of replacing them with polished corporate phrasing.

## Required Sequence

1. Draft from confirmed evidence anchors first.
2. Snapshot protected content and ATS terms.
3. Invoke `$humanizer` in neutral professional mode only on the allowed prose.
4. Review the diff. Reject any unsupported addition or protected-token change instead of rationalizing it.
5. Recheck facts, ATS coverage, active word/paragraph limits, and layout after accepted edits.
6. Export or present the document only after its normal workflow gates pass.

Do not optimize for AI-detector scores or promise that text will bypass detection. The goal is clear, credible, candidate-specific English.

Record the Skill version, edited scope, voice sample used or `Not provided`, protected-fact result, ATS regression result, and layout recheck in `job-analysis.md`.
