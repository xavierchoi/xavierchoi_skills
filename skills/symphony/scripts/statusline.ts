#!/usr/bin/env bun
// Symphony Skill - Statusline Script
// Displays orchestration progress in Claude Code's statusline
//
// Output format: [████░░░░░░] 4/10 (1!) | setup-db, auth-middleware
// Terminal states: [Done] 10/10, [Failed] 7/10, [Aborted] 5/10
// Silent exit (no output) when state file missing or invalid

import { readFileSync, existsSync } from 'fs'
import type { SymphonyState, PhaseState } from './lib/types.ts'

const STATE_FILE = '.symphony-state.json'
const FILLED = '\u2588' // █
const EMPTY = '\u2591' // ░
const BAR_WIDTH = 10
const MAX_RUNNING_CHARS = 30

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
}

function main(): void {
  // Silent exit if state file doesn't exist
  if (!existsSync(STATE_FILE)) {
    process.exit(0)
  }

  // Read and parse state file
  let state: SymphonyState
  try {
    const content = readFileSync(STATE_FILE, 'utf-8')
    state = JSON.parse(content)
  } catch {
    // Silent exit if file can't be parsed
    process.exit(0)
  }

  // Get total phases count
  const totalPhases = state.plan?.phases?.length ?? Object.keys(state.phases).length
  if (totalPhases === 0) {
    process.exit(0)
  }

  const completedCount = state.completedCount
  const failedCount = state.failedCount

  // Handle terminal states
  if (state.status === 'completed') {
    console.log(`${colors.green}[Done]${colors.reset} ${completedCount}/${totalPhases}`)
    return
  }

  if (state.status === 'failed') {
    console.log(`${colors.red}[Failed]${colors.reset} ${completedCount}/${totalPhases}`)
    return
  }

  if (state.status === 'aborted') {
    console.log(`${colors.gray}[Aborted]${colors.reset} ${completedCount}/${totalPhases}`)
    return
  }

  // Running state - build progress bar
  const filledCount = Math.round((completedCount / totalPhases) * BAR_WIDTH)
  const emptyCount = BAR_WIDTH - filledCount
  const progressBar = `${colors.green}${FILLED.repeat(filledCount)}${colors.gray}${EMPTY.repeat(emptyCount)}${colors.reset}`

  // Build count string with optional failure indicator
  let countStr = `${completedCount}/${totalPhases}`
  if (failedCount > 0) {
    countStr += ` ${colors.red}(${failedCount}!)${colors.reset}`
  }

  // Get running phase names
  const runningPhases: string[] = []
  for (const [phaseId, phaseState] of Object.entries(state.phases)) {
    if (phaseState.status === 'running') {
      runningPhases.push(phaseId)
    }
  }

  // Build output
  let output = `[${progressBar}] ${countStr}`

  if (runningPhases.length > 0) {
    // Truncate running phases if too long
    let runningStr = runningPhases.join(', ')
    if (runningStr.length > MAX_RUNNING_CHARS) {
      runningStr = runningStr.substring(0, MAX_RUNNING_CHARS - 3) + '...'
    }
    output += ` | ${colors.yellow}${runningStr}${colors.reset}`
  }

  console.log(output)
}

main()
