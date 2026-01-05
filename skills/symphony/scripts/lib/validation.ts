// Symphony Skill - Validation Utilities
// Security-focused validation for phase IDs and phase objects

import type { Phase } from './types.ts'

/**
 * Validation result with detailed error information.
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  value?: unknown
}

/**
 * Regex pattern for valid phase IDs.
 * Only allows lowercase letters, numbers, and hyphens.
 * Must start with a letter, cannot end with a hyphen.
 * This prevents shell injection attacks via phase.id.
 */
export const PHASE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/**
 * Maximum length for phase ID to prevent buffer issues.
 */
export const MAX_PHASE_ID_LENGTH = 64

/**
 * Validate a single phase ID.
 *
 * Security: This is critical for preventing command injection.
 * Phase IDs are used in shell commands, file paths, and tmux window names.
 *
 * Valid examples: "setup", "phase-1", "test-integration-api"
 * Invalid examples: "Phase1", "test_phase", "phase$(rm -rf /)", "phase`whoami`"
 */
export function validatePhaseId(phaseId: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (typeof phaseId !== 'string') {
    errors.push({
      field: 'id',
      message: 'Phase ID must be a string',
      value: phaseId,
    })
    return { valid: false, errors }
  }

  if (phaseId.length === 0) {
    errors.push({
      field: 'id',
      message: 'Phase ID cannot be empty',
      value: phaseId,
    })
    return { valid: false, errors }
  }

  if (phaseId.length > MAX_PHASE_ID_LENGTH) {
    errors.push({
      field: 'id',
      message: `Phase ID exceeds maximum length of ${MAX_PHASE_ID_LENGTH} characters`,
      value: phaseId,
    })
    return { valid: false, errors }
  }

  if (!PHASE_ID_PATTERN.test(phaseId)) {
    errors.push({
      field: 'id',
      message:
        'Phase ID must be kebab-case (lowercase letters, numbers, hyphens only). Must start with a letter and cannot end with a hyphen.',
      value: phaseId,
    })
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}

/**
 * Validate a complete Phase object.
 */
export function validatePhase(phase: unknown, index?: number): ValidationResult {
  const errors: ValidationError[] = []
  const prefix = index !== undefined ? `phases[${index}]` : 'phase'

  if (!phase || typeof phase !== 'object') {
    errors.push({
      field: prefix,
      message: 'Phase must be an object',
      value: phase,
    })
    return { valid: false, errors }
  }

  const p = phase as Record<string, unknown>

  // Validate id
  const idResult = validatePhaseId(p.id)
  if (!idResult.valid) {
    for (const err of idResult.errors) {
      errors.push({
        field: `${prefix}.${err.field}`,
        message: err.message,
        value: err.value,
      })
    }
  }

  // Validate title
  if (typeof p.title !== 'string' || p.title.trim().length === 0) {
    errors.push({
      field: `${prefix}.title`,
      message: 'Phase title must be a non-empty string',
      value: p.title,
    })
  }

  // Validate objective
  if (typeof p.objective !== 'string' || p.objective.trim().length === 0) {
    errors.push({
      field: `${prefix}.objective`,
      message: 'Phase objective must be a non-empty string',
      value: p.objective,
    })
  }

  // Validate tasks
  if (!Array.isArray(p.tasks)) {
    errors.push({
      field: `${prefix}.tasks`,
      message: 'Phase tasks must be an array',
      value: p.tasks,
    })
  } else if (p.tasks.length === 0) {
    errors.push({
      field: `${prefix}.tasks`,
      message: 'Phase must have at least one task',
      value: p.tasks,
    })
  } else {
    for (let i = 0; i < p.tasks.length; i++) {
      if (typeof p.tasks[i] !== 'string') {
        errors.push({
          field: `${prefix}.tasks[${i}]`,
          message: 'Task must be a string',
          value: p.tasks[i],
        })
      }
    }
  }

  // Validate dependencies
  if (!Array.isArray(p.dependencies)) {
    errors.push({
      field: `${prefix}.dependencies`,
      message: 'Phase dependencies must be an array',
      value: p.dependencies,
    })
  } else {
    for (let i = 0; i < p.dependencies.length; i++) {
      const depResult = validatePhaseId(p.dependencies[i])
      if (!depResult.valid) {
        errors.push({
          field: `${prefix}.dependencies[${i}]`,
          message: `Invalid dependency ID: ${depResult.errors[0]?.message}`,
          value: p.dependencies[i],
        })
      }
    }
  }

  // Validate complexity
  const validComplexities = ['low', 'medium', 'high']
  if (!validComplexities.includes(p.complexity as string)) {
    errors.push({
      field: `${prefix}.complexity`,
      message: `Phase complexity must be one of: ${validComplexities.join(', ')}`,
      value: p.complexity,
    })
  }

  // Validate required_context
  if (!p.required_context || typeof p.required_context !== 'object') {
    errors.push({
      field: `${prefix}.required_context`,
      message: 'Phase required_context must be an object',
      value: p.required_context,
    })
  } else {
    const ctx = p.required_context as Record<string, unknown>

    if (!Array.isArray(ctx.files)) {
      errors.push({
        field: `${prefix}.required_context.files`,
        message: 'required_context.files must be an array',
        value: ctx.files,
      })
    }

    if (!Array.isArray(ctx.concepts)) {
      errors.push({
        field: `${prefix}.required_context.concepts`,
        message: 'required_context.concepts must be an array',
        value: ctx.concepts,
      })
    }

    if (!Array.isArray(ctx.artifacts_from)) {
      errors.push({
        field: `${prefix}.required_context.artifacts_from`,
        message: 'required_context.artifacts_from must be an array',
        value: ctx.artifacts_from,
      })
    } else {
      for (let i = 0; i < ctx.artifacts_from.length; i++) {
        const refResult = validatePhaseId(ctx.artifacts_from[i])
        if (!refResult.valid) {
          errors.push({
            field: `${prefix}.required_context.artifacts_from[${i}]`,
            message: `Invalid artifacts_from reference: ${refResult.errors[0]?.message}`,
            value: ctx.artifacts_from[i],
          })
        }
      }
    }
  }

  // Validate success_criteria
  if (typeof p.success_criteria !== 'string' || p.success_criteria.trim().length === 0) {
    errors.push({
      field: `${prefix}.success_criteria`,
      message: 'Phase success_criteria must be a non-empty string',
      value: p.success_criteria,
    })
  }

  // Validate constraints (optional)
  if (p.constraints !== undefined) {
    if (!Array.isArray(p.constraints)) {
      errors.push({
        field: `${prefix}.constraints`,
        message: 'Phase constraints must be an array if provided',
        value: p.constraints,
      })
    } else {
      for (let i = 0; i < p.constraints.length; i++) {
        if (typeof p.constraints[i] !== 'string') {
          errors.push({
            field: `${prefix}.constraints[${i}]`,
            message: 'Constraint must be a string',
            value: p.constraints[i],
          })
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate an array of phases with cross-reference checks.
 */
export function validatePhases(phases: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (!Array.isArray(phases)) {
    errors.push({
      field: 'phases',
      message: 'Phases must be an array',
      value: phases,
    })
    return { valid: false, errors }
  }

  if (phases.length === 0) {
    errors.push({
      field: 'phases',
      message: 'At least one phase is required',
      value: phases,
    })
    return { valid: false, errors }
  }

  // Validate each phase individually
  const validPhaseIds = new Set<string>()
  const seenIds = new Map<string, number>()

  for (let i = 0; i < phases.length; i++) {
    const phaseResult = validatePhase(phases[i], i)
    errors.push(...phaseResult.errors)

    const phase = phases[i] as Record<string, unknown>
    if (typeof phase?.id === 'string' && validatePhaseId(phase.id).valid) {
      if (seenIds.has(phase.id)) {
        errors.push({
          field: `phases[${i}].id`,
          message: `Duplicate phase ID "${phase.id}" (first seen at index ${seenIds.get(phase.id)})`,
          value: phase.id,
        })
      } else {
        seenIds.set(phase.id, i)
        validPhaseIds.add(phase.id)
      }
    }
  }

  // Cross-reference validation
  if (validPhaseIds.size > 0) {
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i] as Record<string, unknown>
      if (!phase || typeof phase !== 'object') continue

      // Check dependency references
      if (Array.isArray(phase.dependencies)) {
        for (let j = 0; j < phase.dependencies.length; j++) {
          const depId = phase.dependencies[j]
          if (typeof depId === 'string' && validatePhaseId(depId).valid) {
            if (!validPhaseIds.has(depId)) {
              errors.push({
                field: `phases[${i}].dependencies[${j}]`,
                message: `Dependency "${depId}" references non-existent phase`,
                value: depId,
              })
            }
            if (depId === phase.id) {
              errors.push({
                field: `phases[${i}].dependencies[${j}]`,
                message: `Phase cannot depend on itself`,
                value: depId,
              })
            }
          }
        }
      }

      // Check artifacts_from references
      const ctx = phase.required_context as Record<string, unknown> | undefined
      if (ctx && Array.isArray(ctx.artifacts_from)) {
        for (let j = 0; j < ctx.artifacts_from.length; j++) {
          const refId = ctx.artifacts_from[j]
          if (typeof refId === 'string' && validatePhaseId(refId).valid) {
            if (!validPhaseIds.has(refId)) {
              errors.push({
                field: `phases[${i}].required_context.artifacts_from[${j}]`,
                message: `artifacts_from "${refId}" references non-existent phase`,
                value: refId,
              })
            }
          }
        }
      }
    }
  }

  // Circular dependency detection
  const graph = new Map<string, string[]>()
  for (const phase of phases as Record<string, unknown>[]) {
    if (typeof phase?.id === 'string' && Array.isArray(phase.dependencies)) {
      graph.set(
        phase.id,
        phase.dependencies.filter((d): d is string => typeof d === 'string')
      )
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()

  function detectCycle(id: string, path: string[]): void {
    if (visiting.has(id)) {
      errors.push({
        field: 'phases',
        message: `Circular dependency detected: ${[...path, id].join(' -> ')}`,
      })
      return
    }
    if (visited.has(id)) return

    visiting.add(id)
    for (const dep of graph.get(id) ?? []) {
      detectCycle(dep, [...path, id])
    }
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of graph.keys()) {
    detectCycle(id, [])
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Format validation errors for display.
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return 'Validation passed'
  }

  const lines = ['Validation errors:']
  for (const error of result.errors) {
    lines.push(`  - ${error.field}: ${error.message}`)
  }
  return lines.join('\n')
}

/**
 * Assert that phases are valid, throwing an error if not.
 */
export function assertValidPhases(phases: unknown): asserts phases is Phase[] {
  const result = validatePhases(phases)
  if (!result.valid) {
    throw new Error(formatValidationErrors(result))
  }
}
