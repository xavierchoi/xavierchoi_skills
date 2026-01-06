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
  | 'retrying' // Waiting for backoff delay before retry
  | 'awaiting_decision' // Retries exhausted, waiting for user decision

// Error Classification Types

export type ErrorCategory =
  | 'transient' // Network timeout, rate limit, temporary API errors
  | 'resource' // File not found, permission denied
  | 'logic' // Test failures, assertion errors
  | 'permanent' // Invalid configuration, syntax errors
  | 'timeout' // Phase execution timeout
  | 'unknown' // Could not classify

export interface RetryAttempt {
  attemptNumber: number
  startedAt: string // ISO date string
  failedAt: string // ISO date string
  error: string
  errorCategory: ErrorCategory
  durationMs: number
}

export type BackoffStrategy = 'fixed' | 'exponential' | 'exponential-jitter'

export interface RetryPolicy {
  maxRetries: number // Maximum retry attempts (default: 2)
  backoffStrategy: BackoffStrategy
  initialDelayMs: number // First retry delay (default: 5000)
  maxDelayMs: number // Maximum delay cap (default: 60000)
  retryableCategories: ErrorCategory[] // Which errors to retry
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  backoffStrategy: 'exponential-jitter',
  initialDelayMs: 5000,
  maxDelayMs: 60000,
  retryableCategories: ['transient', 'resource', 'timeout', 'unknown'],
}

export type DecisionOption =
  | 'retry_once_more' // Try one more time
  | 'skip_phase' // Mark as complete, proceed with dependents
  | 'abort_branch' // Stop this phase and all dependents
  | 'abort_all' // Stop entire orchestration

export interface PendingDecision {
  phaseId: string
  error: string
  errorCategory: ErrorCategory
  retryCount: number
  options: DecisionOption[]
  askedAt: string // ISO date string
}

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
  status: 'running' | 'completed' | 'failed' | 'aborted' | 'awaiting_user_decision'
  // Retry configuration
  retryPolicy?: RetryPolicy // Applied policy (defaults to DEFAULT_RETRY_POLICY)
  pendingDecisions?: PendingDecision[] // User decisions needed
}

export interface PhaseState {
  status: PhaseStatus
  startedAt?: string
  completedAt?: string
  error?: string
  artifacts: Artifact[]
  // Retry tracking
  retryCount: number // Current retry attempt (0 = first run)
  retryHistory?: RetryAttempt[] // History of all retry attempts
  lastErrorCategory?: ErrorCategory // Classification of most recent error
  nextRetryAt?: string // ISO date string for scheduled retry
}

// Ready Phase Result

export interface ReadyPhaseInfo {
  phase: Phase
  artifacts: Artifact[] // Artifacts from dependency phases
}
