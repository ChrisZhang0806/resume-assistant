# Development Guide: File Isolation & Workspace Management

This guide explains how to manage your resume-assistant project as a continuously evolving tool while keeping private workspace data separate from publishable code.

## Problem Statement

As an author iterating on this project, you face three challenges:

1. **Data Privacy**: Personal facts, completed resumes, applications, and job descriptions should never be committed publicly.
2. **Bidirectional Safety**: Local improvements to the skill should upgrade the published version without damaging your working files when pulling updates.
3. **Development Workflow**: You need to simultaneously test new skill versions while maintaining active job applications.

## Solution: Three-Layer File Architecture

### Layer 1: Core Publishable Skill (Repository Public)

**Location**: `codex-skills/` and `starter-workspace/` (minus data files)

**What's tracked**:
- Executable scripts in `scripts/`
- Workflow definitions in `codex-skills/resume-assistant/`
- Templates and configuration in `base/`
- Documentation and checklists

**What's ignored**:
- User-filled master facts
- Generated applications
- Completed resumes

```
codex-skills/resume-assistant/
├── SKILL.md                    ✅ Published
├── agents/
│   └── openai.yaml            ✅ Published
├── references/
│   └── resume-assistant-workflow.md  ✅ Published
starter-workspace/
├── base/
│   ├── index.html              ✅ Published (placeholder template)
│   ├── styles.css              ✅ Published (base styles)
│   └── cover-letter-template.html  ✅ Published
├── master/master-resume.md     ✅ Published (structure only)
├── master/master-data/
│   ├── 00-index.md            ✅ Published (guide)
│   ├── profile.md             ✅ Published (template)
│   ├── skills.md              ✅ Published (template)
│   └── ...other templates     ✅ Published
└── scripts/                    ✅ Published
```

### Layer 2: Local Development Copy (Machine Private)

**Location**: `~/Documents/resume-assistant-dev/` (or similar private location)

**Your working copy for testing and development**:

```
~/Documents/resume-assistant-dev/
├── .git → upstream: ChrisZhang0806/resume-assistant
├── LOCAL-RULES.md              🔐 Your local conventions
├── AGENTS.md                   🔐 Your local skill rules (overrides published SKILL.md)
├── Skills.md or skills.md      🔐 Your project-specific guidance
├── codex-skills/
│   └── resume-assistant/       ← Mirrors published version, test new features here
├── starter-workspace/
│   ├── base/
│   │   ├── index.html          🔐 Your actual resume template
│   │   └── styles.css          🔐 Your actual resume CSS
│   ├── master/
│   │   ├── master-resume.md    🔐 Your actual resume structure
│   │   ├── master-data/
│   │   │   ├── profile.md      🔐 YOUR PERSONAL INFO (name, email, phone, etc.)
│   │   │   ├── experience/
│   │   │   ├── projects/
│   │   │   └── education-certification.md
│   │   └── narrative/          🔐 Career story, portfolio bios
│   ├── applications/           🔐 Job-specific outputs (growing over time)
│   ├── application-log.md      🔐 Your job tracking
│   ├── templates/custom/       🔐 Your custom template iterations
│   └── .gitignore              🔐 Strict local rules
└── archived-jobs/              🔐 Old applications (local backup only)
```

### Layer 3: Shared Skill Installation (System Location)

**Location**: `~/.codex/skills/resume-assistant/` (or equivalent Codex skills directory)

**What it contains**: Published version of the skill, auto-installed from the public repo.

```
~/.codex/skills/resume-assistant/
├── SKILL.md
├── agents/
├── references/
└── scripts/
```

---

## Bidirectional Update Workflow

### Scenario A: You Improve the Skill and Want to Publish

Example: You fixed a bug in `scripts/verify-layout.mjs` or improved `SKILL.md` workflow rules.

**Steps**:

1. **Develop in your local copy** (`~/Documents/resume-assistant-dev/`):
   ```bash
   cd ~/Documents/resume-assistant-dev
   # Edit scripts/verify-layout.mjs, test locally
   npm run verify-layout -- "starter-workspace/base/index.html" -v
   ```

2. **Verify the change doesn't touch personal data**:
   ```bash
   # Check git status — should NOT include master-data/, applications/, etc.
   git status
   git diff scripts/verify-layout.mjs  # Review changes only
   ```

3. **Create a focused commit in your local copy**:
   ```bash
   git add codex-skills/resume-assistant/ scripts/
   git commit -m "fix(layout-verifier): handle custom gap values correctly"
   ```

4. **Push only the skill files to the public repo**:
   ```bash
   git push origin main
   ```
   (Git will push only committed files; `.gitignore` prevents accidental personal data commits)

5. **Update your Codex skill cache** (reinstall from repo):
   ```bash
   rm -rf ~/.codex/skills/resume-assistant/
   mkdir -p ~/.codex/skills/resume-assistant
   cp -R codex-skills/resume-assistant/. ~/.codex/skills/resume-assistant/
   ```

---

### Scenario B: Public Repo Gets Updates (e.g., Bug Fix) and You Pull

Example: The maintainer (or you from another machine) pushed a fix to `references/resume-assistant-workflow.md`.

**Steps**:

1. **Fetch upstream without auto-merging your private files**:
   ```bash
   cd ~/Documents/resume-assistant-dev
   git fetch origin main
   ```

2. **Review the incoming changes**:
   ```bash
   git log --oneline origin/main..HEAD  # Your local commits not yet pushed
   git log --oneline HEAD..origin/main  # Incoming commits
   git diff HEAD...origin/main -- codex-skills/ starter-workspace/base/ starter-workspace/scripts/
   ```

3. **Rebase or merge carefully** (rebase is safer for this pattern):
   ```bash
   # Option 1: Rebase your local improvements on top of upstream
   git rebase origin/main
   
   # Option 2: Merge and resolve conflicts manually
   git merge origin/main
   ```

4. **Verify your private master data is untouched**:
   ```bash
   git status starter-workspace/master/master-data/
   # Should show no changes (all local files in .gitignore)
   ```

5. **Test the merged version**:
   ```bash
   npm run doctor
   npm run verify-layout -- "starter-workspace/base/index.html" -v
   ```

6. **If everything works, update Codex cache**:
   ```bash
   cp -R codex-skills/resume-assistant/. ~/.codex/skills/resume-assistant/
   ```

---

## File Isolation Patterns

### Pattern 1: Local Project Rules Override Published Skill

The SKILL.md in the published repo has generic instructions. You can create local overrides:

```markdown
# LOCAL-RULES.md (in ~/Documents/resume-assistant-dev/)

## Deviations from SKILL.md

1. **Cover letter page target**: I always use 1 page (not flexible).
2. **Custom section names**: My projects are under `master/master-data/work/` (not `experience/`).
3. **Master data updates**: Only I should edit profile.md. The agent should ask first.
4. **Template**: I use a 2-page custom template, not the starter 1-page default.
```

**Then reference this in your AGENTS.md**:

```markdown
# AGENTS.md (in ~/Documents/resume-assistant-dev/)

> **First:** Read LOCAL-RULES.md. These rules override the published SKILL.md where different.

[rest of your project rules]
```

**When you install the skill in Codex, you tell it**:

```
Use $resume-assistant to tailor my resume.
First read my local AGENTS.md, then follow the published SKILL.md workflow.
```

---

### Pattern 2: Strict .gitignore for Private Data

Create a **layered .gitignore** structure:

**Root `.gitignore`** (committed, published):
```ignore
# Private Resume Assistant workspace data
/starter-workspace/master/master-data/
!/starter-workspace/master/master-data/00-index.md
!/starter-workspace/master/master-data/[profiles, skills, evidence-map].md  # templates only
!/starter-workspace/master/master-data/experience/
!/starter-workspace/master/master-data/projects/
/starter-workspace/applications/
/starter-workspace/application-log.md
/starter-workspace/master/master-resume.md
/starter-workspace/master/narrative/
/starter-workspace/base/index.html  # but publish the template
!/starter-workspace/base/
/archived-jobs/
/local-workspace/
```

**Local `.gitignore.local`** (NOT committed, machine-specific):
```ignore
# Your local machine's exact private files
starter-workspace/master/master-data/profile.md
starter-workspace/master/master-data/experience/*.md
starter-workspace/master/master-data/projects/*.md
starter-workspace/base/index.html
starter-workspace/base/styles.css
.env
.codex-local/
```

**Load local ignore rules** (in your git config):
```bash
cd ~/Documents/resume-assistant-dev
git config core.excludesFile .gitignore.local
```

---

### Pattern 3: Template Placeholders Always Safe to Commit

When you commit template files (not data), use placeholder patterns:

**Safe to publish** (`starter-workspace/master/master-data/profile.md`):
```markdown
# Candidate Profile

## Identity And Contact

- Name: **[Your Full Name]**
- Email: **[your-professional-email@example.com]**
- Phone: **[+1 (000) 000-0000]**
```

**NOT safe** (don't commit):
```markdown
# Candidate Profile

## Identity And Contact

- Name: **Ning Zhang**
- Email: **ning.zhang@example.com**
- Phone: **+1 (403) 555-1234**
```

---

### Pattern 4: Version-Controlled Master Data Schema (Safe to Share)

You can track the *structure* of your master data without the data:

**Publish this** (`starter-workspace/master/master-data/00-index.md`):
```markdown
## Your Master Data Structure

```
master-data/
├── profile.md                              # Contact, roles, positioning
├── skills.md                               # Tools, methods, languages
├── education-certification.md              # Schools, degrees, certs
├── evidence-map.md                         # Job keyword → evidence mapping
├── career-story.md                         # Optional: your narrative
├── experience/
│   ├── my-current-role.md                 # Current work
│   ├── previous-product-work.md           # Key prior role
│   └── earlier-roles.md                   # Older roles (brief)
├── projects/
│   ├── flagship-project.md                # Main portfolio piece
│   ├── secondary-project.md               # Secondary work
│   └── open-source-contrib.md             # Community/OSS
└── narrative/
    └── career-transition-story.md         # Optional: if career shift
```
```

**Don't publish the filled versions**—only the schema and placeholders.

---

## Implementation Checklist

### Step 1: Set Up Your Local Development Copy

```bash
# Create isolated local workspace
mkdir -p ~/Documents/resume-assistant-dev
cd ~/Documents/resume-assistant-dev

# Clone your fork
git clone https://github.com/ChrisZhang0806/resume-assistant.git .

# Configure git to ignore local files
git config core.excludesFile .gitignore.local
echo "starter-workspace/master/master-data/profile.md" >> .gitignore.local
echo "starter-workspace/base/index.html" >> .gitignore.local
echo "starter-workspace/applications/" >> .gitignore.local
echo ".env" >> .gitignore.local
echo ".DS_Store" >> .gitignore.local

# Verify private files are ignored
git status  # Should NOT show your personal files
```

### Step 2: Create Local Override Documents

```bash
# Create LOCAL-RULES.md
cat > LOCAL-RULES.md << 'EOF'
# Local Development Rules

## Deviations from SKILL.md

1. Resume template: Custom 2-page template at starter-workspace/base/
2. Master data location: starter-workspace/master/master-data/ (standard)
3. Local instructions: Use AGENTS.md (not SKILL.md) when installed locally
4. Application folder format: applications/YYYY-MM-DD-company-role/

## What Not to Commit

- starter-workspace/master/master-data/[filled data]
- starter-workspace/applications/[job-specific files]
- .env, .codex-local/, archived-jobs/

EOF

# Create AGENTS.md (your local skill override)
cat > AGENTS.md << 'EOF'
# Local Project Agent Instructions

> **Priority**: Follow this AGENTS.md (local to ~/Documents/resume-assistant-dev/) 
> before the published codex-skills/resume-assistant/SKILL.md

[Your project-specific rules here]

EOF

git add LOCAL-RULES.md AGENTS.md
git commit -m "docs: add local development guidelines"
```

### Step 3: Protect Against Accidental Commits

```bash
# Create a git hook that warns before committing personal files
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Warn if trying to commit master data files

files_to_check=(
  "starter-workspace/master/master-data/profile.md"
  "starter-workspace/master/master-data/experience/"
  "starter-workspace/master/master-data/projects/"
  "starter-workspace/applications/"
  ".env"
)

for file in "${files_to_check[@]}"; do
  if git diff --cached --name-only | grep -q "$file"; then
    echo "⚠️  WARNING: Attempting to commit private file: $file"
    echo "This file is in .gitignore.local and should not be public."
    echo "To proceed anyway, use: git commit --no-verify"
    exit 1
  fi
done

exit 0
EOF

chmod +x .git/hooks/pre-commit
```

### Step 4: Document Update Paths

```bash
# Create UPDATE-WORKFLOW.md for future reference
cat > UPDATE-WORKFLOW.md << 'EOF'
# Publishing and Pulling Updates

## Publishing a Skill Improvement

```bash
# Develop and test locally
cd ~/Documents/resume-assistant-dev
git add codex-skills/ starter-workspace/scripts/
git commit -m "feat: [your improvement]"
git push origin main

# Reinstall in Codex
rm -rf ~/.codex/skills/resume-assistant/
mkdir -p ~/.codex/skills/resume-assistant
cp -R codex-skills/resume-assistant/. ~/.codex/skills/resume-assistant/
```

## Pulling Updates from Main Repo

```bash
cd ~/Documents/resume-assistant-dev
git fetch origin main
git rebase origin/main  # or: git merge origin/main
git status  # Verify private files untouched
npm run doctor
```

EOF

git add UPDATE-WORKFLOW.md
git commit -m "docs: add update workflow guide"
```

---

## Safety Guarantees

| Scenario | Risk | Mitigation | Result |
|----------|------|-----------|--------|
| You push local files by mistake | Personal data exposed | Pre-commit hook + `.gitignore.local` | ✅ Blocked at git level |
| You pull updates that overwrite base files | Your improved templates lost | Rebase on published changes, test before merging | ✅ Your edits preserved |
| You forget which files are private | Data leaks | AGENTS.md and LOCAL-RULES.md document structure | ✅ Clear mapping |
| Codex reads stale skill version | Workflow breaks | Sync Codex skills after push | ✅ Always in sync |
| You need to iterate quickly without publishing | Disrupts public repo | Work in local copy, publish only when stable | ✅ Clean history |

---

## Example: A Complete Iteration Cycle

```bash
# Day 1: You improve a script locally
cd ~/Documents/resume-assistant-dev
# Edit starter-workspace/scripts/verify-layout.mjs
npm run verify-layout -- "starter-workspace/base/index.html" -v  # Test it
git diff starter-workspace/scripts/verify-layout.mjs  # Review
git add starter-workspace/scripts/
git commit -m "fix(layout): handle 2px and 4px gaps correctly"

# Day 2: Test with your real job application
npm run import-job -- "https://example.com/job-123"
npm run verify-layout -- "starter-workspace/applications/2024-01-15-acme-designer/resume.html" -v
# Works great, so publish it

# Day 3: Push to GitHub
git push origin main

# Day 4: Update system Codex installation
rm -rf ~/.codex/skills/resume-assistant/
mkdir -p ~/.codex/skills/resume-assistant
cp -R codex-skills/resume-assistant/. ~/.codex/skills/resume-assistant/

# Day 10: Upstream had a bug fix, you pull it
git fetch origin main
git rebase origin/main  # Clean rebase onto upstream
git status  # Verify: starter-workspace/master-data/ untouched ✅

# Day 11: You add new job keywords to evidence-map.md
# (part of your master-data/, so NOT published)
# Continue working, add to applications/, etc.
git status  # Still clean; these files in .gitignore.local ✅
```

---

## Summary

This three-layer architecture gives you:

1. ✅ **Publication safety**: Private data never committed
2. ✅ **Development freedom**: Local experiments don't break public repo
3. ✅ **Bidirectional updates**: Pull improvements without losing your work
4. ✅ **Clear separation**: Skill code ≠ workspace data ≠ personal facts
5. ✅ **Audit trail**: Every published improvement is tracked; personal work stays local

The key is: **All publishable code lives in `codex-skills/` and `starter-workspace/[templates/scripts/base/]`. All personal work lives in `starter-workspace/master/master-data/` and `applications/`, which stay local.**
