#!/usr/bin/env bun
// Symphony Skill - Resolve Decision Script
// Handles user decisions when all retries are exhausted for a phase
//
// Usage: bun scripts/resolve-decision.ts <state-path> <phase-id> <decision>

import { readFileSync } from 'fs'
import type { SymphonyState, PhaseState, Phase, DecisionOption } from './lib/types.ts'
import { atomicWriteFileSync } from './lib/atomic-write.ts'
import { withFileLock } from './lib/file-lock.ts'

// Valid decision options
const VALID_DECISIONS: DecisionOption[] = [
  'retry_once_more',
  'skip_phase',
  'abort_branch',
  'abort_all',
]

/**
 * Find all phases that depend on given phase (directly or transitively).
 * Uses BFS to traverse the dependency graph.
 */
function findDependents(phases: Phase[], phaseId: string): string[] {
  const dependents: Set<string> = new Set()
  const queue = [phaseId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const phase of phases) {
      // Check both dependencies and artifacts_from
      if (
        phase.dependencies.includes(current) ||
        phase.required_context.artifacts_from.includes(current)
      ) {
        if (!dependents.has(phase.id)) {
          dependents.add(phase.id)
          queue.push(phase.id)
        }
      }
    }
  }

  return Array.from(dependents)
}

/**
 * Find phases that directly expect artifacts from a given phase.
 * Only checks direct artifact dependencies (not transitive).
 */
function findPhasesExpectingArtifacts(phases: Phase[], phaseId: string): string[] {
  const expecting: string[] = []

  for (const phase of phases) {
    // Check if this phase expects artifacts from the skipped phase
    if (phase.required_context.artifacts_from.includes(phaseId)) {
      expecting.push(phase.id)
    }
    // Also check dependencies as they may implicitly expect artifacts
    if (phase.dependencies.includes(phaseId)) {
      if (!expecting.includes(phase.id)) {
        expecting.push(phase.id)
      }
    }
  }

  return expecting
}

/**
 * Check if all phases are in a terminal state (complete, failed, aborted, blocked).
 */
function areAllPhasesTerminal(phases: Record<string, PhaseState>): boolean {
  const terminalStatuses = ['complete', 'failed', 'aborted', 'blocked']
  return Object.values(phases).every((p) => terminalStatuses.includes(p.status))
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.error('Usage: bun scripts/resolve-decision.ts <state-path> <phase-id> <decision>')
    console.error('')
    console.error('Arguments:')
    console.error('  state-path  Path to the .symphony-state.json file')
    console.error('  phase-id    ID of the phase awaiting decision')
    console.error('  decision    One of: retry_once_more, skip_phase, abort_branch, abort_all')
    console.error('')
    console.error('Example:')
    console.error('  bun scripts/resolve-decision.ts state.json build-phase skip_phase')
    process.exit(1)
  }

  const statePath = args[0]
  const phaseId = args[1]
  const decision = args[2] as DecisionOption

  // Validate decision (can be done outside the lock)
  if (!VALID_DECISIONS.includes(decision)) {
    console.error(`Error: Invalid decision "${decision}"`)
    console.error(`Valid decisions: ${VALID_DECISIONS.join(', ')}`)
    process.exit(1)
  }

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

    // Check if phase is in awaiting_decision status
    if (state.phases[phaseId].status !== 'awaiting_decision') {
      console.error(`Error: Phase "${phaseId}" is not awaiting a decision`)
      console.error(`Current status: ${state.phases[phaseId].status}`)
      process.exit(1)
    }

    // Check if phase exists in pendingDecisions
    const pendingDecisions = state.pendingDecisions || []
    const pendingIndex = pendingDecisions.findIndex((pd) => pd.phaseId === phaseId)
    if (pendingIndex === -1) {
      console.error(`Error: Phase "${phaseId}" not found in pendingDecisions`)
      process.exit(1)
    }

    // Get phases from plan for dependency resolution
    const planPhases = state.plan?.phases || []

    let message = ''
    const blockedPhases: string[] = []
    const abortedPhases: string[] = []
    const warnings: string[] = []

    // Handle decision
    switch (decision) {
      case 'retry_once_more': {
        // Reset phase status to 'ready' (not pending, so it runs immediately)
        state.phases[phaseId].status = 'ready'
        delete state.phases[phaseId].error
        delete state.phases[phaseId].nextRetryAt
        // Note: Don't reset retryCount - this is a one-time extra attempt

        // Remove from pendingDecisions
        pendingDecisions.splice(pendingIndex, 1)
        state.pendingDecisions = pendingDecisions

        // If no more pendingDecisions, set state.status back to 'running'
        if (pendingDecisions.length === 0) {
          state.status = 'running'
        }

        message = 'Phase set to ready for one more retry attempt'
        break
      }

      case 'skip_phase': {
        // Set phase status to 'complete'
        state.phases[phaseId].status = 'complete'
        state.phases[phaseId].completedAt = new Date().toISOString()
        delete state.phases[phaseId].error
        delete state.phases[phaseId].nextRetryAt

        // Add artifact noting the skip
        state.phases[phaseId].artifacts = state.phases[phaseId].artifacts || []
        state.phases[phaseId].artifacts.push({
          type: 'note',
          content: 'Phase skipped by user after retry failure',
        })

        // Check for phases that depend on this one and may expect artifacts
        if (planPhases.length > 0) {
          const dependentPhases = findPhasesExpectingArtifacts(planPhases, phaseId)
          if (dependentPhases.length > 0) {
            warnings.push(
              `Phase '${phaseId}' was skipped. The following phases may fail due to missing artifacts: ${dependentPhases.join(', ')}`
            )
          }
        }

        // Increment completedCount
        state.completedCount = (state.completedCount || 0) + 1

        // Remove from pendingDecisions
        pendingDecisions.splice(pendingIndex, 1)
        state.pendingDecisions = pendingDecisions

        // If no more pendingDecisions, set state.status back to 'running'
        if (pendingDecisions.length === 0) {
          state.status = 'running'
        }

        // Check if all phases complete
        const allComplete = Object.values(state.phases).every((p) => p.status === 'complete')
        if (allComplete) {
          state.status = 'completed'
          state.completedAt = new Date().toISOString()
        }

        message = 'Phase skipped, dependents unblocked'
        break
      }

      case 'abort_branch': {
        // Set phase status to 'aborted'
        state.phases[phaseId].status = 'aborted'
        state.phases[phaseId].completedAt = new Date().toISOString()
        abortedPhases.push(phaseId)

        // Block all dependent phases (recursive)
        if (planPhases.length > 0) {
          const dependents = findDependents(planPhases, phaseId)
          for (const dependentId of dependents) {
            if (state.phases[dependentId]) {
              const currentStatus = state.phases[dependentId].status
              // Only block phases that haven't completed or failed yet
              if (!['complete', 'failed', 'aborted', 'blocked'].includes(currentStatus)) {
                state.phases[dependentId].status = 'blocked'
                blockedPhases.push(dependentId)
              }
            }
          }
        }

        // Remove from pendingDecisions
        pendingDecisions.splice(pendingIndex, 1)
        state.pendingDecisions = pendingDecisions

        // If no more pendingDecisions and other phases remain, set state.status back to 'running'
        if (pendingDecisions.length === 0) {
          // Check if all phases are terminal
          if (areAllPhasesTerminal(state.phases)) {
            // Check if any completed successfully
            const hasComplete = Object.values(state.phases).some((p) => p.status === 'complete')
            const hasFailed = Object.values(state.phases).some(
              (p) => p.status === 'failed' || p.status === 'aborted'
            )
            if (hasFailed) {
              state.status = 'failed'
            } else if (hasComplete) {
              state.status = 'completed'
            }
            state.completedAt = new Date().toISOString()
          } else {
            state.status = 'running'
          }
        }

        message = `Phase aborted, ${blockedPhases.length} dependent phase(s) blocked`
        break
      }

      case 'abort_all': {
        const now = new Date().toISOString()

        // Set phase status to 'aborted'
        state.phases[phaseId].status = 'aborted'
        state.phases[phaseId].completedAt = now
        abortedPhases.push(phaseId)

        // Set ALL non-complete phases to 'aborted'
        for (const [id, phaseState] of Object.entries(state.phases)) {
          if (phaseState.status !== 'complete' && id !== phaseId) {
            phaseState.status = 'aborted'
            phaseState.completedAt = now
            abortedPhases.push(id)
          }
        }

        // Set state.status to 'aborted'
        state.status = 'aborted'
        state.completedAt = now

        // Clear pendingDecisions
        state.pendingDecisions = []

        message = `All phases aborted (${abortedPhases.length} total)`
        break
      }
    }

    // Write back to file
    try {
      atomicWriteFileSync(statePath, JSON.stringify(state, null, 2))
    } catch (err) {
      console.error(`Error writing state file: ${(err as Error).message}`)
      process.exit(1)
    }

    // Build output
    const result: Record<string, unknown> = {
      success: true,
      phaseId,
      decision,
      message,
    }

    if (blockedPhases.length > 0) {
      result.blockedPhases = blockedPhases
    }

    if (abortedPhases.length > 0) {
      result.abortedPhases = abortedPhases
    }

    if (warnings.length > 0) {
      result.warnings = warnings
    }

    result.orchestrationStatus = state.status

    return result
  })

  // Output success message
  console.log(JSON.stringify(output))
}

main()
