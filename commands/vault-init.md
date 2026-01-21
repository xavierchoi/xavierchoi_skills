---
name: vault-init
description: Initialize Claude Vault folder structure with PARA method, templates, and CLAUDE.md files
allowed-tools:
  - Bash
  - Write
  - Read
  - Glob
---

# Vault Initialization

Initialize a new Claude Vault in the current directory with complete PARA folder structure.

## Behavior

1. **Check current directory** - Confirm this is the intended vault location
2. **Create PARA folders**:
   - `00_Inbox/` - Quick capture, temporary notes
   - `01_Projects/` - Active projects with goals and deadlines
   - `02_Areas/` - Ongoing responsibilities
   - `03_Resources/` - Topic-based knowledge
   - `04_Archive/` - Completed/inactive storage
   - `05_MOC/` - Maps of Content
   - `06_Daily/daily/` and `06_Daily/weekly/` - Time-based records
   - `07_Templates/` - Note templates

3. **Copy templates** from plugin to `07_Templates/`:
   - Read templates from `${CLAUDE_PLUGIN_ROOT}/templates/`
   - Write to vault's `07_Templates/` folder

4. **Create CLAUDE.md files**:
   - Root `CLAUDE.md` with vault overview and rules
   - Sub-folder `CLAUDE.md` files with area-specific instructions

## Root CLAUDE.md Content

```markdown
# Claude Vault

> AI-Native Personal Knowledge Management System
> Primary Interface: Claude Code | Sync: iCloud

---

## Philosophy

This vault uses **Claude Code as the primary interface**.
Obsidian editor is secondary; most operations happen through natural language.

### Core Principles
1. **Low friction**: Capture fast, organize later
2. **Context-first**: CLAUDE.md hierarchy defines rules per area
3. **Metadata-driven**: YAML frontmatter powers search & automation
4. **Progressive complexity**: Start simple, extend when needed

---

## Folder Structure (PARA-based)

| Folder | Purpose | Note Type |
|--------|---------|-----------|
| `00_Inbox` | Quick capture, temporary | fleeting |
| `01_Projects` | Active projects (goal + deadline) | project |
| `02_Areas` | Ongoing responsibilities | area |
| `03_Resources` | Topic-based knowledge | permanent |
| `04_Archive` | Completed/inactive storage | archived |
| `05_MOC` | Maps of Content | moc |
| `06_Daily` | Time-based records | daily, weekly |
| `07_Templates` | Template storage | template |

---

## Frontmatter Rules

### Required Fields
\`\`\`yaml
---
type: {note type}
created: {YYYY-MM-DD}
tags: []
---
\`\`\`

### Type Values
`fleeting` | `permanent` | `project` | `daily` | `weekly` | `moc` | `area`

### Additional Fields by Type
- **project**: `project`, `status` (active|paused|completed), `due`
- **permanent**: `topic`, `source`, `source_url`
- **daily**: `date`, `mood`, `energy`
- **weekly**: `week`, `date_start`, `date_end`

---

## Tag System

\`\`\`
Topic:   ai, ai/agents, programming, productivity, community
Status:  status/inbox, status/wip, status/review, status/done
Format:  format/article, format/book, format/paper, format/video
Action:  action/read, action/write, action/contact
\`\`\`

- Lowercase English, max 2 levels
- No overlap with folders (cross-cutting only)

---

## Workflow

\`\`\`
[Capture] → 00_Inbox (fleeting)
    ↓ Process
[Organize] → 01_Projects | 02_Areas | 03_Resources
    ↓ Accumulate
[Connect] → Structure in 05_MOC
    ↓ Complete
[Archive] → 04_Archive
\`\`\`

---

## Skills (Auto-triggered)

Custom skills activate automatically based on context.

| Skill | Trigger Context |
|-------|-----------------|
| vault-capture | Intent to quickly save thoughts/ideas |
| vault-process | Intent to organize Inbox items |
| vault-daily | Intent to record/review today |
| vault-weekly | Intent to review the week |
| vault-project | Intent to start new project |
| vault-search | Intent to find past records |
| vault-status | Intent to check progress |
| vault-moc | Intent to structure knowledge |
| vault-archive | Intent to store completed work |

---

## References

- Templates: `@07_Templates/`
```

## Sub-folder CLAUDE.md Templates

Create appropriate CLAUDE.md for each folder explaining its purpose and rules.

## After Initialization

- Confirm successful creation
- Show folder structure
- Suggest first steps: "Try saying 'capture an idea' or 'start my day'"
