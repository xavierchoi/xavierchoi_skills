#!/usr/bin/env bun
/**
 * retry-phase.ts
 *
 * Handles retry logic for failed phases in Symphony orchestration.
 * Marks a phase for retry with backoff calculation, or marks as final failure if retries exhausted.
 *
 * Usage: bun scripts/retry-phase.ts <state-path> <phase-id> <error-message> [--force]
 *
 * Arguments:
 *   state-path    - Path to .symphony-state.json
 *   phase-id      - ID of the failed phase
 *   error-message - The error that occurred
 *   --force       - Force retry even if error is not normally retryable
 *
 * Exit code 0 on success, 1 on failure
 */

import { readFileSync } from 'fs'
import type {
  SymphonyState,
  PhaseState,
  RetryPolicy,
  ErrorCategory,
  RetryAttempt,
  PendingDecision,
  DecisionOption,
} from './lib/types.ts'
import { DEFAULT_RETRY_POLICY } from './lib/types.ts'
import { classifyError } from './classify-error.ts'
import { calculateBackoff } from './lib/backoff.ts'
import { atomicWriteFileSync } from './lib/atomic-write.ts'
import { withFileLock } from './lib/file-lock.ts'

/**
 * Check if an error category is retryable according to the policy
 */
function isRetryableCategory(category: ErrorCategory, policy: RetryPolicy): boolean {
  return policy.retryableCategories.includes(category)
}

/**
 * Main function for CLI usage
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Handle help flag
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`Usage: bun scripts/retry-phase.ts <state-path> <phase-id> <error-message> [--force]

Handles retry logic for failed phases in Symphony orchestration.

Arguments:
  state-path    - Path to .symphony-state.json
  phase-id      - ID of the failed phase
  error-message - The error that occurred
  --force       - Force retry even if error is not normally retryable

Output:
  JSON object with retry result:
  - success: true if operation completed
  - action: "scheduled_retry" | "awaiting_decision" | "permanent_failure"
  - phaseId: The phase ID
  - retryCount: Current retry count after this operation
  - delayMs: Delay before next retry (if scheduled)
  - nextRetryAt: ISO timestamp for next retry (if scheduled)
  - errorCategory: Classification of the error
  - message: Human-readable description (for failures)`)
    process.exit(0)
  }

  // Check for --force flag and remove it from args
  const forceRetry = args.includes('--force')
  const filteredArgs = args.filter((arg) => arg !== '--force')

  // Validate required arguments
  if (filteredArgs.length < 3) {
    console.error('Error: Missing required arguments')
    console.error('Usage: bun scripts/retry-phase.ts <state-path> <phase-id> <error-message> [--force]')
    process.exit(1)
  }

  const statePath = filteredArgs[0]
  const phaseId = filteredArgs[1]
  const errorMessage = filteredArgs.slice(2).join(' ')

  // Wrap the entire read-modify-write operation in a file lock to prevent race conditions
  const output = await withFileLock(statePath, () => {
    // Read the state file
    let stateContent: string
    try {
      stateContent = readFileSync(statePath, 'utf-8')
    } catch (err) {
      const error = err as NodeJS.ErrnoException
      if (error.code === 'ENOENT') {
        console.error(`Error: State file not found: ${statePath}`)
      } else {
        console.error(`Error reading state file: ${error.message}`)
      }
      process.exit(1)
    }

    // Parse the state
    let state: SymphonyState
    try {
      state = JSON.parse(stateContent)
    } catch (err) {
      console.error(`Error: Invalid JSON in state file: ${(err as Error).message}`)
      process.exit(1)
    }

    // Validate state has phases
    if (!state.phases || typeof state.phases !== 'object') {
      console.error('Error: State file missing "phases" field')
      process.exit(1)
    }

    // Check if phase exists in state
    if (!state.phases[phaseId]) {
      console.error(`Error: Phase "${phaseId}" not found in state`)
      console.error(`Available phases: ${Object.keys(state.phases).join(', ')}`)
      process.exit(1)
    }

    const phaseState: PhaseState = state.phases[phaseId]

    // Classify the error
    const classification = classifyError(errorMessage)
    const errorCategory = classification.category

    // Get retry policy (from state or use default)
    const retryPolicy = state.retryPolicy || DEFAULT_RETRY_POLICY

    // Check if error category is retryable (unless --force is used)
    const isRetryable = forceRetry || isRetryableCategory(errorCategory, retryPolicy)

    if (!isRetryable) {
      // Non-retryable error - mark for user decision immediately
      phaseState.status = 'awaiting_decision'
      phaseState.error = errorMessage
      phaseState.lastErrorCategory = errorCategory

      // Add to pending decisions
      const pendingDecision: PendingDecision = {
        phaseId,
        error: errorMessage,
        errorCategory,
        retryCount: phaseState.retryCount || 0,
        options: ['retry_once_more', 'skip_phase', 'abort_branch', 'abort_all'] as DecisionOption[],
        askedAt: new Date().toISOString(),
      }

      if (!state.pendingDecisions) {
        state.pendingDecisions = []
      }
      // Remove any existing decision for this phase
      state.pendingDecisions = state.pendingDecisions.filter((d) => d.phaseId !== phaseId)
      state.pendingDecisions.push(pendingDecision)

      // Update orchestration status
      state.status = 'awaiting_user_decision'

      // Write state
      try {
        atomicWriteFileSync(statePath, JSON.stringify(state, null, 2))
      } catch (err) {
        console.error(`Error writing state file: ${(err as Error).message}`)
        process.exit(1)
      }

      return {
        success: true,
        action: 'permanent_failure',
        phaseId,
        errorCategory,
        message: `Error category '${errorCategory}' is not retryable`,
      }
    }

    // Check if retries are exhausted
    const currentRetryCount = phaseState.retryCount || 0
    if (currentRetryCount >= retryPolicy.maxRetries) {
      // Max retries exceeded - mark for user decision
      phaseState.status = 'awaiting_decision'
      phaseState.error = errorMessage
      phaseState.lastErrorCategory = errorCategory

      // Add retry attempt to history
      const retryAttempt: RetryAttempt = {
        attemptNumber: currentRetryCount,
        startedAt: phaseState.startedAt || new Date().toISOString(),
        failedAt: new Date().toISOString(),
        error: errorMessage,
        errorCategory,
        durationMs: phaseState.startedAt
          ? Date.now() - new Date(phaseState.startedAt).getTime()
          : 0,
      }

      if (!phaseState.retryHistory) {
        phaseState.retryHistory = []
      }
      phaseState.retryHistory.push(retryAttempt)

      // Add to pending decisions
      const pendingDecision: PendingDecision = {
        phaseId,
        error: errorMessage,
        errorCategory,
        retryCount: currentRetryCount,
        options: ['retry_once_more', 'skip_phase', 'abort_branch', 'abort_all'] as DecisionOption[],
        askedAt: new Date().toISOString(),
      }

      if (!state.pendingDecisions) {
        state.pendingDecisions = []
      }
      // Remove any existing decision for this phase
      state.pendingDecisions = state.pendingDecisions.filter((d) => d.phaseId !== phaseId)
      state.pendingDecisions.push(pendingDecision)

      // Update orchestration status
      state.status = 'awaiting_user_decision'

      // Write state
      try {
        atomicWriteFileSync(statePath, JSON.stringify(state, null, 2))
      } catch (err) {
        console.error(`Error writing state file: ${(err as Error).message}`)
        process.exit(1)
      }

      return {
        success: true,
        action: 'awaiting_decision',
        phaseId,
        retryCount: currentRetryCount,
        errorCategory,
        message: 'Max retries exceeded, awaiting user decision',
      }
    }

    // Schedule retry
    const newRetryCount = currentRetryCount + 1
    const delayMs = calculateBackoff(currentRetryCount, retryPolicy)
    const nextRetryAt = new Date(Date.now() + delayMs).toISOString()

    // Add current attempt to retry history
    const retryAttempt: RetryAttempt = {
      attemptNumber: currentRetryCount,
      startedAt: phaseState.startedAt || new Date().toISOString(),
      failedAt: new Date().toISOString(),
      error: errorMessage,
      errorCategory,
      durationMs: phaseState.startedAt
        ? Date.now() - new Date(phaseState.startedAt).getTime()
        : 0,
    }

    if (!phaseState.retryHistory) {
      phaseState.retryHistory = []
    }
    phaseState.retryHistory.push(retryAttempt)

    // Update phase state for retry
    phaseState.status = 'retrying'
    phaseState.retryCount = newRetryCount
    phaseState.lastErrorCategory = errorCategory
    phaseState.nextRetryAt = nextRetryAt
    phaseState.error = errorMessage
    // Clear startedAt so the retry is tracked separately
    delete phaseState.startedAt
    delete phaseState.completedAt

    // Write state
    try {
      atomicWriteFileSync(statePath, JSON.stringify(state, null, 2))
    } catch (err) {
      console.error(`Error writing state file: ${(err as Error).message}`)
      process.exit(1)
    }

    return {
      success: true,
      action: 'scheduled_retry',
      phaseId,
      retryCount: newRetryCount,
      delayMs,
      nextRetryAt,
      errorCategory,
    }
  })

  console.log(JSON.stringify(output))
}

main()
