---
name: symphony
description: Orchestrate parallel phase execution from plan files. Parses symphony-phases blocks, builds dependency DAG, and executes phases concurrently using Task tool. Supports artifact propagation between phases and automatic dependency resolution using Kahn's algorithm.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
---

# Symphony Skill

Orchestrate parallel phase execution from plan files containing `symphony-phases` code blocks.

## Trigger Keywords

- conduct
- orchestrate
- execute plan
- run phases
- symphony
- 계획 실행 (execute plan in Korean)
- 오케스트레이트 (orchestrate in Korean)

## Workflow

### 1. Detect Plan File

Find the plan file to execute:

```bash
# Check context for plan path, or find latest in ~/.claude/plans/
ls -t ~/.claude/plans/*.md 2>/dev/null | head -1
```

Search for `symphony-phases` code blocks in:
1. Plan path provided in context
2. Most recently modified file in `~/.claude/plans/`
3. `plan.md` in current directory

### 2. Parse and Validate Plan

Extract phases from the `symphony-phases` code block:

```bash
# Read the plan file and extract the JSON block
# Look for: ```symphony-phases ... ```
```

Validate each phase has required fields:
- `id` (kebab-case, max 64 chars)
- `title`, `objective`, `tasks[]`
- `dependencies[]`, `complexity`
- `required_context.files[]`, `required_context.concepts[]`, `required_context.artifacts_from[]`
- `success_criteria`

Use `scripts/lib/validation.ts` for validation logic.

### 3. Initialize State

Create state file `.symphony-state.json`:

```json
{
  "planPath": "/path/to/plan.md",
  "startedAt": "ISO-timestamp",
  "phases": {
    "phase-id": { "status": "pending", "artifacts": [] }
  },
  "completedCount": 0,
  "failedCount": 0,
  "status": "running"
}
```

### 4. Orchestration Loop (with Automatic Retry)

Execute phases respecting dependencies with intelligent retry:

```
WHILE not all phases complete/failed/aborted:
  1. Check "retrying" phases: if backoff elapsed, move to "ready"

  2. Handle "awaiting_decision" phases:
     - Display: "Phase {title} failed after {n} retries"
     - Show error and category
     - Offer: [retry once more | skip | abort branch | abort all]
     - Process with resolve-decision.ts

  3. Get ready phases (pending with all deps complete)

  4. For each ready phase:
     - Mark as "running"
     - Execute using Task tool (run_in_background for parallel)
     - Task prompt includes: objective, tasks, context files, artifacts from deps

  5. Monitor running phases

  6. On completion: mark "complete", collect artifacts

  7. On failure:
     - Classify error (transient/resource/logic/permanent/timeout)
     - If retryable AND retries remaining:
         Set "retrying", schedule with exponential backoff
     - Else:
         Set "awaiting_decision", prompt user for choice
```

Use `scripts/lib/scheduler.ts` DependencyGraph for:
- `getReady()` - phases ready to execute
- `markComplete(id, artifacts)` - update status
- `markFailed(id, error)` - handle failures with retry logic

### 5. Execute Phase (Task Prompt Template)

```
## Phase: {title}

**Objective:** {objective}

**Tasks:**
{tasks as numbered list}

**Context Files:**
{required_context.files}

**Artifacts from Dependencies:**
{collected artifacts from artifacts_from phases}

**Success Criteria:**
{success_criteria}

**Constraints:**
{constraints if any}

When complete, report:
1. Files created/modified
2. Key decisions made
3. Any issues encountered
```

### 6. Final Summary

Report execution results:

```
Symphony Performance Complete

Total phases: X
Completed: Y
Failed: Z
Duration: Xm Ys

Phase Results:
- phase-id-1: complete (Xm Ys)
- phase-id-2: complete (Xm Ys)
- phase-id-3: failed - error message

Artifacts Created:
- path/to/file1.ts
- path/to/file2.ts
```

## Automatic Retry

Symphony automatically retries failed phases with intelligent error classification.

### Default Retry Policy

Applied automatically (no configuration needed):

| Setting | Value |
|---------|-------|
| Max Retries | 2 (total 3 attempts) |
| Backoff | Exponential with jitter |
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
| `logic` | Test failed, type error | No |
| `permanent` | Syntax error, invalid config | No |

### User Decision (When Retries Exhausted)

When all retries fail, the user is prompted:

1. **Retry once more** - Give it another try
2. **Skip phase** - Mark as complete, continue with dependents
3. **Abort branch** - Stop this phase and all dependent phases
4. **Abort all** - Stop entire orchestration

## Statusline Visualization

Display orchestration progress in Claude Code's statusline.

### Output Format

```
[████░░░░░░] 4/10 (1!) | setup-db, auth-middleware
```

- Progress bar (green/gray)
- Completed/total count
- Failure count in red (if any)
- Running phase names in yellow

### Setup

Add to `.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bun .claude/skills/symphony/scripts/statusline.ts"
  }
}
```

## Key Files

### Core Libraries
- `scripts/lib/types.ts` - Type definitions (Phase, PhaseState, RetryPolicy)
- `scripts/lib/validation.ts` - Phase validation
- `scripts/lib/scheduler.ts` - DAG scheduler

### CLI Scripts
- `scripts/init-state.ts` - Initialize orchestration state
- `scripts/get-ready-phases.ts` - Get phases ready to execute
- `scripts/mark-complete.ts` - Mark phase as complete
- `scripts/mark-failed.ts` - Handle failure with retry logic
- `scripts/classify-error.ts` - Classify errors for retry decisions
- `scripts/retry-phase.ts` - Schedule phase retry with backoff
- `scripts/resolve-decision.ts` - Process user decision after retries
- `scripts/statusline.ts` - Statusline progress display

## Notes

- Maximum 4 concurrent phases recommended
- Phase IDs must be kebab-case (security: prevents injection)
- Artifacts propagate only to phases listing the source in `artifacts_from`
- Failed phases trigger retry logic; dependents are not blocked during retries
- Dependents are only blocked when user chooses "abort branch" or "abort all"
