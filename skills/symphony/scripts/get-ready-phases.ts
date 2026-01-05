#!/usr/bin/env bun
// Symphony Skill - Get Ready Phases Script
// Finds phases that are ready for execution based on the current state
//
// Usage: bun scripts/get-ready-phases.ts <state-path>

import { readFileSync } from 'fs'
import type { SymphonyState, Phase, Artifact, ReadyPhaseInfo } from './lib/types.ts'
import { DependencyGraph } from './lib/scheduler.ts'

function main(): void {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.error('Usage: bun scripts/get-ready-phases.ts <state-path>')
    console.error('')
    console.error('Arguments:')
    console.error('  state-path  Path to the .symphony-state.json file')
    process.exit(1)
  }

  const statePath = args[0]

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

  // Validate state has required fields
  if (!state.phases || typeof state.phases !== 'object') {
    console.error('Error: State file missing "phases" field')
    process.exit(1)
  }

  if (!state.plan?.phases || !Array.isArray(state.plan.phases)) {
    console.error('Error: State file missing "plan.phases" array with phase definitions')
    process.exit(1)
  }

  // Build the dependency graph from the plan phases
  const graph = new DependencyGraph(state.plan.phases)

  // Apply current state to the graph
  for (const [phaseId, phaseState] of Object.entries(state.phases)) {
    const phase = graph.getPhase(phaseId)
    if (phase) {
      phase.status = phaseState.status
      phase.startedAt = phaseState.startedAt
      phase.completedAt = phaseState.completedAt
      phase.error = phaseState.error
      phase.artifacts = phaseState.artifacts || []
    }
  }

  // Get ready phases
  const readyPhaseIds = graph.getReady()

  // Build the result with artifacts from dependencies
  const readyPhases: ReadyPhaseInfo[] = readyPhaseIds.map((phaseId) => {
    const phase = graph.getPhase(phaseId)!
    const artifacts = graph.getArtifactsForPhase(phaseId)

    // Return the original phase definition (without runtime status fields)
    const originalPhase = state.plan!.phases.find((p) => p.id === phaseId)!

    return {
      phase: originalPhase,
      artifacts,
    }
  })

  // Output as JSON
  console.log(JSON.stringify(readyPhases, null, 2))
}

main()
