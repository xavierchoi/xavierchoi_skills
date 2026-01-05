#!/usr/bin/env bun
/**
 * find-latest-plan.ts
 *
 * Finds the latest plan file containing a symphony-phases code block.
 *
 * Usage: bun scripts/find-latest-plan.ts [directory]
 *
 * Arguments:
 *   directory  - Directory to search (default: ~/.claude/plans/)
 *
 * Output:
 *   The absolute path to the most recently modified plan file
 *   Exit code 0 on success, 1 on failure
 */

import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

const SYMPHONY_PHASES_PATTERN = /```symphony-phases\s*\n/

interface PlanFile {
  path: string
  mtime: number
}

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...findMarkdownFiles(fullPath))
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    // Directory not readable, skip it
  }

  return files
}

/**
 * Check if a file contains a symphony-phases code block
 */
function hasSymphonyPhasesBlock(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return SYMPHONY_PHASES_PATTERN.test(content)
  } catch {
    return false
  }
}

/**
 * Get the modification time of a file
 */
function getModificationTime(filePath: string): number {
  try {
    const stats = statSync(filePath)
    return stats.mtimeMs
  } catch {
    return 0
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
    console.log(`Usage: bun scripts/find-latest-plan.ts [directory]

Finds the latest plan file containing a symphony-phases code block.

Arguments:
  directory  - Directory to search (default: ~/.claude/plans/)

Output:
  The absolute path to the most recently modified plan file
  Exit code 0 on success, 1 on failure`)
    process.exit(0)
  }

  // Determine search directory
  const defaultDir = join(homedir(), '.claude', 'plans')
  const searchDir = resolve(args[0] || defaultDir)

  // Verify directory exists
  try {
    const stats = statSync(searchDir)
    if (!stats.isDirectory()) {
      console.error(`Error: "${searchDir}" is not a directory`)
      process.exit(1)
    }
  } catch {
    console.error(`Error: Directory "${searchDir}" does not exist`)
    process.exit(1)
  }

  // Find all markdown files
  const markdownFiles = findMarkdownFiles(searchDir)

  if (markdownFiles.length === 0) {
    console.error(`Error: No markdown files found in "${searchDir}"`)
    process.exit(1)
  }

  // Filter to only files with symphony-phases blocks
  const planFiles: PlanFile[] = []

  for (const filePath of markdownFiles) {
    if (hasSymphonyPhasesBlock(filePath)) {
      planFiles.push({
        path: filePath,
        mtime: getModificationTime(filePath),
      })
    }
  }

  if (planFiles.length === 0) {
    console.error(
      `Error: No plan files with symphony-phases blocks found in "${searchDir}"`
    )
    process.exit(1)
  }

  // Sort by modification time (newest first)
  planFiles.sort((a, b) => b.mtime - a.mtime)

  // Output the most recently modified plan file
  console.log(planFiles[0].path)
}

main()
