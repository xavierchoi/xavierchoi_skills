#!/usr/bin/env bun
// Symphony Skill - Mark Phase Failed Script
// Marks a phase as failed and blocks dependent phases
//
// Usage: bun scripts/mark-failed.ts <state-path> <phase-id> <error-message>

import { readFileSync, writeFileSync } from 'fs'
import type { SymphonyState, Phase, PhaseStatus } from './lib/types.ts'

function main(): void {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.error('Usage: bun scripts/mark-failed.ts <state-path> <phase-id> <error-message>')
    console.error('')
    console.error('Arguments:')
    console.error('  state-path     Path to the .symphony-state.json file')
    console.error('  phase-id       ID of the phase that failed')
    console.error('  error-message  Error message describing why the phase failed')
    console.error('')
    console.error('Example:')
    console.error('  bun scripts/mark-failed.ts state.json build-phase "TypeScript compilation failed"')
    process.exit(1)
  }

  const statePath = args[0]
  const phaseId = args[1]
  const errorMessage = args[2]

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

  // Get previous status for counting
  const previousStatus = state.phases[phaseId].status

  // Update the phase state
  state.phases[phaseId].status = 'failed'
  state.phases[phaseId].completedAt = new Date().toISOString()
  state.phases[phaseId].error = errorMessage

  // Update failedCount if this wasn't already failed
  if (previousStatus !== 'failed') {
    state.failedCount = (state.failedCount || 0) + 1
  }

  // Block dependent phases
  const blockedPhases: string[] = []

  // We need the plan to find dependencies
  if (state.plan?.phases && Array.isArray(state.plan.phases)) {
    // Build a map of phase ID to its dependents
    const dependentsMap = new Map<string, string[]>()
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

    // Recursively block dependents
    const blockDependents = (failedPhaseId: string): void => {
      const dependents = dependentsMap.get(failedPhaseId) || []
      for (const dependentId of dependents) {
        const dependentState = state.phases[dependentId]
        if (dependentState && (dependentState.status === 'pending' || dependentState.status === 'ready')) {
          dependentState.status = 'blocked'
          blockedPhases.push(dependentId)
          // Recursively block phases that depend on this blocked phase
          blockDependents(dependentId)
        }
      }
    }

    blockDependents(phaseId)
  }

  // Update orchestration status to failed
  state.status = 'failed'

  // Write back to file
  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2))
  } catch (err) {
    console.error(`Error writing state file: ${(err as Error).message}`)
    process.exit(1)
  }

  // Output success message
  console.log(
    JSON.stringify({
      success: true,
      phaseId,
      status: 'failed',
      error: errorMessage,
      completedAt: state.phases[phaseId].completedAt,
      failedCount: state.failedCount,
      blockedPhases,
      orchestrationStatus: state.status,
    })
  )
}

main()
