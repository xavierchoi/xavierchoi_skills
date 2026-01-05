# Worker Prompt Template Reference

This document describes the structure of prompts sent to worker agents and how artifacts are passed between phases.

## Prompt Structure Overview

Worker prompts are structured markdown documents with the following sections:

```
# Phase: {title}
Phase ID: {id}
Complexity: {complexity}

## Objective
{objective}

## Tasks
1. {task 1}
2. {task 2}
...

## Project Context
Project: {name}
Description: {description}

### Tech Stack
{formatted tech stack}

### Project Patterns
- {pattern 1}
- {pattern 2}

## Relevant Files
{file contents or references}

## Required Concepts
- {concept 1}
- {concept 2}

## Artifacts from Previous Phases
{formatted artifacts}

## Constraints
### Phase-Specific Constraints
- {constraint 1}

### Global Constraints
- Do not modify files outside the scope of this phase
- Do not install new dependencies unless specified
- Do not refactor unrelated code
- Maintain existing code style
- Do not delete existing functionality

## Success Criteria
This phase is complete when:
{success_criteria}

## Additional Instructions
{custom instructions if any}

## Completion
When you have completed all tasks and verified the success criteria:
1. Summarize what was accomplished
2. List any files created or modified
3. Note any issues encountered or decisions made
4. Mention anything the next phase should be aware of
```

## Section Details

### Header Section

```markdown
# Phase: Database Schema Setup

Phase ID: setup-database
Complexity: medium
```

**Purpose:** Identifies the phase and provides metadata.

**Source Fields:**
- `phase.title` -> Phase title
- `phase.id` -> Phase ID
- `phase.complexity` -> Complexity level

### Objective Section

```markdown
## Objective

Create the initial database schema with user and session tables, including necessary indexes for performance.
```

**Purpose:** Clear statement of what the phase should accomplish.

**Source Field:** `phase.objective`

### Tasks Section

```markdown
## Tasks

1. Create users table with id, email, password_hash columns
2. Create sessions table with foreign key to users
3. Add indexes for email lookup and session token
4. Write migration script
```

**Purpose:** Specific action items for the worker to complete.

**Source Field:** `phase.tasks` (array, numbered list)

### Project Context Section

```markdown
## Project Context

Project: symphony
Description: Claude Code Parallel Session Orchestrator

### Tech Stack
Runtime: bun
Language: typescript
Framework: None
UI: Ink (Terminal UI)
Testing: Bun Test
Database: SQLite
Build: Bun Bundler
Package Manager: bun

### Project Patterns
- Use Bun APIs (Bun.file, Bun.serve, etc.) instead of Node.js equivalents
- Use bun:sqlite for database operations if SQLite is needed
- Use TypeScript with proper type annotations
- Write tests using describe/it/expect pattern
```

**Purpose:** Provides context about the project's technology stack and conventions.

**Generated From:**
- `package.json` analysis for tech stack detection
- Pattern inference based on detected technologies

### Relevant Files Section

```markdown
## Relevant Files

The following files are relevant to this phase. Review them to understand the context:

### src/models/user.ts
```typescript
export interface User {
  id: string
  email: string
  passwordHash: string
  createdAt: Date
}
```

### prisma/schema.prisma
```prisma
model User {
  id    String @id @default(uuid())
  email String @unique
  // ...
}
```
```

**Purpose:** Shows content of files the worker should review.

**Source Field:** `phase.required_context.files`

**Behavior:**
- File contents are loaded from disk
- Long files are truncated (default: 200 lines)
- Missing files show error message
- Supports glob patterns

### Required Concepts Section

```markdown
## Required Concepts

You should be familiar with these concepts for this phase:

- JWT tokens
- bcrypt password hashing
- Express middleware patterns
- Database transactions
```

**Purpose:** Lists domain knowledge the worker should have.

**Source Field:** `phase.required_context.concepts`

### Artifacts from Previous Phases Section

```markdown
## Artifacts from Previous Phases

The following artifacts were produced by dependency phases. Use them as needed:

Files Created:
- src/models/user.ts
- src/models/session.ts

Files Modified:
- prisma/schema.prisma

Exports:
- userSchema: Zod schema for user validation

Notes:
- Used UUID for user IDs as discussed
```

**Purpose:** Provides output from completed dependency phases.

**Source:** Collected from phases listed in `phase.required_context.artifacts_from`

**Artifact Types:**
| Type | Description | Format |
|------|-------------|--------|
| `file_created` | New file created | Path only |
| `file_modified` | Existing file changed | Path only |
| `file_deleted` | File removed | Path only |
| `export` | Data/code export | Name + content |
| `note` | Informational note | Content only |

### Constraints Section

```markdown
## Constraints

You MUST adhere to these constraints:

### Phase-Specific Constraints
- Do not modify the authentication flow
- Keep backward compatibility with existing API

### Global Constraints
- Do not modify files outside the scope of this phase unless absolutely necessary
- Do not install new dependencies unless specified in the tasks
- Do not refactor code unrelated to the current objective
- Maintain existing code style and conventions
- Do not delete or remove existing functionality unless explicitly required
```

**Purpose:** Defines boundaries for the worker's actions.

**Source Fields:**
- `phase.constraints` -> Phase-specific constraints
- `DEFAULT_GLOBAL_CONSTRAINTS` -> Always-applied global constraints

**Default Global Constraints:**
```typescript
const DEFAULT_GLOBAL_CONSTRAINTS = [
  'Do not modify files outside the scope of this phase unless absolutely necessary',
  'Do not install new dependencies unless specified in the tasks',
  'Do not refactor code unrelated to the current objective',
  'Maintain existing code style and conventions',
  'Do not delete or remove existing functionality unless explicitly required',
]
```

### Success Criteria Section

```markdown
## Success Criteria

This phase is complete when:

All database tables are created, migrations run successfully, and unit tests for the models pass.

Ensure all success criteria are met before completing.
```

**Purpose:** Verifiable condition for phase completion.

**Source Field:** `phase.success_criteria`

### Completion Section

```markdown
## Completion

When you have completed all tasks and verified the success criteria:

1. Summarize what was accomplished
2. List any files created or modified
3. Note any issues encountered or decisions made
4. Mention anything the next phase should be aware of

If you encounter blocking issues that prevent completion, explain the problem and what would be needed to resolve it.
```

**Purpose:** Instructions for finalizing the phase.

**Content:** Static template, always included.

## Complete Example Prompt

Given this phase definition:

```json
{
  "id": "implement-auth",
  "title": "Implement Authentication",
  "objective": "Add JWT-based authentication to API endpoints",
  "tasks": [
    "Create auth middleware",
    "Implement login endpoint",
    "Add token refresh logic"
  ],
  "dependencies": ["setup-database"],
  "complexity": "high",
  "required_context": {
    "files": ["src/routes/index.ts"],
    "concepts": ["JWT", "bcrypt"],
    "artifacts_from": ["setup-database"]
  },
  "success_criteria": "Login returns JWT, protected routes require valid token",
  "constraints": ["Do not store plain-text passwords"]
}
```

The generated prompt would be:

```markdown
# Phase: Implement Authentication

Phase ID: implement-auth
Complexity: high

## Objective

Add JWT-based authentication to API endpoints

## Tasks

1. Create auth middleware
2. Implement login endpoint
3. Add token refresh logic

## Project Context

Project: my-api
Description: REST API server

### Tech Stack
Runtime: bun
Language: typescript
Framework: Express
Testing: Bun Test

### Project Patterns
- Use Bun APIs instead of Node.js equivalents
- Use TypeScript with proper type annotations

## Relevant Files

The following files are relevant to this phase. Review them to understand the context:

### src/routes/index.ts
```typescript
import { Router } from 'express'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

export default router
```

## Required Concepts

You should be familiar with these concepts for this phase:

- JWT
- bcrypt

## Artifacts from Previous Phases

The following artifacts were produced by dependency phases. Use them as needed:

Files Created:
- src/db/schema.ts
- src/models/user.ts

Notes:
- User table includes password_hash column

## Constraints

You MUST adhere to these constraints:

### Phase-Specific Constraints
- Do not store plain-text passwords

### Global Constraints
- Do not modify files outside the scope of this phase unless absolutely necessary
- Do not install new dependencies unless specified in the tasks
- Do not refactor code unrelated to the current objective
- Maintain existing code style and conventions
- Do not delete or remove existing functionality unless explicitly required

## Success Criteria

This phase is complete when:

Login returns JWT, protected routes require valid token

Ensure all success criteria are met before completing.

## Completion

When you have completed all tasks and verified the success criteria:

1. Summarize what was accomplished
2. List any files created or modified
3. Note any issues encountered or decisions made
4. Mention anything the next phase should be aware of

If you encounter blocking issues that prevent completion, explain the problem and what would be needed to resolve it.
```

## Artifact Passing Between Phases

### How Artifacts Are Created

Workers produce artifacts through their work:

1. **Automatic Detection:** Symphony parses worker logs for file operations
   ```
   Created file src/auth/middleware.ts
   Modified src/routes/index.ts
   ```

2. **Explicit Markers:** Workers can output structured artifact markers
   ```
   [SYMPHONY:ARTIFACT] {"type": "file_created", "path": "src/auth/middleware.ts"}
   ```

3. **Completion Message:** Workers report artifacts in their completion message via socket

### How Artifacts Are Received

When a phase lists another phase in `artifacts_from`:

1. **Dependency Validation:** Symphony ensures the source phase is a dependency
2. **Wait for Completion:** The dependent phase waits for source to complete
3. **Artifact Collection:** Symphony collects artifacts from completed source phase
4. **Prompt Inclusion:** Artifacts are formatted and included in the prompt

### Artifact Flow Example

```
Phase A (setup-database)
    |
    | Produces artifacts:
    | - file_created: src/db/schema.ts
    | - file_created: src/models/user.ts
    | - note: "Using UUID for primary keys"
    |
    v
Phase B (implement-auth)
    |
    | required_context.artifacts_from: ["setup-database"]
    |
    | Receives in prompt:
    | ## Artifacts from Previous Phases
    | Files Created:
    | - src/db/schema.ts
    | - src/models/user.ts
    | Notes:
    | - Using UUID for primary keys
```

### Artifact Metadata

Propagated artifacts include source tracking:

```typescript
{
  type: 'file_created',
  path: 'src/db/schema.ts',
  metadata: {
    sourcePhase: 'setup-database'  // Added during propagation
  }
}
```

## Prompt Building API

### Async Version (Recommended)

```typescript
import { buildWorkerPrompt } from './prompts'

const result = await buildWorkerPrompt({
  phase: myPhase,
  workingDirectory: '/path/to/project',
  dependencyArtifacts: artifactsFromDeps,
  globalConstraints: customConstraints,  // Optional
  customInstructions: 'Additional notes' // Optional
})

// result.prompt - The generated prompt string
// result.projectContext - Extracted project context
// result.filesIncluded - List of files included in context
// result.artifactsIncluded - Number of artifacts included
```

### Sync Version

```typescript
import { buildWorkerPromptSync } from './prompts'

const prompt = buildWorkerPromptSync({
  phase: myPhase,
  projectContext: preloadedContext,  // Required for sync version
  dependencyArtifacts: artifactsFromDeps
})
```

### Simple Prompt (Minimal)

```typescript
import { buildSimplePrompt } from './prompts'

const prompt = buildSimplePrompt(
  'Task Title',
  'Do something specific',
  ['Step 1', 'Step 2']
)
```

## Token Management

### Estimation

```typescript
import { estimateTokenCount } from './prompts'

const tokens = estimateTokenCount(prompt)
// Uses ~4 characters per token approximation
```

### Truncation

```typescript
import { truncatePromptIfNeeded } from './prompts'

const { prompt: truncated, truncated: wasTruncated } = truncatePromptIfNeeded(
  longPrompt,
  50000  // Max tokens
)
```

**Truncation Strategy:**
1. Find "Relevant Files" section
2. Truncate file contents to fit limit
3. Add truncation notice
4. Fall back to simple truncation if structure not found
