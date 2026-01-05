#!/usr/bin/env bun
/**
 * init-state.ts
 *
 * Initializes a state file for Symphony orchestration.
 *
 * Usage: bun scripts/init-state.ts <plan-path> [-o output-path]
 *
 * Arguments:
 *   plan-path    - Path to the markdown plan file
 *   -o, --output - Output path for state file (default: .symphony-state.json in cwd)
 *
 * Output:
 *   Creates a .symphony-state.json file with initial state
 *   Outputs the state file path on success
 *   Exit code 0 on success, 1 on failure
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { validatePhases } from './lib/validation.ts'
import type { Phase, SymphonyState, PhaseState } from './lib/types.ts'

/**
 * Extract the symphony-phases JSON block from markdown content
 */
function extractSymphonyPhases(content: string): string | null {
  const pattern = /```symphony-phases\s*\n([\s\S]*?)\n```/
  const match = content.match(pattern)

  if (!match || !match[1]) {
    return null
  }

  return match[1].trim()
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): { planPath: string; outputPath: string } {
  let planPath = ''
  let outputPath = ''

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '-o' || arg === '--output') {
      if (i + 1 >= args.length) {
        console.error('Error: -o/--output requires a path argument')
        process.exit(1)
      }
      outputPath = args[++i]
    } else if (arg.startsWith('-')) {
      if (arg === '-h' || arg === '--help') {
        console.log(`Usage: bun scripts/init-state.ts <plan-path> [-o output-path]

Initializes a state file for Symphony orchestration.

Arguments:
  plan-path    - Path to the markdown plan file
  -o, --output - Output path for state file (default: .symphony-state.json in cwd)

Output:
  Creates a .symphony-state.json file with initial state
  Outputs the state file path on success
  Exit code 0 on success, 1 on failure`)
        process.exit(0)
      }
      console.error(`Error: Unknown option: ${arg}`)
      process.exit(1)
    } else if (!planPath) {
      planPath = arg
    } else {
      console.error(`Error: Unexpected argument: ${arg}`)
      process.exit(1)
    }
  }

  if (!planPath) {
    console.error('Error: Plan file path is required')
    console.error('Usage: bun scripts/init-state.ts <plan-path> [-o output-path]')
    process.exit(1)
  }

  // Default output path
  if (!outputPath) {
    outputPath = resolve(process.cwd(), '.symphony-state.json')
  } else {
    outputPath = resolve(outputPath)
  }

  return { planPath: resolve(planPath), outputPath }
}

/**
 * Create initial phase state
 */
function createPhaseState(): PhaseState {
  return {
    status: 'pending',
    artifacts: [],
  }
}

/**
 * Create initial Symphony state
 */
function createInitialState(planPath: string, phases: Phase[]): SymphonyState & { plan: { phases: Phase[] } } {
  const phaseStates: Record<string, PhaseState> = {}

  for (const phase of phases) {
    phaseStates[phase.id] = createPhaseState()
  }

  return {
    planPath,
    startedAt: new Date().toISOString(),
    phases: phaseStates,
    plan: { phases }, // Include full phase definitions for get-ready-phases and mark-failed
    completedCount: 0,
    failedCount: 0,
    status: 'running',
  }
}

/**
 * Main function
 */
function main(): void {
  const args = process.argv.slice(2)
  const { planPath, outputPath } = parseArgs(args)

  // Check plan file exists
  if (!existsSync(planPath)) {
    console.error(`Error: Plan file not found: "${planPath}"`)
    process.exit(1)
  }

  // Read plan file
  let content: string
  try {
    content = readFileSync(planPath, 'utf-8')
  } catch (error) {
    console.error(`Error: Failed to read plan file: ${error}`)
    process.exit(1)
  }

  // Extract symphony-phases block
  const phasesJson = extractSymphonyPhases(content)

  if (!phasesJson) {
    console.error('Error: No symphony-phases code block found in plan file')
    process.exit(1)
  }

  // Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(phasesJson)
  } catch (error) {
    console.error(`Error: Invalid JSON in symphony-phases block: ${error}`)
    process.exit(1)
  }

  // Validate phases
  const validationResult = validatePhases(parsed)

  if (!validationResult.valid) {
    console.error('Error: Phase validation failed')
    for (const error of validationResult.errors) {
      console.error(`  - ${error.field}: ${error.message}`)
    }
    process.exit(1)
  }

  const phases = parsed as Phase[]

  // Create initial state
  const state = createInitialState(planPath, phases)

  // Ensure output directory exists
  const outputDir = dirname(outputPath)
  try {
    mkdirSync(outputDir, { recursive: true })
  } catch {
    // Directory likely already exists
  }

  // Write state file
  try {
    writeFileSync(outputPath, JSON.stringify(state, null, 2), 'utf-8')
  } catch (error) {
    console.error(`Error: Failed to write state file: ${error}`)
    process.exit(1)
  }

  // Output success
  console.log(JSON.stringify({ success: true, statePath: outputPath, phaseCount: phases.length }, null, 2))
}

main()
