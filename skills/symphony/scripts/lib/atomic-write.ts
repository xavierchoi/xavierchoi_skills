/**
 * Atomic file write utility for Symphony state files.
 *
 * Provides crash-safe file writes by writing to a temporary file first,
 * then atomically renaming to the target path. This prevents file corruption
 * if the process is interrupted during a write operation.
 *
 * @module atomic-write
 */

import { writeFileSync, renameSync, unlinkSync, existsSync } from 'fs'

/**
 * Writes content to a file atomically.
 *
 * This function ensures that the file is never left in a corrupted state,
 * even if the process is interrupted during the write operation.
 *
 * The operation works by:
 * 1. Writing the content to a temporary file (with .tmp.{pid} suffix)
 * 2. Atomically renaming the temporary file to the target path
 * 3. Cleaning up the temporary file if an error occurs
 *
 * @param filePath - The absolute path to the target file
 * @param content - The content to write to the file
 * @throws {Error} If the write or rename operation fails
 *
 * @example
 * ```typescript
 * import { atomicWriteFileSync } from './lib/atomic-write.ts'
 *
 * // Write state file atomically
 * atomicWriteFileSync('/path/to/state.json', JSON.stringify(state, null, 2))
 * ```
 */
export function atomicWriteFileSync(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp.${process.pid}`

  try {
    // Write to temporary file first
    writeFileSync(tempPath, content, 'utf-8')

    // Atomically rename to target path
    // On POSIX systems, rename is atomic when source and destination are on the same filesystem
    renameSync(tempPath, filePath)
  } catch (error) {
    // Clean up temporary file on error
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath)
      }
    } catch {
      // Ignore cleanup errors - the original error is more important
    }

    throw error
  }
}
