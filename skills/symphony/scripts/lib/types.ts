// Symphony Skill - Type Definitions
// Extracted from Symphony's core types for use in the skill

// Phase & Plan Types

export interface Phase {
  id: string // kebab-case identifier
  title: string // Human-readable name
  objective: string // Clear goal statement
  tasks: string[] // Specific action items
  dependencies: string[] // IDs of phases that must complete first
  complexity: 'low' | 'medium' | 'high'
  required_context: {
    files: string[] // File paths worker should know about
    concepts: string[] // Domain knowledge needed
    artifacts_from: string[] // Phase IDs to receive artifacts from
  }
  success_criteria: string // Verifiable completion condition
  constraints?: string[] // Things phase should NOT do
}

export interface InterpretedPlan {
  phases: Phase[]
  parallel_groups: string[][] // Phases that can run together
  metadata: {
    total_phases: number
    estimated_parallelism: number
    estimated_tokens?: number
    notes?: string
  }
}

// Execution State Types

export type PhaseStatus =
  | 'pending' // Not yet ready (deps incomplete)
  | 'ready' // Can be started
  | 'running' // Currently executing
  | 'complete' // Successfully finished
  | 'failed' // Error occurred
  | 'aborted' // User cancelled
  | 'blocked' // Dependency failed

export interface ScheduledPhase extends Phase {
  status: PhaseStatus
  startedAt?: string // ISO date string
  completedAt?: string // ISO date string
  error?: string
  artifacts: Artifact[]
  workerId?: string
}

// Artifact Types

export type ArtifactType =
  | 'file_created'
  | 'file_modified'
  | 'file_deleted'
  | 'export'
  | 'note'

export interface Artifact {
  type: ArtifactType
  path?: string
  content?: string
  metadata?: Record<string, unknown>
}

// State File Types (for .symphony-state.json)

export interface SymphonyState {
  planPath: string
  startedAt: string // ISO date string
  completedAt?: string // ISO date string
  phases: Record<string, PhaseState>
  plan?: { phases: Phase[] } // Full phase definitions for dependency resolution
  completedCount: number
  failedCount: number
  status: 'running' | 'completed' | 'failed' | 'aborted'
}

export interface PhaseState {
  status: PhaseStatus
  startedAt?: string
  completedAt?: string
  error?: string
  artifacts: Artifact[]
}

// Ready Phase Result

export interface ReadyPhaseInfo {
  phase: Phase
  artifacts: Artifact[] // Artifacts from dependency phases
}
