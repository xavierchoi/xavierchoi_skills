# Symphony Skill

A Claude Code skill for orchestrating parallel phase execution from plan files. Symphony parses `symphony-phases` blocks from markdown plans, builds a dependency DAG, and executes phases concurrently using the Task tool.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Automatic Retry](#automatic-retry)
- [Statusline Visualization](#statusline-visualization)
- [Trigger Keywords](#trigger-keywords)
- [Plan File Format](#plan-file-format)
- [Phase Schema](#phase-schema)
- [CLI Scripts](#cli-scripts)
- [Example Workflow](#example-workflow)
- [State Management](#state-management)

---

## Overview

Symphony solves the challenge of executing complex, multi-step development plans efficiently. Instead of running tasks sequentially, Symphony:

- **Parses structured plans** from markdown files containing `symphony-phases` code blocks
- **Resolves dependencies** using a Directed Acyclic Graph (DAG) with Kahn's algorithm
- **Executes phases in parallel** when dependencies allow, using Claude Code's Task tool
- **Propagates artifacts** between phases, so dependent phases receive outputs from their prerequisites
- **Tracks execution state** in a JSON file for monitoring and recovery

This enables you to describe a complex implementation plan once, then let Symphony orchestrate the execution automatically.

---

## Installation

Symphony can be installed as a **project-local skill** or a **personal skill**. See [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) for more details.

### Prerequisites

- [Claude Code CLI](https://claude.com/claude-code) installed and configured
- [Bun](https://bun.sh) runtime (for running the CLI scripts)

### Option 1: Project-Local Installation (Recommended)

Copy the `symphony` folder to your project's `.claude/skills/` directory:

```bash
# From your project root
mkdir -p .claude/skills
cp -r path/to/symphony .claude/skills/
```

This makes Symphony available only within this project and allows version control.

### Option 2: Personal Installation

Copy to your personal skills directory for global access:

```bash
# Available across all projects
mkdir -p ~/.claude/skills
cp -r path/to/symphony ~/.claude/skills/
```

### Option 3: Clone from Repository

```bash
# Project-local
git clone https://github.com/anthropics/symphony .claude/skills/symphony

# Or personal
git clone https://github.com/anthropics/symphony ~/.claude/skills/symphony
```

### Verify Installation

```bash
# Check SKILL.md exists
ls .claude/skills/symphony/SKILL.md   # project-local
ls ~/.claude/skills/symphony/SKILL.md  # personal
```

Claude Code automatically discovers skills at startup and activates them when trigger keywords are used.

---

## Quick Start

### 1. Create a Plan File

Create a markdown file with a `symphony-phases` code block. Save it as `plan.md` in your project root or in `~/.claude/plans/`:

```markdown
# API Implementation Plan

This plan implements a REST API with authentication.

\`\`\`symphony-phases
[
  {
    "id": "setup-database",
    "title": "Setup Database",
    "objective": "Initialize the database schema",
    "tasks": ["Create users table", "Create sessions table"],
    "dependencies": [],
    "complexity": "low",
    "required_context": {
      "files": [],
      "concepts": ["SQL", "Database design"],
      "artifacts_from": []
    },
    "success_criteria": "Database tables created successfully"
  },
  {
    "id": "implement-auth",
    "title": "Implement Authentication",
    "objective": "Add JWT-based authentication",
    "tasks": ["Create login endpoint", "Add auth middleware"],
    "dependencies": ["setup-database"],
    "complexity": "medium",
    "required_context": {
      "files": ["src/routes/*.ts"],
      "concepts": ["JWT", "bcrypt"],
      "artifacts_from": ["setup-database"]
    },
    "success_criteria": "Login returns valid JWT token"
  }
]
\`\`\`
```

### 2. Trigger Orchestration

Use one of the trigger keywords in your conversation with Claude Code:

```
conduct the plan
```

or

```
orchestrate my implementation plan
```

Symphony will parse the plan, resolve dependencies, and begin executing phases.

---

## How It Works

### Plan Mode Integration

Symphony integrates with Claude Code's Plan Mode workflow:

1. **Create Plan**: Use Plan Mode to create a detailed implementation plan
2. **Add symphony-phases Block**: Structure your plan with a `symphony-phases` JSON block
3. **Exit Plan Mode**: Complete your planning session
4. **Conduct**: Say "conduct" or use another trigger keyword to start orchestration

### DAG-Based Dependency Resolution

Symphony uses Kahn's algorithm for topological sorting to:

- **Detect cycles**: Ensures the dependency graph is valid (no circular dependencies)
- **Determine execution order**: Calculates which phases can run in parallel
- **Identify ready phases**: Finds phases whose dependencies are all complete

```
Level 0: [setup-database, setup-config]     <- No dependencies, run in parallel
Level 1: [implement-auth, implement-api]    <- Depends on level 0
Level 2: [integration-tests]                <- Depends on level 1
```

### Parallel Execution via Task Tool

Phases are executed using Claude Code's Task tool:

- Each phase runs as an independent task
- Multiple tasks can run concurrently (up to 4 recommended)
- Tasks receive structured prompts with objectives, context, and artifacts

### Artifact Propagation

When a phase completes, it can produce artifacts (files created, exports, notes) that are passed to dependent phases:

1. Phase A completes and reports artifacts
2. Symphony stores artifacts in state
3. When Phase B (which lists A in `artifacts_from`) starts, it receives A's artifacts in its prompt

---

## Automatic Retry

Symphony automatically retries failed phases with intelligent error classification and exponential backoff.

### Default Retry Policy

Applied automatically without configuration:

| Setting | Value |
|---------|-------|
| Max Retries | 2 (total 3 attempts) |
| Backoff Strategy | Exponential with jitter |
| Initial Delay | 5 seconds |
| Max Delay | 60 seconds |

### Error Classification

Errors are automatically classified to determine retry behavior:

| Category | Examples | Auto-Retry |
|----------|----------|------------|
| `transient` | Rate limit, timeout, 503 error | Yes |
| `resource` | File not found, permission denied | Yes |
| `timeout` | Phase execution timeout | Yes |
| `unknown` | Unclassified errors | Yes |
| `logic` | Test failed, type error, lint error | No |
| `permanent` | Syntax error, invalid config | No |

### User Decision Flow

When all retries are exhausted, you're prompted with options:

```
Phase "build-frontend" failed after 3 attempts.
Error: Connection timeout (category: transient)

What would you like to do?
[1] Retry once more
[2] Skip phase (continue with dependents)
[3] Abort branch (stop this and dependent phases)
[4] Abort all (stop entire orchestration)
```

---

## Statusline Visualization

Display real-time orchestration progress in Claude Code's statusline.

### Output Format

```
[████░░░░░░] 4/10 (1!) | setup-db, auth-middleware
```

- **Progress bar**: Green for completed, gray for remaining
- **Count**: Completed/total phases
- **Failures**: Red indicator if any failures (e.g., `(1!)`)
- **Running phases**: Currently executing phase names in yellow

### Setup

Add to your `.claude/settings.json`. See [Claude Code Statusline Documentation](https://code.claude.com/docs/en/statusline) for more details.

**Project-local skill:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun .claude/skills/symphony/scripts/statusline.ts"
  }
}
```

**Personal skill:**

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun ~/.claude/skills/symphony/scripts/statusline.ts"
  }
}
```

### Terminal States

| State | Display |
|-------|---------|
| Running | `[████░░░░░░] 4/10 \| phase-names` |
| Completed | `[Done] 10/10` (green) |
| Failed | `[Failed] 7/10` (red) |
| Aborted | `[Aborted] 5/10` (gray) |
| Not running | (no output) |

### Combining with Other Statuslines

Create a wrapper script to combine Symphony status with other information:

```bash
#!/bin/bash
# ~/.claude/statusline-wrapper.sh

symphony=$(bun .claude/skills/symphony/scripts/statusline.ts 2>/dev/null)
git_branch=$(git branch --show-current 2>/dev/null)

parts=()
[ -n "$symphony" ] && parts+=("$symphony")
[ -n "$git_branch" ] && parts+=("$git_branch")

IFS=' | '
echo "${parts[*]}"
```

---

## Trigger Keywords

The Symphony skill activates when you use any of these keywords:

| Keyword | Language |
|---------|----------|
| `conduct` | English |
| `orchestrate` | English |
| `execute plan` | English |
| `run phases` | English |
| `symphony` | English |

**Note**: Korean trigger keywords are also supported for Korean-speaking users.

---

## Plan File Format

Plans are markdown files containing a `symphony-phases` code block:

```markdown
# Project Plan Title

Description of the project and goals...

\`\`\`symphony-phases
[
  { "id": "phase-1", ... },
  { "id": "phase-2", ... }
]
\`\`\`

Additional notes or documentation...
```

### Plan Discovery

Symphony searches for plans in this order:

1. Plan path provided in conversation context
2. Most recently modified `.md` file in `~/.claude/plans/`
3. `plan.md` in the current working directory

---

## Phase Schema

Each phase in the `symphony-phases` array requires the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (kebab-case, max 64 chars) |
| `title` | string | Yes | Human-readable name |
| `objective` | string | Yes | Clear goal statement |
| `tasks` | string[] | Yes | Specific action items (min 1) |
| `dependencies` | string[] | No | IDs of phases that must complete first |
| `complexity` | "low" \| "medium" \| "high" | No | Effort level (default: "medium") |
| `required_context.files` | string[] | No | File paths to include in context |
| `required_context.concepts` | string[] | No | Domain knowledge needed |
| `required_context.artifacts_from` | string[] | No | Phase IDs to receive artifacts from |
| `success_criteria` | string | Yes | Verifiable completion condition |
| `constraints` | string[] | No | Things the phase should NOT do |

### Example Phase

```json
{
  "id": "implement-user-auth",
  "title": "Implement User Authentication",
  "objective": "Add JWT-based authentication to the API",
  "tasks": [
    "Create auth middleware for JWT verification",
    "Implement login endpoint with password hashing",
    "Add protected route decorator"
  ],
  "dependencies": ["setup-database"],
  "complexity": "high",
  "required_context": {
    "files": ["src/routes/*.ts", "src/middleware/*.ts"],
    "concepts": ["JWT tokens", "bcrypt password hashing"],
    "artifacts_from": ["setup-database"]
  },
  "success_criteria": "Login returns valid JWT, protected routes reject invalid tokens",
  "constraints": [
    "Do not store plain-text passwords",
    "Do not expose internal error messages"
  ]
}
```

For complete schema documentation, see [references/phase-schema.md](references/phase-schema.md).

---

## CLI Scripts

The Symphony skill includes CLI scripts in the `scripts/` directory:

### Core Scripts

| Script | Purpose |
|--------|---------|
| `find-latest-plan.ts` | Finds the most recent plan file with a `symphony-phases` block |
| `parse-plan.ts` | Parses and validates a plan file, outputs phases as JSON |
| `init-state.ts` | Initializes a `.symphony-state.json` file for orchestration |
| `get-ready-phases.ts` | Returns phases that are ready to execute (dependencies met) |
| `mark-complete.ts` | Marks a phase as complete and stores its artifacts |
| `mark-failed.ts` | Handles phase failure with automatic retry logic |
| `validate-skill.ts` | Validates the SKILL.md frontmatter |

### Retry & Recovery Scripts

| Script | Purpose |
|--------|---------|
| `classify-error.ts` | Classifies error messages into categories (transient, logic, etc.) |
| `retry-phase.ts` | Schedules a phase for retry with exponential backoff |
| `resolve-decision.ts` | Processes user decision after retries are exhausted |

### Visualization Scripts

| Script | Purpose |
|--------|---------|
| `statusline.ts` | Outputs orchestration progress for Claude Code's statusline |

### Usage Examples

```bash
# Find the latest plan file
bun .claude/skills/symphony/scripts/find-latest-plan.ts

# Parse a specific plan
bun .claude/skills/symphony/scripts/parse-plan.ts ./plan.md

# Initialize state for orchestration
bun .claude/skills/symphony/scripts/init-state.ts ./plan.md -o .symphony-state.json

# Get ready phases from state
bun .claude/skills/symphony/scripts/get-ready-phases.ts .symphony-state.json

# Mark a phase complete with artifacts
bun .claude/skills/symphony/scripts/mark-complete.ts .symphony-state.json setup-phase '[{"type":"file_created","path":"src/db.ts"}]'

# Mark a phase failed
bun .claude/skills/symphony/scripts/mark-failed.ts .symphony-state.json build-phase "Compilation error"
```

---

## Example Workflow

Here is a complete example of using Symphony to orchestrate a feature implementation:

### Step 1: Create the Plan

```markdown
# User Profile Feature

Implement user profile management for the application.

\`\`\`symphony-phases
[
  {
    "id": "create-profile-model",
    "title": "Create Profile Model",
    "objective": "Define the user profile data model",
    "tasks": [
      "Create Profile interface in src/models/profile.ts",
      "Add profile fields: bio, avatar, preferences"
    ],
    "dependencies": [],
    "complexity": "low",
    "required_context": {
      "files": ["src/models/user.ts"],
      "concepts": ["TypeScript interfaces"],
      "artifacts_from": []
    },
    "success_criteria": "Profile interface exported and documented"
  },
  {
    "id": "profile-api-routes",
    "title": "Profile API Routes",
    "objective": "Create CRUD endpoints for user profiles",
    "tasks": [
      "GET /profile/:id - Fetch profile",
      "PUT /profile/:id - Update profile",
      "POST /profile/:id/avatar - Upload avatar"
    ],
    "dependencies": ["create-profile-model"],
    "complexity": "medium",
    "required_context": {
      "files": ["src/routes/*.ts"],
      "concepts": ["REST API", "Express routing"],
      "artifacts_from": ["create-profile-model"]
    },
    "success_criteria": "All endpoints return correct responses"
  },
  {
    "id": "profile-tests",
    "title": "Profile Tests",
    "objective": "Write tests for profile functionality",
    "tasks": [
      "Unit tests for profile model",
      "Integration tests for API endpoints"
    ],
    "dependencies": ["profile-api-routes"],
    "complexity": "medium",
    "required_context": {
      "files": ["src/__tests__/*.ts"],
      "concepts": ["Testing", "Jest/Bun test"],
      "artifacts_from": ["profile-api-routes"]
    },
    "success_criteria": "All tests pass with 80%+ coverage"
  }
]
\`\`\`
```

### Step 2: Start Orchestration

```
User: conduct the profile feature plan
```

### Step 3: Symphony Executes

Symphony will:

1. Parse the plan and validate phases
2. Initialize state in `.symphony-state.json`
3. Start `create-profile-model` (no dependencies)
4. When complete, start `profile-api-routes`
5. When complete, start `profile-tests`
6. Report final summary with all artifacts

### Step 4: View Results

```
Symphony Performance Complete

Total phases: 3
Completed: 3
Failed: 0
Duration: 12m 34s

Phase Results:
- create-profile-model: complete (2m 15s)
- profile-api-routes: complete (5m 42s)
- profile-tests: complete (4m 37s)

Artifacts Created:
- src/models/profile.ts
- src/routes/profile.ts
- src/__tests__/profile.test.ts
```

---

## State Management

Symphony tracks execution state in `.symphony-state.json`:

```json
{
  "planPath": "/path/to/plan.md",
  "startedAt": "2024-01-15T10:30:00.000Z",
  "phases": {
    "create-profile-model": {
      "status": "complete",
      "startedAt": "2024-01-15T10:30:01.000Z",
      "completedAt": "2024-01-15T10:32:15.000Z",
      "artifacts": [
        { "type": "file_created", "path": "src/models/profile.ts" }
      ]
    },
    "profile-api-routes": {
      "status": "running",
      "startedAt": "2024-01-15T10:32:16.000Z",
      "artifacts": []
    },
    "profile-tests": {
      "status": "pending",
      "artifacts": []
    }
  },
  "completedCount": 1,
  "failedCount": 0,
  "status": "running"
}
```

### Phase Statuses

| Status | Description |
|--------|-------------|
| `pending` | Not yet ready (dependencies incomplete) |
| `ready` | Dependencies complete, can be started |
| `running` | Currently executing |
| `complete` | Successfully finished |
| `retrying` | Failed but scheduled for retry (waiting for backoff) |
| `awaiting_decision` | Retries exhausted, waiting for user decision |
| `failed` | Permanently failed (user chose not to retry) |
| `blocked` | Dependency failed or aborted |
| `aborted` | User cancelled |

### Failure Handling

When a phase fails, Symphony follows the retry flow:

1. **Error Classification**: The error is classified (transient, logic, permanent, etc.)
2. **Retry Check**: If retryable and retries remain, phase enters `retrying` status
3. **Backoff Wait**: Exponential backoff delay before next attempt
4. **Retry Execution**: Phase moves to `ready` and re-executes
5. **User Decision**: If all retries fail, user chooses: retry/skip/abort

Key behaviors:
- Dependent phases are **not blocked** during retry attempts
- Dependents are only blocked when user chooses "abort branch" or "abort all"
- Choosing "skip phase" allows dependents to proceed
- Independent phases continue executing regardless of failures

---

## Additional Resources

- [Phase Schema Reference](references/phase-schema.md) - Complete field documentation
- [Orchestration Workflow](references/orchestration-workflow.md) - Detailed execution model
- [Prompt Template](references/prompt-template.md) - Worker prompt structure

---

## License

This skill is part of the Symphony project.
