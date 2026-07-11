# Job Analysis - {{COMPANY}} {{ROLE}}

<!-- workflow-version: 2 -->

## Workflow State

- State file: `workflow-state.json`
- Current stage: imported
- Analysis status: pending
- Analysis confirmation: pending
- Modification plan: present after analysis confirmation; not a separate gate unless the user requests one
- Job source file: `job-posting.txt`

## Job Source

- Original source: {{SOURCE}}
- Final source URL: {{FINAL_URL}}
- Source type: {{SOURCE_TYPE}}
- Captured via: {{FETCHED_VIA}}
- Captured date: {{APPLICATION_DATE}}
- Application folder: `{{TASK_DIR}}/`
- Source SHA-256: `{{SOURCE_SHA256}}`
- Extraction status: {{EXTRACTION_STATUS}}

## Job Posting Information

- Company: {{COMPANY}}
- Job title: {{ROLE}}
- Location: {{LOCATION}}
- Workplace type: {{WORKPLACE_TYPE}}
- Employment type: {{EMPLOYMENT_TYPE}}
- Salary / pay range: {{SALARY}}
- Date posted: {{DATE_POSTED}}
- Valid through / closing date: {{VALID_THROUGH}}
- Seniority level: {{SENIORITY}}
- Job function: {{JOB_FUNCTION}}
- Industry: {{INDUSTRY}}

## Extraction Notes

{{EXTRACTION_NOTES}}

The complete cleaned posting is stored in `job-posting.txt`. Review that file during import and analysis; later phases should use the compact decisions below instead of duplicating or repeatedly loading the full posting.

## Job Summary

TODO: Summarize the role's purpose, top hiring signals, level, and product or business context.

## Company And Role Signals

- Research mode: off / standard / deep
- Company website or careers page reviewed: yes / no / not accessible
- Product, service, customer, or business context:
- Repeated company or role language worth reflecting:
- Same-role signals reviewed: yes / no / not accessible
- Signals intentionally excluded as unsupported or generic:

## Evidence And Placement Matrix

Use this as the single requirement, evidence, ATS, and placement matrix. Do not repeat the same analysis in separate tables.

| Requirement Or Keyword | Priority | Priority Reason | Verified Evidence / Source | Evidence Strength | Resume Placement | Rewrite Strategy |
| --- | --- | --- | --- | --- | --- | --- |
| TODO | Must / Should / Optional / Unsupported | Listed early / repeated / required / core responsibility / screening tool / nice-to-have | TODO | Strong / transferable / weak / unsupported | Summary / Project / Experience / Skills / omit | TODO |

## ATS Keywords

### Must Use

- TODO: Add reviewed, supported keywords that must appear naturally in the target resume.

### Should Use

{{SUGGESTED_KEYWORDS}}

### Optional

- TODO: Add low-priority synonyms or secondary tools only when natural.

### Unsupported / Do Not Use

- TODO: Add unsupported tools, seniority claims, credentials, or experience that must not appear in the resume.

## Missing Or Risky Requirements

- Requirement:
- Risk:
- Question for user:
- Reusable fact confirmed by user: yes / no
- Fact base module updated:
- Evidence map updated: yes / no

## Experience Order Analysis

- Top hiring signals:
- Reverse chronological option:
- Relevance-led option:
- Recency versus relevance decision:
- Recommended section order and truthful section label:
- ATS or recruiter-readability risk:

## Writing Strategy

- Core fit signal:
- Summary focus:
- Project focus:
- Experience focus:
- Skills focus:
- Target headline / bridge wording:
- Formal experience titles, employers, dates, and locations unchanged: yes / no
- Public-profile consistency checked: yes / no / not accessible
- Evidence intentionally omitted:
- Human voice constraints:
- Bullet hierarchy and rendered line budget:

## Template And Layout

- Resume template mode: default / custom
- Resume page target: 1
- Cover letter template mode: default / custom
- Cover letter page target: 1
- ATS template risk choice: default / ATS-first adaptation / visual-faithful
- Contact treatment: inline one-line / compact split
- Side padding unchanged: yes / no
- Allowed default-template gaps: 2px, 4px
- Layout compression order: improve bullet quality -> shorten weak or near-threshold copy -> move compact keywords -> merge or remove low-value evidence -> allowed local gap adjustment
- Print clipping avoided: yes / no

## User Decisions

- Analysis confirmed: no
- Separate modification-plan confirmation requested by user: no
- Compare preference: ask / generate / skip
- Cover letter: ask / requested / required / skip
- Application log: ask / update after confirmation / skip

## Validation And Outputs

- Target HTML: pending
- Target CSS: pending
- ATS report: pending
- ATS result: pending
- Layout result: pending
- Compare preview: pending / not requested
- Resume PDF: pending
- Resume PDF pages: pending
- Cover letter Markdown / HTML / PDF: pending / not requested
- Application log: not updated
- Remaining factual risks:
