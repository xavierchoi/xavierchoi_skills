#!/usr/bin/env bun
// Symphony Skill - Mark Phase Failed Script
// Marks a phase as failed with integrated retry logic
//
// Usage: bun scripts/mark-failed.ts <state-path> <phase-id> <error-message> [--no-retry]

import { readFileSync } from 'fs'
import type {
  SymphonyState,
  Phase,
  PhaseStatus,
  RetryPolicy,
  RetryAttempt,
  PendingDecision,
  ErrorCategory,
} from './lib/types.ts'
import { DEFAULT_RETRY_POLICY } from './lib/types.ts'
import { classifyError } from './classify-error.ts'
import { calculateBackoff } from './lib/backoff.ts'
import { atomicWriteFileSync } from './lib/atomic-write.ts'
import { withFileLock } from './lib/file-lock.ts'

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Check for --no-retry flag
  const noRetryIndex = args.indexOf('--no-retry')
  const noRetryFlag = noRetryIndex !== -1
  if (noRetryFlag) {
    args.splice(noRetryIndex, 1)
  }

  if (args.length < 3) {
    console.error(
      'Usage: bun scripts/mark-failed.ts <state-path> <phase-id> <error-message> [--no-retry]'
    )
    console.error('')
    console.error('Arguments:')
    console.error('  state-path     Path to the .symphony-state.json file')
    console.error('  phase-id       ID of the phase that failed')
    console.error('  error-message  Error message describing why the phase failed')
    console.error('')
    console.error('Options:')
    console.error('  --no-retry     Skip retry logic and immediately fail the phase')
    console.error('')
    console.error('Example:')
    console.error('  bun scripts/mark-failed.ts state.json build-phase "TypeScript compilation failed"')
    console.error('  bun scripts/mark-failed.ts state.json build-phase "Fatal error" --no-retry')
    process.exit(1)
  }

  const statePath = args[0]
  const phaseId = args[1]
  const errorMessage = args[2]

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
    let state: SymphonyState & { plan?: { phases: Phase[] } }
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

    // Get phase state and classify the error
    const phaseState = state.phases[phaseId]
    const previousStatus = phaseState.status
    const classification = classifyError(errorMessage)
    const errorCategory = classification.category

    // Store the error category on the phase state
    phaseState.lastErrorCategory = errorCategory
    phaseState.error = errorMessage

    // Initialize retry count if not present
    if (typeof phaseState.retryCount !== 'number') {
      phaseState.retryCount = 0
    }

    // Get retry policy (use state policy or default)
    const policy: RetryPolicy = state.retryPolicy ?? DEFAULT_RETRY_POLICY

    // Check if error is retryable and retries are available
    const isRetryable = policy.retryableCategories.includes(errorCategory)
    const hasRetriesLeft = phaseState.retryCount < policy.maxRetries

    // Helper function to build dependents map
    const buildDependentsMap = (): Map<string, string[]> => {
      const dependentsMap = new Map<string, string[]>()
      if (state.plan?.phases && Array.isArray(state.plan.phases)) {
        for (const phase of state.plan.phases) {
          for (const depId of phase.dependencies) {
            if (!dependentsMap.has(depId)) {
              dependentsMap.set(depId, [])
            }
            dependentsMap.get(depId)!.push(phase.id)
          }
          // Also consider artifacts_from as implicit dependencies
          for (const artifactSource of phase.required_context.artifacts_from) {
            if (!dependentsMap.has(artifactSource)) {
              dependentsMap.set(artifactSource, [])
            }
            if (!dependentsMap.get(artifactSource)!.includes(phase.id)) {
              dependentsMap.get(artifactSource)!.push(phase.id)
            }
          }
        }
      }
      return dependentsMap
    }

    // Helper function to block dependents recursively
    const blockDependents = (
      failedPhaseId: string,
      dependentsMap: Map<string, string[]>,
      blockedPhases: string[]
    ): void => {
      const dependents = dependentsMap.get(failedPhaseId) || []
      for (const dependentId of dependents) {
        const dependentState = state.phases[dependentId]
        if (
          dependentState &&
          !['complete', 'failed', 'aborted', 'blocked'].includes(dependentState.status)
        ) {
          dependentState.status = 'blocked'
          blockedPhases.push(dependentId)
          // Recursively block phases that depend on this blocked phase
          blockDependents(dependentId, dependentsMap, blockedPhases)
        }
      }
    }

    // Track result for output
    let action: 'scheduled_retry' | 'awaiting_decision' | 'failed'
    let blockedPhases: string[] = []
    let nextRetryAt: string | undefined
    let delayMs: number | undefined

    if (!noRetryFlag && isRetryable && hasRetriesLeft) {
      // Schedule a retry
      action = 'scheduled_retry'

      // Increment retry count
      phaseState.retryCount++

      // Calculate backoff delay
      delayMs = calculateBackoff(phaseState.retryCount - 1, policy)
      nextRetryAt = new Date(Date.now() + delayMs).toISOString()
      phaseState.nextRetryAt = nextRetryAt

      // Set status to retrying
      phaseState.status = 'retrying'

      // Add to retry history
      const retryAttempt: RetryAttempt = {
        attemptNumber: phaseState.retryCount,
        startedAt: phaseState.startedAt || new Date().toISOString(),
        failedAt: new Date().toISOString(),
        error: errorMessage,
        errorCategory,
        durationMs: phaseState.startedAt
          ? Date.now() - new Date(phaseState.startedAt).getTime()
          : 0,
      }
      phaseState.retryHistory = phaseState.retryHistory || []
      phaseState.retryHistory.push(retryAttempt)

      // DO NOT block dependents - retry will be attempted
      // Keep orchestration running
      // (state.status remains unchanged)
    } else if (!noRetryFlag) {
      // Error not retryable or retries exhausted - await user decision
      action = 'awaiting_decision'

      // Set phase status
      phaseState.status = 'awaiting_decision'
      phaseState.completedAt = new Date().toISOString()

      // Add retry history entry for this final failure
      const retryAttempt: RetryAttempt = {
        attemptNumber: phaseState.retryCount + 1,
        startedAt: phaseState.startedAt || new Date().toISOString(),
        failedAt: new Date().toISOString(),
        error: errorMessage,
        errorCategory,
        durationMs: phaseState.startedAt
          ? Date.now() - new Date(phaseState.startedAt).getTime()
          : 0,
      }
      phaseState.retryHistory = phaseState.retryHistory || []
      phaseState.retryHistory.push(retryAttempt)

      // Add to pending decisions
      const pendingDecision: PendingDecision = {
        phaseId,
        error: errorMessage,
        errorCategory,
        retryCount: phaseState.retryCount,
        options: ['retry_once_more', 'skip_phase', 'abort_branch', 'abort_all'],
        askedAt: new Date().toISOString(),
      }
      state.pendingDecisions = state.pendingDecisions || []
      state.pendingDecisions = state.pendingDecisions.filter((d) => d.phaseId !== phaseId)
      state.pendingDecisions.push(pendingDecision)

      // Set orchestration status to awaiting user decision
      state.status = 'awaiting_user_decision'

      // DO NOT block dependents yet - user decides
    } else {
      // --no-retry flag: Original failure behavior
      action = 'failed'

      // Update the phase state
      phaseState.status = 'failed'
      phaseState.completedAt = new Date().toISOString()

      // Update failedCount if this wasn't already failed
      if (previousStatus !== 'failed') {
        state.failedCount = (state.failedCount || 0) + 1
      }

      // Block dependent phases
      const dependentsMap = buildDependentsMap()
      blockDependents(phaseId, dependentsMap, blockedPhases)

      // Update orchestration status to failed
      state.status = 'failed'
    }

    // Write back to file
    try {
      atomicWriteFileSync(statePath, JSON.stringify(state, null, 2))
    } catch (err) {
      console.error(`Error writing state file: ${(err as Error).message}`)
      process.exit(1)
    }

    // Build output based on action taken
    const result: Record<string, unknown> = {
      success: true,
      action,
      phaseId,
      status: phaseState.status,
      error: errorMessage,
      errorCategory,
      retryCount: phaseState.retryCount,
    }

    if (action === 'scheduled_retry') {
      result.nextRetryAt = nextRetryAt
      result.delayMs = delayMs
      result.retriesRemaining = policy.maxRetries - phaseState.retryCount
    } else if (action === 'awaiting_decision') {
      result.completedAt = phaseState.completedAt
      result.orchestrationStatus = state.status
      result.awaitingDecision = true
      result.decisionOptions = ['retry_once_more', 'skip_phase', 'abort_branch', 'abort_all']
    } else {
      // action === 'failed'
      result.completedAt = phaseState.completedAt
      result.failedCount = state.failedCount
      result.blockedPhases = blockedPhases
      result.orchestrationStatus = state.status
    }

    return result
  })

  // Output result
  console.log(JSON.stringify(output))
}

main()
