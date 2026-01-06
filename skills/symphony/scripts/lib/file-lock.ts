/**
 * File Locking Utility for Symphony State Management
 *
 * Provides a simple cross-platform file locking mechanism to prevent race conditions
 * when multiple scripts attempt to update the state file simultaneously.
 *
 * Uses a .lock file approach with exponential backoff retry logic.
 */

import { writeFileSync, unlinkSync, existsSync, statSync } from 'fs'

/**
 * Default configuration for file locking
 */
const LOCK_CONFIG = {
  /** Maximum time to wait for lock acquisition in milliseconds */
  maxWaitTimeMs: 30000,
  /** Initial delay between retry attempts in milliseconds */
  initialDelayMs: 50,
  /** Maximum delay between retry attempts in milliseconds */
  maxDelayMs: 2000,
  /** Stale lock threshold - locks older than this are considered abandoned */
  staleLockThresholdMs: 60000,
} as const

/**
 * Error thrown when lock acquisition times out
 */
export class LockTimeoutError extends Error {
  constructor(
    public readonly lockPath: string,
    public readonly waitTimeMs: number
  ) {
    super(`Failed to acquire lock on ${lockPath} after ${waitTimeMs}ms`)
    this.name = 'LockTimeoutError'
  }
}

/**
 * Attempts to acquire a lock file atomically.
 *
 * Uses the O_EXCL flag behavior via writeFileSync with 'wx' mode,
 * which fails if the file already exists.
 *
 * @param lockPath - Path to the lock file
 * @returns true if lock was acquired, false if lock is held by another process
 */
function tryAcquireLock(lockPath: string): boolean {
  try {
    // Write lock file with exclusive flag - fails if file exists
    writeFileSync(lockPath, String(process.pid), { flag: 'wx' })
    return true
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (error.code === 'EEXIST') {
      // Lock file exists - another process holds the lock
      return false
    }
    // Re-throw unexpected errors
    throw err
  }
}

/**
 * Releases a lock file by deleting it.
 *
 * @param lockPath - Path to the lock file to release
 */
function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath)
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    // Ignore ENOENT - lock file may have been cleaned up externally
    if (error.code !== 'ENOENT') {
      // Log but don't throw - we're in cleanup
      console.error(`Warning: Failed to release lock ${lockPath}: ${error.message}`)
    }
  }
}

/**
 * Checks if an existing lock file is stale (abandoned by a crashed process).
 *
 * A lock is considered stale if:
 * - The lock file is older than the stale threshold
 *
 * @param lockPath - Path to the lock file
 * @returns true if the lock is stale and can be removed
 */
function isLockStale(lockPath: string): boolean {
  try {
    if (!existsSync(lockPath)) {
      return false
    }
    const stats = statSync(lockPath)
    const lockAge = Date.now() - stats.mtimeMs
    return lockAge > LOCK_CONFIG.staleLockThresholdMs
  } catch {
    // If we can't check, assume not stale
    return false
  }
}

/**
 * Removes a stale lock file if it exists and is stale.
 *
 * @param lockPath - Path to the lock file
 * @returns true if a stale lock was removed
 */
function removeStalelock(lockPath: string): boolean {
  if (isLockStale(lockPath)) {
    try {
      unlinkSync(lockPath)
      return true
    } catch {
      // Race condition - another process may have acquired it
      return false
    }
  }
  return false
}

/**
 * Sleeps for the specified duration.
 *
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculates the next backoff delay using exponential backoff with jitter.
 *
 * @param attempt - The current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number): number {
  const base = Math.min(
    LOCK_CONFIG.initialDelayMs * Math.pow(2, attempt),
    LOCK_CONFIG.maxDelayMs
  )
  // Add jitter of +/- 25%
  const jitter = (Math.random() - 0.5) * 0.5 * base
  return Math.floor(base + jitter)
}

/**
 * Executes a function while holding an exclusive lock on a file.
 *
 * This function provides a safe way to perform read-modify-write operations
 * on shared files without race conditions. It uses a .lock file approach
 * that is compatible across different platforms.
 *
 * The lock acquisition uses exponential backoff with jitter when the lock
 * is held by another process, with a maximum wait time of 30 seconds.
 *
 * @template T - The return type of the provided function
 * @param filePath - Path to the file to lock (lock file will be `${filePath}.lock`)
 * @param fn - Function to execute while holding the lock. Can be sync or async.
 * @returns Promise resolving to the return value of the provided function
 * @throws {LockTimeoutError} If lock cannot be acquired within 30 seconds
 * @throws {Error} Any error thrown by the provided function (lock is released first)
 *
 * @example
 * // Basic usage with state file
 * const result = await withFileLock('/path/to/state.json', () => {
 *   const state = JSON.parse(readFileSync('/path/to/state.json', 'utf-8'));
 *   state.counter++;
 *   writeFileSync('/path/to/state.json', JSON.stringify(state, null, 2));
 *   return state.counter;
 * });
 *
 * @example
 * // Async usage
 * await withFileLock('/path/to/state.json', async () => {
 *   const state = JSON.parse(readFileSync('/path/to/state.json', 'utf-8'));
 *   await someAsyncOperation(state);
 *   writeFileSync('/path/to/state.json', JSON.stringify(state, null, 2));
 * });
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const lockPath = `${filePath}.lock`
  const startTime = Date.now()
  let attempt = 0

  // Try to acquire lock with exponential backoff
  while (true) {
    // First, check for and remove stale locks
    removeStalelock(lockPath)

    // Try to acquire the lock
    if (tryAcquireLock(lockPath)) {
      break
    }

    // Check if we've exceeded the maximum wait time
    const elapsed = Date.now() - startTime
    if (elapsed >= LOCK_CONFIG.maxWaitTimeMs) {
      throw new LockTimeoutError(lockPath, elapsed)
    }

    // Calculate backoff delay and wait
    const delay = calculateBackoff(attempt)
    await sleep(delay)
    attempt++
  }

  // Lock acquired - execute the function and ensure cleanup
  try {
    const result = await fn()
    return result
  } finally {
    releaseLock(lockPath)
  }
}
