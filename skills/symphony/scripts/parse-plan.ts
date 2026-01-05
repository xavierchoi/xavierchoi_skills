#!/usr/bin/env bun
/**
 * parse-plan.ts
 *
 * Parses a plan file and extracts phases from the symphony-phases code block.
 *
 * Usage: bun scripts/parse-plan.ts <plan-path>
 *
 * Arguments:
 *   plan-path  - Path to the markdown plan file
 *
 * Output:
 *   JSON array of validated phases
 *   Exit code 0 on success, 1 on failure
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { validatePhases, formatValidationErrors } from './lib/validation.ts'
import type { Phase } from './lib/types.ts'

/**
 * Extract the symphony-phases JSON block from markdown content
 */
function extractSymphonyPhases(content: string): string | null {
  // Match ```symphony-phases followed by content until closing ```
  const pattern = /```symphony-phases\s*\n([\s\S]*?)\n```/
  const match = content.match(pattern)

  if (!match || !match[1]) {
    return null
  }

  return match[1].trim()
}

/**
 * Parse JSON with helpful error messages
 */
function parseJson(jsonString: string, filePath: string): unknown {
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Try to provide helpful context about where the error occurred
      const lines = jsonString.split('\n')
      const errorMatch = error.message.match(/position (\d+)/)

      if (errorMatch) {
        const position = parseInt(errorMatch[1], 10)
        let charCount = 0
        let lineNum = 0

        for (let i = 0; i < lines.length; i++) {
          if (charCount + lines[i].length >= position) {
            lineNum = i + 1
            break
          }
          charCount += lines[i].length + 1 // +1 for newline
        }

        console.error(`Error: Invalid JSON in symphony-phases block at line ${lineNum}`)
        console.error(`  ${error.message}`)
      } else {
        console.error(`Error: Invalid JSON in symphony-phases block`)
        console.error(`  ${error.message}`)
      }
    } else {
      console.error(`Error: Failed to parse JSON: ${error}`)
    }
    process.exit(1)
  }
}

/**
 * Main function
 */
function main(): void {
  // Parse arguments
  const args = process.argv.slice(2)

  // Check for help flag
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`Usage: bun scripts/parse-plan.ts <plan-path>

Parses a plan file and extracts phases from the symphony-phases code block.

Arguments:
  plan-path  - Path to the markdown plan file

Output:
  JSON array of validated phases
  Exit code 0 on success, 1 on failure`)
    process.exit(0)
  }

  // Require plan path argument
  if (args.length === 0) {
    console.error('Error: Plan file path is required')
    console.error('Usage: bun scripts/parse-plan.ts <plan-path>')
    process.exit(1)
  }

  const planPath = resolve(args[0])

  // Check file exists
  if (!existsSync(planPath)) {
    console.error(`Error: Plan file not found: "${planPath}"`)
    process.exit(1)
  }

  // Read file content
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
    console.error('Expected format:')
    console.error('```symphony-phases')
    console.error('[...phases JSON...]')
    console.error('```')
    process.exit(1)
  }

  // Parse JSON
  const parsed = parseJson(phasesJson, planPath)

  // Validate phases
  const validationResult = validatePhases(parsed)

  if (!validationResult.valid) {
    console.error('Error: Phase validation failed')
    console.error(formatValidationErrors(validationResult))
    process.exit(1)
  }

  // Output validated phases as JSON
  const phases = parsed as Phase[]
  console.log(JSON.stringify(phases, null, 2))
}

main()
