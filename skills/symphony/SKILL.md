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

### 4. Orchestration Loop

Execute phases respecting dependencies:

```
WHILE not all phases complete/failed:
  1. Get ready phases (pending with all deps complete)
  2. For each ready phase:
     - Mark as "running"
     - Execute using Task tool (run_in_background for parallel)
     - Task prompt includes: objective, tasks, context files, artifacts from deps
  3. Monitor running phases
  4. On completion: mark "complete", collect artifacts
  5. On failure: mark "failed", block dependents
```

Use `scripts/lib/scheduler.ts` DependencyGraph for:
- `getReady()` - phases ready to execute
- `markComplete(id, artifacts)` - update status
- `markFailed(id, error)` - handle failures

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

## Key Files

- `scripts/lib/types.ts` - Type definitions
- `scripts/lib/validation.ts` - Phase validation
- `scripts/lib/scheduler.ts` - DAG scheduler

## Notes

- Maximum 4 concurrent phases recommended
- Phase IDs must be kebab-case (security: prevents injection)
- Artifacts propagate only to phases listing the source in `artifacts_from`
- Failed phases block all dependents automatically
