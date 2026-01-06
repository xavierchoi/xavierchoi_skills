#!/usr/bin/env bun
/**
 * classify-error.ts
 *
 * Classifies error messages into categories to determine if they're retryable.
 *
 * Usage: bun scripts/classify-error.ts <error-message>
 *
 * Arguments:
 *   error-message - The error message to classify
 *
 * Output:
 *   JSON object with classification result:
 *   - category: The error category (transient, resource, logic, permanent, timeout, unknown)
 *   - confidence: "high" if matched a pattern, "low" if unknown
 *   - matchedPattern: The regex pattern that matched (null if unknown)
 *
 * Exit code 0 on success, 1 on failure
 */

import type { ErrorCategory } from './lib/types.ts'

/**
 * Error classification patterns mapped to categories
 */
const ERROR_PATTERNS: Record<Exclude<ErrorCategory, 'unknown'>, RegExp[]> = {
  transient: [
    /rate.?limit/i,
    /timeout/i,
    /ETIMEDOUT/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /503|502|504/,
    /temporarily unavailable/i,
    /try again/i,
    /overloaded/i,
    /too many requests/i,
  ],
  resource: [
    /ENOENT/i,
    /file not found/i,
    /no such file/i,
    /permission denied/i,
    /EACCES/i,
    /cannot find/i,
    /does not exist/i,
  ],
  logic: [
    /assertion failed/i,
    /test.*(failed|error)/i,
    /expected.*but got/i,
    /typecheck.*error/i,
    /type error/i,
    /lint.*error/i,
    /eslint/i,
    /tsc.*error/i,
  ],
  permanent: [
    /invalid configuration/i,
    /missing required/i,
    /dependency.*not installed/i,
    /syntax error/i,
    /syntaxerror/i,
    /cannot resolve/i,
    /module not found/i,
    /invalid.*json/i,
  ],
  timeout: [
    /phase timeout/i,
    /execution timeout/i,
    /max.?turns exceeded/i,
    /timed out/i,
    /deadline exceeded/i,
  ],
}

/**
 * Result of error classification
 */
export interface ClassificationResult {
  category: ErrorCategory
  confidence: 'high' | 'low'
  matchedPattern: string | null
}

/**
 * Classify an error message into a category
 *
 * @param errorMessage - The error message to classify
 * @returns Classification result with category, confidence, and matched pattern
 */
export function classifyError(errorMessage: string): ClassificationResult {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return {
      category: 'unknown',
      confidence: 'low',
      matchedPattern: null,
    }
  }

  // Check each category's patterns
  for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(errorMessage)) {
        return {
          category: category as ErrorCategory,
          confidence: 'high',
          matchedPattern: pattern.source,
        }
      }
    }
  }

  // No pattern matched
  return {
    category: 'unknown',
    confidence: 'low',
    matchedPattern: null,
  }
}

/**
 * Main function for CLI usage
 */
function main(): void {
  const args = process.argv.slice(2)

  // Handle help flag
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`Usage: bun scripts/classify-error.ts <error-message>

Classifies error messages into categories to determine if they're retryable.

Arguments:
  error-message - The error message to classify

Categories:
  transient - Network timeout, rate limit, temporary API errors (retryable)
  resource  - File not found, permission denied (retryable)
  logic     - Test failures, assertion errors (not retryable)
  permanent - Invalid configuration, syntax errors (not retryable)
  timeout   - Phase execution timeout (retryable)
  unknown   - Could not classify (retryable by default)

Output:
  JSON object with classification result:
  - category: The error category
  - confidence: "high" if matched a pattern, "low" if unknown
  - matchedPattern: The regex pattern that matched (null if unknown)`)
    process.exit(0)
  }

  // Require error message argument
  if (args.length === 0) {
    console.error('Error: Error message argument is required')
    console.error('Usage: bun scripts/classify-error.ts <error-message>')
    process.exit(1)
  }

  // Join all arguments as the error message (in case it wasn't quoted)
  const errorMessage = args.join(' ')

  // Classify the error
  const result = classifyError(errorMessage)

  // Output result as JSON
  console.log(JSON.stringify(result))
}

// Only run main when executed directly, not when imported
if (import.meta.main) {
  main()
}
