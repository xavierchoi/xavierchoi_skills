# Orchestration Workflow Reference

This document describes Symphony's DAG-based orchestration workflow, including the execution model, state management, and artifact propagation.

## Execution Model Overview

Symphony uses a Directed Acyclic Graph (DAG) to manage phase dependencies and enable parallel execution. The core algorithm is Kahn's topological sort for:
- Cycle detection
- Execution order determination
- Parallel group identification

```
plan.md -> Interpreter -> Conductor -> Workers (tmux) -> Claude Code CLI
              |              |            |
          Scheduler      Chronicle    SocketClient
       (DAG/Kahn's)     (SQLite)        (IPC)
```

## Sequential Workflow

### 1. Parse Phase

**Input:** Plan file path (markdown with symphony-phases block)
**Output:** InterpretedPlan with validated phases

```
Read plan.md
    |
    v
Extract symphony-phases code block
    |
    v
Parse JSON content
    |
    v
Apply Zod schema validation (lenient first, then strict)
    |
    v
Return InterpretedPlan
```

**Key Operations:**
- Read plan file from disk
- Find and extract `symphony-phases` code block
- Parse JSON with lenient schema (applies defaults)
- Validate with strict schema

### 2. Validate Phase

**Input:** InterpretedPlan
**Output:** Validated plan or validation errors

```
Schema Validation
    |
    +-- Validate each phase against PhaseSchema
    +-- Check required fields (id, title, objective, tasks, success_criteria)
    +-- Validate field formats (kebab-case for id, complexity enum)
    |
    v
Reference Validation
    |
    +-- Check all dependency IDs exist
    +-- Check all artifacts_from IDs exist
    +-- Check for duplicate phase IDs
    +-- Check for self-dependencies
    |
    v
Cycle Detection (Kahn's Algorithm)
    |
    +-- Build adjacency list
    +-- Calculate in-degrees
    +-- Process nodes with 0 in-degree
    +-- Detect unprocessed nodes (cycles)
    |
    v
Validated Plan or Error List
```

**Validation Order:**
1. Schema validation (field presence and format)
2. Reference validation (dependency and artifact references)
3. Cycle detection (topological sort feasibility)

### 3. Initialize State

**Input:** Validated plan, project directory
**Output:** Initialized performance state

```
Create .symphony directory structure
    |
    +-- .symphony/
    +-- .symphony/logs/
    +-- .symphony/performances/
    +-- .symphony/artifacts/
    |
    v
Initialize Chronicle (SQLite)
    |
    +-- Run migrations
    +-- Create performance record
    +-- Record phase definitions
    |
    v
Build DependencyGraph
    |
    +-- Add all phases to graph
    +-- Calculate initial ready phases (no dependencies)
    +-- Set status: pending or ready
    |
    v
Start Socket Server (IPC)
    |
    v
Start TUI (Ink/React)
```

**Initial Phase Status:**
- Phases with no dependencies: `ready`
- Phases with dependencies: `pending`

### 4. Orchestration Loop

**Input:** Initialized state
**Output:** Completed or failed performance

```
LOOP while not finished:
    |
    +-- Check if paused -> skip spawning
    |
    v
    Get ready phases from DependencyGraph
        |
        +-- Status == 'pending' or 'ready'
        +-- All dependencies have status == 'complete'
        |
        v
    Calculate available worker slots
        |
        +-- availableSlots = maxWorkers - runningCount
        |
        v
    Spawn workers for ready phases (up to available slots)
        |
        +-- For each ready phase:
        |   +-- Validate phase ID (security)
        |   +-- Build worker prompt
        |   +-- Create tmux window
        |   +-- Mark phase as 'running'
        |   +-- Update Chronicle
        |
        v
    Wait for worker messages (Socket/Polling)
        |
        +-- On 'complete': handlePhaseComplete()
        +-- On 'error': handlePhaseFailed()
        +-- On 'progress': Update TUI
        +-- On 'question': Queue for user response
        |
        v
    Check completion conditions:
        |
        +-- All phases complete/failed/aborted/blocked?
        +-- -> Complete performance
```

## Conditional Handling

### Success Path

When a phase completes successfully:

```
handlePhaseComplete(phaseId, artifacts)
    |
    v
Update Chronicle (DB-first)
    |
    +-- Set status = 'complete'
    +-- Store artifacts
    |
    v
Update DependencyGraph
    |
    +-- markComplete(phaseId, artifacts)
    +-- propagateArtifacts(phaseId)
    |
    v
Update dependent phases
    |
    +-- For each dependent with all deps complete:
    |   +-- Set status = 'ready'
    |
    v
Remove worker tracking
    |
    v
Save performance state (JSON backup)
    |
    v
Execute ready phases (continue loop)
```

### Failure Path

When a phase fails:

```
handlePhaseFailed(phaseId, error)
    |
    v
Update phase status
    |
    +-- Set status = 'failed'
    +-- Store error message
    |
    v
Update DependencyGraph
    |
    +-- markFailed(phaseId, error)
    +-- Block all transitive dependents
    |
    v
Update Chronicle
    |
    +-- Set status = 'failed'
    |
    v
Mark dependent phases as 'blocked'
    |
    +-- Recursively block all phases that depend on failed phase
    |
    v
Continue with other ready phases (parallel execution continues)
```

**Blocked Phase Cascade:**
```
A (failed)
    |
    +-> B (blocked)
    |       |
    |       +-> D (blocked)
    |
    +-> C (blocked)
```

### Resume Path

When resuming from a previous performance:

```
resumeFromChronicle(performanceId, options)
    |
    v
Load performance state from Chronicle
    |
    v
Update performance status to 'running'
    |
    v
Rebuild DependencyGraph from saved phases
    |
    v
Reset interrupted phases:
    |
    +-- 'running' -> 'ready' (was interrupted)
    |
    v
Handle failed phases (if retryFailed=true):
    |
    +-- 'failed' -> 'ready'
    +-- Unblock dependent phases
    |
    v
Start execution from current state
```

**Resume Status Transitions:**

| Previous Status | retryFailed=false | retryFailed=true |
|----------------|-------------------|------------------|
| complete | complete (skip) | complete (skip) |
| running | ready (retry) | ready (retry) |
| failed | failed (skip) | ready (retry) |
| blocked | blocked (skip) | ready/pending (if deps unblocked) |
| pending | pending | pending |
| ready | ready | ready |

## Artifact Propagation

Artifacts are output data from completed phases that can be passed to dependent phases.

### Artifact Types

```typescript
type ArtifactType =
  | 'file_created'    // New file was created
  | 'file_modified'   // Existing file was modified
  | 'file_deleted'    // File was deleted
  | 'export'          // Data export for dependent phases
  | 'note'            // Informational note
```

### Artifact Structure

```typescript
interface Artifact {
  type: ArtifactType
  path?: string           // For file artifacts
  content?: string        // For exports and notes
  metadata?: {
    sourcePhase?: string  // Added during propagation
    [key: string]: unknown
  }
}
```

### Propagation Flow

```
Phase A completes with artifacts
    |
    v
DependencyGraph.markComplete(A, artifacts)
    |
    v
DependencyGraph.propagateArtifacts(A)
    |
    +-- Find phases with artifacts_from: [A]
    +-- Merge A's artifacts into dependent's artifacts
    +-- Add sourcePhase metadata
    |
    v
When Phase B starts:
    |
    v
Build worker prompt with artifacts from A
    |
    v
Worker receives artifact information in prompt
```

### Requesting Artifacts

To receive artifacts from a dependency:

```json
{
  "id": "phase-b",
  "dependencies": ["phase-a"],
  "required_context": {
    "artifacts_from": ["phase-a"]
  }
}
```

Note: Adding a phase to `artifacts_from` creates an implicit dependency.

## Parallel Execution

### Execution Groups

The DependencyGraph calculates parallel execution groups (levels):

```
Level 0: [A, B]     <- No dependencies, run in parallel
Level 1: [C, D]     <- Depend on level 0, run after A/B complete
Level 2: [E]        <- Depends on level 1
```

### Worker Slot Management

```
maxWorkers = 4 (configurable)

Available slots = maxWorkers - currently running
    |
    v
Select ready phases (up to available slots)
    |
    v
Spawn workers in parallel (Promise.allSettled)
```

### Parallel Execution Example

Given this dependency graph:
```
A -----> C -----> E
    \         /
B -----> D ---
```

Execution with maxWorkers=4:
```
Time 0: Spawn A, B (both ready, 0 dependencies)
Time 1: A completes -> C becomes ready
Time 2: B completes -> D becomes ready
Time 3: Spawn C, D (both ready, slots available)
Time 4: C completes
Time 5: D completes -> E becomes ready
Time 6: Spawn E
Time 7: E completes -> Performance complete
```

## State Management

### State Storage

Symphony uses a dual-storage approach:

1. **Chronicle (SQLite)** - Primary state storage
   - Transaction-safe
   - Enables resume functionality
   - Stores complete execution history

2. **JSON Files** - Backup/inspection
   - `.symphony/performances/{id}.json`
   - Human-readable format
   - Quick state inspection

### State Update Order

Critical: Always update Chronicle first (DB-first pattern):

```
1. Update Chronicle (atomic, recoverable)
2. Update in-memory state
3. Save JSON backup
4. Update TUI
```

This ensures crash recovery has accurate state.

### Phase Status State Machine

```
[pending] ---(deps complete)---> [ready]
    |                              |
    |                              v
    |                         [running]
    |                          /     \
    |                         v       v
    |                   [complete]  [failed]
    |                                  |
    |                                  v
    +---------(dep failed)-------> [blocked]

[running] ---(user abort)---> [aborted]
[failed/aborted] ---(retry)---> [ready]
[failed/aborted] ---(skip)---> [complete]
```

## TUI Commands During Orchestration

| Command | Description |
|---------|-------------|
| `conduct` | Start executing ready phases |
| `status` | Show detailed status |
| `pause` | Stop spawning new phases |
| `resume` | Resume after pause |
| `abort` | Stop all workers |
| `@{phase-id} abort` | Abort specific phase |
| `@{phase-id} retry` | Retry failed phase |
| `@{phase-id} skip` | Skip failed phase (mark complete) |
| `@{phase-id} message {text}` | Send message to worker |
