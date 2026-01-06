/**
 * Backoff utility for Symphony retry logic
 *
 * Provides consistent backoff delay calculation across all retry mechanisms.
 */

import type { RetryPolicy } from './types.ts'

/**
 * Calculate backoff delay based on attempt number and retry policy.
 *
 * Supports three backoff strategies:
 * - `fixed`: Always returns the initial delay
 * - `exponential`: Doubles the delay with each attempt (2^n * initialDelay)
 * - `exponential-jitter`: Exponential with random jitter of +/-15% to prevent thundering herd
 *
 * @param attemptIndex - Zero-based retry attempt index (0 for first retry, 1 for second, etc.)
 * @param policy - Retry policy with backoff configuration
 * @returns Delay in milliseconds before next retry, capped at maxDelayMs
 *
 * @example
 * ```ts
 * const policy: RetryPolicy = {
 *   maxRetries: 3,
 *   backoffStrategy: 'exponential-jitter',
 *   initialDelayMs: 1000,
 *   maxDelayMs: 30000,
 *   retryableCategories: ['transient', 'timeout']
 * }
 *
 * // First retry: ~1000ms (+/- 15%)
 * const delay1 = calculateBackoff(0, policy)
 *
 * // Second retry: ~2000ms (+/- 15%)
 * const delay2 = calculateBackoff(1, policy)
 *
 * // Third retry: ~4000ms (+/- 15%)
 * const delay3 = calculateBackoff(2, policy)
 * ```
 */
export function calculateBackoff(attemptIndex: number, policy: RetryPolicy): number {
  const { initialDelayMs, maxDelayMs, backoffStrategy } = policy

  switch (backoffStrategy) {
    case 'fixed':
      return initialDelayMs

    case 'exponential':
      return Math.min(initialDelayMs * Math.pow(2, attemptIndex), maxDelayMs)

    case 'exponential-jitter': {
      const base = Math.min(initialDelayMs * Math.pow(2, attemptIndex), maxDelayMs)
      // Add jitter of +/- 15% to prevent thundering herd problem
      const jitter = (Math.random() - 0.5) * 0.3 * base
      return Math.floor(base + jitter)
    }

    default:
      return initialDelayMs
  }
}
