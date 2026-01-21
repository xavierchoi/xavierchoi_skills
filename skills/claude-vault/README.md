# Claude Vault

> AI-Native Personal Knowledge Management System for Obsidian
> Primary Interface: Claude Code | Storage: Obsidian + iCloud

## Overview

Claude Vault transforms Obsidian from a passive note repository into an active thinking partner. Instead of manually organizing files and clicking through menus, you interact with your knowledge base through natural language conversations with Claude Code.

## Installation

### 1. Add Marketplace

```bash
/plugin marketplace add xavierchoi/xavierchoi_skills
```

### 2. Install Plugin

```bash
/plugin install claude-vault@xavierchoi-skills-marketplace
```

### 3. Restart Claude Code

Restart to load the new plugin.

## Quick Start

```bash
# Navigate to your Obsidian vault
cd ~/Documents/YourObsidianVault

# Start Claude Code
claude

# Initialize vault structure
/vault-init
```

Then just use natural language:
- "Remember this idea about AI agents"
- "Start my day"
- "What's in my inbox?"
- "Weekly review"

## Skills

| Skill | What It Does | Example Triggers |
|-------|--------------|------------------|
| **vault-capture** | Save thoughts quickly to Inbox | "Remember this...", "Quick note about..." |
| **vault-process** | Organize and classify Inbox items | "Process my inbox", "Organize my notes" |
| **vault-daily** | Create or update today's daily note | "Start my day", "Daily log" |
| **vault-weekly** | Create weekly review with highlights | "Weekly review", "How was my week?" |
| **vault-project** | Start a new project with structure | "Start a project for...", "New project:" |
| **vault-search** | Find notes by content, tags, or metadata | "Find notes about...", "Search for..." |
| **vault-status** | Check project progress and activity | "Project status", "What's active?" |
| **vault-moc** | Create or update Maps of Content | "Create overview of...", "Index my notes on..." |
| **vault-archive** | Move completed items to archive | "Archive this project", "This is done" |

## Folder Structure (PARA Method)

```
Your Vault/
├── 00_Inbox/           # Quick capture zone
├── 01_Projects/        # Active, time-bound work
├── 02_Areas/           # Ongoing responsibilities
├── 03_Resources/       # Reference materials
├── 04_Archive/         # Completed items
├── 05_MOC/             # Maps of Content
├── 06_Daily/           # Daily notes & weekly reviews
│   ├── daily/
│   └── weekly/
└── 07_Templates/       # Note templates
```

## Frontmatter

### Required Fields (All Notes)

```yaml
---
type: fleeting | permanent | project | daily | weekly | moc | area
created: YYYY-MM-DD
tags: []
---
```

### Type-Specific Fields

| Type | Additional Fields |
|------|-------------------|
| project | `project`, `status`, `due` |
| permanent | `topic`, `source`, `source_url` |
| daily | `date`, `mood`, `energy` |
| weekly | `week`, `date_start`, `date_end` |

## Tag System

```
Topic:   ai, ai/agents, programming, productivity
Status:  status/inbox, status/wip, status/review, status/done
Format:  format/article, format/book, format/paper
Action:  action/read, action/write, action/contact
```

## Workflow

```
[Capture] → 00_Inbox (fleeting)
    ↓ Process
[Organize] → 01_Projects | 02_Areas | 03_Resources
    ↓ Accumulate
[Connect] → Structure in 05_MOC
    ↓ Complete
[Archive] → 04_Archive
```

## License

MIT

## Author

Hunmin (Xavier) Choi
- Email: internetbasedboy@gmail.com
- GitHub: https://github.com/xavierchoi
