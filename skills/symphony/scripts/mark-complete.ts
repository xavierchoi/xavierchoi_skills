#!/usr/bin/env bun
// Symphony Skill - Mark Phase Complete Script
// Marks a phase as complete and stores artifacts
//
// Usage: bun scripts/mark-complete.ts <state-path> <phase-id> [artifacts-json]

import { readFileSync, writeFileSync } from 'fs'
import type { SymphonyState, Artifact } from './lib/types.ts'

function main(): void {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error('Usage: bun scripts/mark-complete.ts <state-path> <phase-id> [artifacts-json]')
    console.error('')
    console.error('Arguments:')
    console.error('  state-path      Path to the .symphony-state.json file')
    console.error('  phase-id        ID of the phase to mark as complete')
    console.error('  artifacts-json  Optional JSON array of artifacts produced by the phase')
    console.error('')
    console.error('Example:')
    console.error('  bun scripts/mark-complete.ts state.json setup-phase')
    console.error('  bun scripts/mark-complete.ts state.json build-phase \'[{"type":"file_created","path":"dist/index.js"}]\'')
    process.exit(1)
  }

  const statePath = args[0]
  const phaseId = args[1]
  const artifactsJson = args[2]

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

  // Parse artifacts if provided
  let artifacts: Artifact[] = []
  if (artifactsJson) {
    try {
      artifacts = JSON.parse(artifactsJson)
      if (!Array.isArray(artifacts)) {
        console.error('Error: Artifacts must be a JSON array')
        process.exit(1)
      }
    } catch (err) {
      console.error(`Error: Invalid artifacts JSON: ${(err as Error).message}`)
      process.exit(1)
    }
  }

  // Get previous status for counting
  const previousStatus = state.phases[phaseId].status

  // Update the phase state
  state.phases[phaseId].status = 'complete'
  state.phases[phaseId].completedAt = new Date().toISOString()
  state.phases[phaseId].artifacts = artifacts
  delete state.phases[phaseId].error

  // Update completedCount if this wasn't already complete
  if (previousStatus !== 'complete') {
    state.completedCount = (state.completedCount || 0) + 1
  }

  // Check if all phases are complete
  const allComplete = Object.values(state.phases).every((p) => p.status === 'complete')
  if (allComplete) {
    state.status = 'completed'
    state.completedAt = new Date().toISOString()
  }

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
      status: 'complete',
      completedAt: state.phases[phaseId].completedAt,
      artifactsCount: artifacts.length,
      completedCount: state.completedCount,
      orchestrationStatus: state.status,
    })
  )
}

main()
