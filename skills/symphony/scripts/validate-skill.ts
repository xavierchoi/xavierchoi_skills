#!/usr/bin/env bun
// Symphony Skill - SKILL.md Validator
// Validates SKILL.md frontmatter following the skill-creator pattern from Anthropic

import { existsSync, readFileSync } from 'fs'
import { resolve, dirname, join } from 'path'

/**
 * Validation result with detailed error information.
 */
interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

interface ValidationError {
  field: string
  message: string
  value?: unknown
}

/**
 * Parsed SKILL.md frontmatter structure.
 */
interface SkillFrontmatter {
  name?: unknown
  description?: unknown
  license?: unknown
  'allowed-tools'?: unknown
  metadata?: unknown
}

// Validation constants
const MAX_NAME_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 1024
const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

/**
 * Parse YAML frontmatter from a markdown file.
 * Simple parser that handles basic key-value pairs and multiline strings.
 */
function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; error?: string } {
  // Check for frontmatter delimiters
  if (!content.startsWith('---')) {
    return { frontmatter: {}, error: 'File does not start with YAML frontmatter delimiter (---)' }
  }

  const endDelimiterIndex = content.indexOf('\n---', 3)
  if (endDelimiterIndex === -1) {
    return { frontmatter: {}, error: 'Missing closing YAML frontmatter delimiter (---)' }
  }

  const frontmatterContent = content.slice(4, endDelimiterIndex).trim()
  const frontmatter: SkillFrontmatter = {}
  const lines = frontmatterContent.split('\n')

  let currentKey: string | null = null
  let currentValue = ''
  let inMultilineString = false
  let multilineIndent = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Handle multiline string continuation
    if (inMultilineString) {
      const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0

      if (lineIndent >= multilineIndent && line.trim() !== '') {
        currentValue += (currentValue ? '\n' : '') + line.slice(multilineIndent)
        continue
      } else if (line.trim() === '') {
        currentValue += '\n'
        continue
      } else {
        // End of multiline string
        if (currentKey) {
          ;(frontmatter as Record<string, unknown>)[currentKey] = currentValue.trim()
        }
        inMultilineString = false
        currentKey = null
        currentValue = ''
      }
    }

    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue
    }

    // Check for key-value pair
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) {
      continue
    }

    const key = line.slice(0, colonIndex).trim()
    const valueStart = line.slice(colonIndex + 1).trim()

    // Check for multiline string indicator (|)
    if (valueStart === '|' || valueStart === '|-' || valueStart === '|+') {
      currentKey = key
      currentValue = ''
      inMultilineString = true
      // Detect indentation from next non-empty line
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== '') {
          multilineIndent = lines[j].match(/^(\s*)/)?.[1].length ?? 2
          break
        }
      }
      continue
    }

    // Check for quoted strings
    if (valueStart.startsWith('"') && valueStart.endsWith('"')) {
      ;(frontmatter as Record<string, unknown>)[key] = valueStart.slice(1, -1)
    } else if (valueStart.startsWith("'") && valueStart.endsWith("'")) {
      ;(frontmatter as Record<string, unknown>)[key] = valueStart.slice(1, -1)
    } else if (valueStart === '' || valueStart === 'null' || valueStart === '~') {
      ;(frontmatter as Record<string, unknown>)[key] = null
    } else if (valueStart === 'true') {
      ;(frontmatter as Record<string, unknown>)[key] = true
    } else if (valueStart === 'false') {
      ;(frontmatter as Record<string, unknown>)[key] = false
    } else if (/^-?\d+(\.\d+)?$/.test(valueStart)) {
      ;(frontmatter as Record<string, unknown>)[key] = parseFloat(valueStart)
    } else if (valueStart.startsWith('[') && valueStart.endsWith(']')) {
      // Simple inline array parsing
      try {
        ;(frontmatter as Record<string, unknown>)[key] = JSON.parse(valueStart)
      } catch {
        ;(frontmatter as Record<string, unknown>)[key] = valueStart
      }
    } else if (valueStart.startsWith('{') && valueStart.endsWith('}')) {
      // Simple inline object parsing
      try {
        ;(frontmatter as Record<string, unknown>)[key] = JSON.parse(valueStart)
      } catch {
        ;(frontmatter as Record<string, unknown>)[key] = valueStart
      }
    } else {
      ;(frontmatter as Record<string, unknown>)[key] = valueStart
    }
  }

  // Handle final multiline string
  if (inMultilineString && currentKey) {
    ;(frontmatter as Record<string, unknown>)[currentKey] = currentValue.trim()
  }

  return { frontmatter }
}

/**
 * Validate the 'name' field.
 * - Must be hyphen-case (lowercase letters, numbers, hyphens only)
 * - Must start with a letter
 * - Maximum 64 characters
 */
function validateName(name: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (name === undefined || name === null) {
    errors.push({
      field: 'name',
      message: 'Required field "name" is missing',
    })
    return errors
  }

  if (typeof name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Field "name" must be a string',
      value: name,
    })
    return errors
  }

  if (name.length === 0) {
    errors.push({
      field: 'name',
      message: 'Field "name" cannot be empty',
      value: name,
    })
    return errors
  }

  if (name.length > MAX_NAME_LENGTH) {
    errors.push({
      field: 'name',
      message: `Field "name" exceeds maximum length of ${MAX_NAME_LENGTH} characters (got ${name.length})`,
      value: name,
    })
  }

  if (!NAME_PATTERN.test(name)) {
    errors.push({
      field: 'name',
      message:
        'Field "name" must be hyphen-case (lowercase letters, numbers, hyphens only). Must start with a letter.',
      value: name,
    })
  }

  return errors
}

/**
 * Validate the 'description' field.
 * - Maximum 1024 characters
 * - Must not contain '<' or '>' characters
 */
function validateDescription(description: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (description === undefined || description === null) {
    errors.push({
      field: 'description',
      message: 'Required field "description" is missing',
    })
    return errors
  }

  if (typeof description !== 'string') {
    errors.push({
      field: 'description',
      message: 'Field "description" must be a string',
      value: description,
    })
    return errors
  }

  if (description.length === 0) {
    errors.push({
      field: 'description',
      message: 'Field "description" cannot be empty',
      value: description,
    })
    return errors
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({
      field: 'description',
      message: `Field "description" exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters (got ${description.length})`,
      value: `${description.slice(0, 50)}...`,
    })
  }

  if (description.includes('<') || description.includes('>')) {
    errors.push({
      field: 'description',
      message: 'Field "description" must not contain "<" or ">" characters',
      value: description,
    })
  }

  return errors
}

/**
 * Validate a SKILL.md frontmatter object.
 */
function validateSkillFrontmatter(frontmatter: SkillFrontmatter): ValidationResult {
  const errors: ValidationError[] = []

  // Validate required fields
  errors.push(...validateName(frontmatter.name))
  errors.push(...validateDescription(frontmatter.description))

  // Optional fields: license, allowed-tools, metadata
  // These are optional and their values are not strictly validated
  // but we can add type checks if needed

  if (frontmatter.license !== undefined && frontmatter.license !== null) {
    if (typeof frontmatter.license !== 'string') {
      errors.push({
        field: 'license',
        message: 'Optional field "license" must be a string if provided',
        value: frontmatter.license,
      })
    }
  }

  if (frontmatter['allowed-tools'] !== undefined && frontmatter['allowed-tools'] !== null) {
    if (!Array.isArray(frontmatter['allowed-tools']) && typeof frontmatter['allowed-tools'] !== 'string') {
      errors.push({
        field: 'allowed-tools',
        message: 'Optional field "allowed-tools" must be a string or array if provided',
        value: frontmatter['allowed-tools'],
      })
    }
  }

  if (frontmatter.metadata !== undefined && frontmatter.metadata !== null) {
    if (typeof frontmatter.metadata !== 'object') {
      errors.push({
        field: 'metadata',
        message: 'Optional field "metadata" must be an object if provided',
        value: frontmatter.metadata,
      })
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Format validation errors for display.
 */
function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return 'Validation passed'
  }

  const lines = ['Validation errors:']
  for (const error of result.errors) {
    let errorLine = `  - ${error.field}: ${error.message}`
    if (error.value !== undefined) {
      const valueStr = typeof error.value === 'string' ? `"${error.value}"` : JSON.stringify(error.value)
      errorLine += ` (got: ${valueStr})`
    }
    lines.push(errorLine)
  }
  return lines.join('\n')
}

/**
 * Main validation function.
 */
function validateSkillFile(skillPath: string): { success: boolean; message: string } {
  const skillMdPath = join(skillPath, 'SKILL.md')

  // Check if SKILL.md exists
  if (!existsSync(skillMdPath)) {
    return {
      success: false,
      message: `Error: SKILL.md not found at ${skillMdPath}`,
    }
  }

  // Read file content
  let content: string
  try {
    content = readFileSync(skillMdPath, 'utf-8')
  } catch (err) {
    return {
      success: false,
      message: `Error reading SKILL.md: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Parse frontmatter
  const { frontmatter, error } = parseFrontmatter(content)
  if (error) {
    return {
      success: false,
      message: `Error parsing SKILL.md frontmatter: ${error}`,
    }
  }

  // Validate frontmatter
  const result = validateSkillFrontmatter(frontmatter)

  if (result.valid) {
    return {
      success: true,
      message: 'SKILL.md validation passed',
    }
  } else {
    return {
      success: false,
      message: formatValidationErrors(result),
    }
  }
}

// CLI entry point
function main(): void {
  const args = process.argv.slice(2)

  let skillPath: string

  if (args.length > 0) {
    // Use provided path
    skillPath = resolve(args[0])
  } else {
    // Default to parent directory (skill root from scripts/)
    skillPath = resolve(dirname(process.argv[1]), '..')
  }

  const result = validateSkillFile(skillPath)

  if (result.success) {
    console.log(`\u2713 ${result.message}`)
    process.exit(0)
  } else {
    console.error(result.message)
    process.exit(1)
  }
}

main()
