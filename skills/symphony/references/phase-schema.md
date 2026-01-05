# Phase JSON Schema Reference

This document provides complete reference documentation for the Phase schema used in Symphony plan files.

## Phase Interface

```typescript
interface Phase {
  id: string                    // Required: kebab-case identifier
  title: string                 // Required: Human-readable name
  objective: string             // Required: Clear goal statement
  tasks: string[]               // Required: Specific action items (min 1)
  dependencies: string[]        // Optional: IDs of phases that must complete first
  complexity: 'low' | 'medium' | 'high'  // Optional: Defaults to 'medium'
  required_context: {
    files: string[]             // Optional: File paths worker should know about
    concepts: string[]          // Optional: Domain knowledge needed
    artifacts_from: string[]    // Optional: Phase IDs to receive artifacts from
  }
  success_criteria: string      // Required: Verifiable completion condition
  constraints?: string[]        // Optional: Things phase should NOT do
}
```

## Field Specifications

### id (Required)

The unique identifier for the phase.

**Validation Rules:**
- Must be a non-empty string
- Must be in kebab-case format (lowercase letters, numbers, hyphens only)
- Must start with a letter
- Cannot end with a hyphen
- Maximum 64 characters
- Regex pattern: `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`

**Valid Examples:**
```
setup
phase-1
test-integration-api
setup-database
implement-feature-auth
```

**Invalid Examples:**
```
Phase1           // uppercase not allowed
test_phase       // underscores not allowed
phase-           // cannot end with hyphen
1-phase          // must start with letter
phase$(cmd)      // shell injection attempt
```

### title (Required)

Human-readable name displayed in the TUI.

**Validation Rules:**
- Must be a non-empty string
- No length limit, but keep concise for display

**Example:**
```json
"title": "Database Schema Setup"
```

### objective (Required)

Clear goal statement describing what the phase should accomplish.

**Validation Rules:**
- Must be a non-empty string

**Example:**
```json
"objective": "Create the initial database schema with user and session tables"
```

### tasks (Required)

Array of specific action items for the worker to complete.

**Validation Rules:**
- Must be an array with at least one item
- Each task must be a non-empty string

**Example:**
```json
"tasks": [
  "Create users table with id, email, password_hash columns",
  "Create sessions table with foreign key to users",
  "Add indexes for email lookup and session token"
]
```

### dependencies (Optional)

Array of phase IDs that must complete before this phase can start.

**Validation Rules:**
- Must be an array of strings
- Each dependency must be a valid phase ID (same rules as `id`)
- References must exist in the plan
- Cannot reference itself (self-dependency)
- Cannot create circular dependencies
- Defaults to empty array `[]`

**Example:**
```json
"dependencies": ["setup-database", "create-models"]
```

### complexity (Optional)

Indicates the expected effort level for time estimation.

**Validation Rules:**
- Must be one of: `low`, `medium`, `high`
- Case-insensitive during parsing
- Defaults to `medium`

**Complexity Guidelines:**
- `low`: Simple tasks, single file changes, < 5 minutes
- `medium`: Moderate complexity, multiple files, 5-15 minutes
- `high`: Complex tasks, architectural changes, > 15 minutes

**Example:**
```json
"complexity": "high"
```

### required_context (Optional)

Context information the worker needs to complete the phase.

**Subfields:**

#### files
- Array of file paths the worker should review
- Supports glob patterns (e.g., `src/**/*.ts`)
- Paths are relative to project root

#### concepts
- Array of domain concepts the worker should understand
- Used to provide context, not for validation

#### artifacts_from
- Array of phase IDs to receive artifacts from
- Creates an implicit dependency on those phases
- Artifacts include files created/modified and exported data

**Default Value:**
```json
"required_context": {
  "files": [],
  "concepts": [],
  "artifacts_from": []
}
```

**Example:**
```json
"required_context": {
  "files": ["src/models/*.ts", "prisma/schema.prisma"],
  "concepts": ["REST API design", "JWT authentication"],
  "artifacts_from": ["setup-database"]
}
```

### success_criteria (Required)

Verifiable condition that determines when the phase is complete.

**Validation Rules:**
- Must be a non-empty string
- Should be specific and measurable

**Example:**
```json
"success_criteria": "All database migrations run successfully and tests pass"
```

### constraints (Optional)

Array of things the phase should NOT do.

**Validation Rules:**
- Must be an array of strings if provided
- Each constraint must be a string

**Example:**
```json
"constraints": [
  "Do not modify existing API endpoints",
  "Do not change authentication flow"
]
```

## Complete Phase Example

```json
{
  "id": "implement-user-auth",
  "title": "Implement User Authentication",
  "objective": "Add JWT-based authentication to the API endpoints",
  "tasks": [
    "Create auth middleware for JWT verification",
    "Implement login endpoint with password hashing",
    "Implement logout endpoint to invalidate tokens",
    "Add protected route decorator"
  ],
  "dependencies": ["setup-database", "create-user-model"],
  "complexity": "high",
  "required_context": {
    "files": ["src/routes/*.ts", "src/middleware/*.ts"],
    "concepts": ["JWT tokens", "bcrypt password hashing", "Express middleware"],
    "artifacts_from": ["create-user-model"]
  },
  "success_criteria": "Login returns valid JWT, protected routes reject invalid tokens, tests pass",
  "constraints": [
    "Do not store plain-text passwords",
    "Do not expose internal error messages to clients"
  ]
}
```

## Common Validation Errors

### Schema Validation Errors

| Error Message | Cause | Fix |
|--------------|-------|-----|
| `Phase ID is required` | Missing `id` field | Add `id` field |
| `Phase ID must be in kebab-case format` | Invalid ID format | Use only lowercase, numbers, hyphens |
| `Phase ID exceeds maximum length of 64 characters` | ID too long | Shorten the ID |
| `Phase title must be a non-empty string` | Empty or missing title | Add descriptive title |
| `Phase objective must be a non-empty string` | Empty or missing objective | Add clear objective |
| `At least one task is required` | Empty tasks array | Add at least one task |
| `Task cannot be empty` | Empty string in tasks | Remove or fill empty tasks |
| `Phase complexity must be one of: low, medium, high` | Invalid complexity value | Use valid complexity level |
| `Success criteria is required` | Missing success_criteria | Add verifiable criteria |

### Reference Validation Errors

| Error Message | Cause | Fix |
|--------------|-------|-----|
| `Dependency "X" references non-existent phase` | Invalid dependency ID | Check phase ID spelling |
| `Artifact source "X" references non-existent phase` | Invalid artifacts_from ID | Check phase ID spelling |
| `Duplicate phase ID "X"` | Same ID used twice | Use unique IDs |
| `Phase cannot depend on itself` | Self-dependency | Remove self-reference |

### Cycle Detection Errors

| Error Message | Cause | Fix |
|--------------|-------|-----|
| `Circular dependency detected: A -> B -> A` | Circular dependency chain | Restructure dependencies |

## Plan File Format

Phases are embedded in a `symphony-phases` code block within a markdown plan file:

~~~markdown
# My Project Plan

Description of the project...

```symphony-phases
{
  "phases": [
    { "id": "phase-1", ... },
    { "id": "phase-2", ... }
  ],
  "metadata": {
    "total_phases": 2,
    "estimated_parallelism": 2
  }
}
```
~~~

## InterpretedPlan Schema

The full plan structure:

```typescript
interface InterpretedPlan {
  phases: Phase[]               // Required: Array of phases (min 1)
  parallel_groups: string[][]   // Optional: Pre-computed parallel groups
  metadata: {
    total_phases: number        // Required: Total phase count
    estimated_parallelism: number // Optional: Max concurrent phases, default 1
    estimated_tokens?: number   // Optional: Estimated token usage
    notes?: string             // Optional: Plan notes
  }
}
```
