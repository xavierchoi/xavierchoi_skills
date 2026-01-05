// Symphony Skill - DAG Scheduler
// Manages phase dependencies and execution order using Kahn's algorithm

import type { Phase, PhaseStatus, ScheduledPhase, Artifact } from './types.ts'

/**
 * Error thrown when a cycle is detected in the dependency graph.
 */
export class CycleDetectedError extends Error {
  public readonly cyclePath: string[]

  constructor(cyclePath: string[]) {
    const pathStr = cyclePath.join(' -> ')
    super(`Circular dependency detected: ${pathStr}`)
    this.name = 'CycleDetectedError'
    this.cyclePath = cyclePath
  }
}

/**
 * Error thrown when a phase is not found in the graph.
 */
export class PhaseNotFoundError extends Error {
  public readonly phaseId: string

  constructor(phaseId: string) {
    super(`Phase not found: ${phaseId}`)
    this.name = 'PhaseNotFoundError'
    this.phaseId = phaseId
  }
}

/**
 * Error thrown when a dependency references a non-existent phase.
 */
export class InvalidDependencyError extends Error {
  public readonly phaseId: string
  public readonly dependencyId: string

  constructor(phaseId: string, dependencyId: string) {
    super(`Phase "${phaseId}" depends on non-existent phase "${dependencyId}"`)
    this.name = 'InvalidDependencyError'
    this.phaseId = phaseId
    this.dependencyId = dependencyId
  }
}

/**
 * Represents a group of phases that can execute in parallel.
 */
export interface ParallelGroup {
  phases: string[]
  level: number
}

/**
 * Result of cycle detection.
 */
export interface CycleDetectionResult {
  hasCycle: boolean
  cyclePath?: string[]
}

/**
 * DependencyGraph - Manages phase dependencies and execution order.
 * Uses Kahn's algorithm for topological sorting and cycle detection.
 */
export class DependencyGraph {
  private phases: Map<string, ScheduledPhase> = new Map()
  private dependents: Map<string, Set<string>> = new Map()
  private dependencies: Map<string, Set<string>> = new Map()

  constructor(phases?: Phase[]) {
    if (phases) {
      this.addPhases(phases)
    }
  }

  addPhase(phase: Phase): void {
    const scheduledPhase: ScheduledPhase = {
      ...phase,
      status: 'pending',
      artifacts: [],
    }

    this.phases.set(phase.id, scheduledPhase)
    this.dependents.set(phase.id, new Set())
    const implicitDeps = phase.required_context?.artifacts_from ?? []
    const mergedDeps = [...new Set([...phase.dependencies, ...implicitDeps])]
    this.dependencies.set(phase.id, new Set(mergedDeps))

    for (const depId of phase.dependencies) {
      if (!this.dependents.has(depId)) {
        this.dependents.set(depId, new Set())
      }
      this.dependents.get(depId)!.add(phase.id)
    }
  }

  addPhases(phases: Phase[]): void {
    for (const phase of phases) {
      this.addPhase(phase)
    }
  }

  getPhase(phaseId: string): ScheduledPhase | undefined {
    return this.phases.get(phaseId)
  }

  getAllPhases(): ScheduledPhase[] {
    return Array.from(this.phases.values())
  }

  get size(): number {
    return this.phases.size
  }

  validateDependencies(): void {
    for (const [phaseId, phase] of this.phases) {
      for (const depId of phase.dependencies) {
        if (!this.phases.has(depId)) {
          throw new InvalidDependencyError(phaseId, depId)
        }
      }
    }
  }

  detectCycle(): CycleDetectionResult {
    try {
      this.validateDependencies()
    } catch (e) {
      if (e instanceof InvalidDependencyError) {
        return { hasCycle: false }
      }
      throw e
    }

    const inDegree = new Map<string, number>()
    for (const phaseId of this.phases.keys()) {
      inDegree.set(phaseId, this.dependencies.get(phaseId)?.size ?? 0)
    }

    const queue: string[] = []
    for (const [phaseId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(phaseId)
      }
    }

    const processed = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!
      processed.add(current)

      const deps = this.dependents.get(current) ?? new Set()
      for (const dependent of deps) {
        const newDegree = inDegree.get(dependent)! - 1
        inDegree.set(dependent, newDegree)
        if (newDegree === 0) {
          queue.push(dependent)
        }
      }
    }

    if (processed.size !== this.phases.size) {
      const cyclePath = this.findCyclePath(processed)
      return { hasCycle: true, cyclePath }
    }

    return { hasCycle: false }
  }

  private findCyclePath(processed: Set<string>): string[] {
    const inCycle = new Set<string>()
    for (const phaseId of this.phases.keys()) {
      if (!processed.has(phaseId)) {
        inCycle.add(phaseId)
      }
    }

    if (inCycle.size === 0) {
      return []
    }

    const visited = new Set<string>()
    const path: string[] = []

    const dfs = (node: string): string[] | null => {
      if (path.includes(node)) {
        const cycleStart = path.indexOf(node)
        return [...path.slice(cycleStart), node]
      }

      if (visited.has(node)) {
        return null
      }

      visited.add(node)
      path.push(node)

      const deps = this.dependencies.get(node) ?? new Set()
      for (const dep of deps) {
        if (inCycle.has(dep)) {
          const result = dfs(dep)
          if (result) {
            return result
          }
        }
      }

      path.pop()
      return null
    }

    for (const node of inCycle) {
      const result = dfs(node)
      if (result) {
        return result
      }
    }

    return Array.from(inCycle)
  }

  assertNoCycles(): void {
    const result = this.detectCycle()
    if (result.hasCycle) {
      throw new CycleDetectedError(result.cyclePath ?? [])
    }
  }

  /**
   * Get all phases that are ready to execute.
   * A phase is ready when it has status 'pending' or 'ready'
   * and all its dependencies have status 'complete'.
   */
  getReady(): string[] {
    const ready: string[] = []

    for (const [phaseId, phase] of this.phases) {
      if (phase.status !== 'pending' && phase.status !== 'ready') {
        continue
      }

      const deps = this.dependencies.get(phaseId) ?? new Set()
      let allDepsComplete = true

      for (const depId of deps) {
        const dep = this.phases.get(depId)
        if (!dep || dep.status !== 'complete') {
          allDepsComplete = false
          break
        }
      }

      if (allDepsComplete) {
        ready.push(phaseId)
      }
    }

    return ready
  }

  getPhasesByStatus(status: PhaseStatus): ScheduledPhase[] {
    return Array.from(this.phases.values()).filter((p) => p.status === status)
  }

  isComplete(): boolean {
    for (const phase of this.phases.values()) {
      if (phase.status !== 'complete') {
        return false
      }
    }
    return this.phases.size > 0
  }

  hasFailed(): boolean {
    for (const phase of this.phases.values()) {
      if (phase.status === 'failed') {
        return true
      }
    }
    return false
  }

  isFinished(): boolean {
    for (const phase of this.phases.values()) {
      if (
        phase.status === 'pending' ||
        phase.status === 'ready' ||
        phase.status === 'running'
      ) {
        return false
      }
    }
    return true
  }

  markRunning(phaseId: string, workerId?: string): void {
    const phase = this.phases.get(phaseId)
    if (!phase) {
      throw new PhaseNotFoundError(phaseId)
    }

    phase.status = 'running'
    phase.startedAt = new Date().toISOString()
    if (workerId) {
      phase.workerId = workerId
    }
  }

  markComplete(phaseId: string, artifacts: Artifact[] = []): void {
    const phase = this.phases.get(phaseId)
    if (!phase) {
      throw new PhaseNotFoundError(phaseId)
    }

    phase.status = 'complete'
    phase.completedAt = new Date().toISOString()
    phase.artifacts = artifacts

    const dependents = this.dependents.get(phaseId) ?? new Set()
    for (const depId of dependents) {
      const dependent = this.phases.get(depId)
      if (!dependent || dependent.status !== 'pending') {
        continue
      }

      const deps = this.dependencies.get(depId) ?? new Set()
      let allComplete = true
      for (const depPhaseId of deps) {
        const depPhase = this.phases.get(depPhaseId)
        if (!depPhase || depPhase.status !== 'complete') {
          allComplete = false
          break
        }
      }

      if (allComplete) {
        dependent.status = 'ready'
      }
    }
  }

  markFailed(phaseId: string, error: string): void {
    const phase = this.phases.get(phaseId)
    if (!phase) {
      throw new PhaseNotFoundError(phaseId)
    }

    phase.status = 'failed'
    phase.completedAt = new Date().toISOString()
    phase.error = error

    this.blockDependents(phaseId)
  }

  markAborted(phaseId: string): void {
    const phase = this.phases.get(phaseId)
    if (!phase) {
      throw new PhaseNotFoundError(phaseId)
    }

    phase.status = 'aborted'
    phase.completedAt = new Date().toISOString()

    this.blockDependents(phaseId)
  }

  private blockDependents(phaseId: string): void {
    const dependents = this.dependents.get(phaseId) ?? new Set()
    for (const depId of dependents) {
      const dependent = this.phases.get(depId)
      if (
        dependent &&
        (dependent.status === 'pending' || dependent.status === 'ready')
      ) {
        dependent.status = 'blocked'
        this.blockDependents(depId)
      }
    }
  }

  getExecutionOrder(): ParallelGroup[] {
    this.assertNoCycles()
    this.validateDependencies()

    const levels = new Map<string, number>()
    const queue: string[] = []

    for (const [phaseId] of this.phases) {
      const deps = this.dependencies.get(phaseId) ?? new Set()
      if (deps.size === 0) {
        levels.set(phaseId, 0)
        queue.push(phaseId)
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!

      const dependents = this.dependents.get(current) ?? new Set()
      for (const dependent of dependents) {
        const depPhase = this.dependencies.get(dependent) ?? new Set()
        let maxDepLevel = -1
        let allDepsHaveLevel = true

        for (const dep of depPhase) {
          const depLevel = levels.get(dep)
          if (depLevel === undefined) {
            allDepsHaveLevel = false
            break
          }
          maxDepLevel = Math.max(maxDepLevel, depLevel)
        }

        if (allDepsHaveLevel && !levels.has(dependent)) {
          levels.set(dependent, maxDepLevel + 1)
          queue.push(dependent)
        }
      }
    }

    const groups = new Map<number, string[]>()
    let maxLevel = 0

    for (const [phaseId, level] of levels) {
      if (!groups.has(level)) {
        groups.set(level, [])
      }
      groups.get(level)!.push(phaseId)
      maxLevel = Math.max(maxLevel, level)
    }

    const result: ParallelGroup[] = []
    for (let level = 0; level <= maxLevel; level++) {
      const phases = groups.get(level) ?? []
      if (phases.length > 0) {
        result.push({ phases: phases.sort(), level })
      }
    }

    return result
  }

  getTopologicalOrder(): string[] {
    const groups = this.getExecutionOrder()
    const result: string[] = []
    for (const group of groups) {
      result.push(...group.phases)
    }
    return result
  }

  /**
   * Get all artifacts that a phase should receive from its dependencies.
   */
  getArtifactsForPhase(phaseId: string): Artifact[] {
    const phase = this.phases.get(phaseId)
    if (!phase) {
      throw new PhaseNotFoundError(phaseId)
    }

    const artifacts: Artifact[] = []
    const seenPaths = new Set<string>()

    for (const sourcePhaseId of phase.required_context.artifacts_from) {
      const sourcePhase = this.phases.get(sourcePhaseId)
      if (!sourcePhase || sourcePhase.status !== 'complete') {
        continue
      }

      for (const artifact of sourcePhase.artifacts) {
        if (artifact.path && seenPaths.has(artifact.path)) {
          continue
        }
        if (artifact.path) {
          seenPaths.add(artifact.path)
        }

        artifacts.push({
          ...artifact,
          metadata: {
            ...artifact.metadata,
            sourcePhase: sourcePhaseId,
          },
        })
      }
    }

    return artifacts
  }

  getStatusCounts(): Record<PhaseStatus, number> {
    const counts: Record<PhaseStatus, number> = {
      pending: 0,
      ready: 0,
      running: 0,
      complete: 0,
      failed: 0,
      aborted: 0,
      blocked: 0,
    }

    for (const phase of this.phases.values()) {
      counts[phase.status]++
    }

    return counts
  }

  reset(): void {
    for (const phase of this.phases.values()) {
      phase.status = 'pending'
      phase.startedAt = undefined
      phase.completedAt = undefined
      phase.error = undefined
      phase.artifacts = []
      phase.workerId = undefined
    }
  }

  toString(): string {
    const lines: string[] = ['DependencyGraph:']
    const counts = this.getStatusCounts()

    lines.push(
      `  Phases: ${this.size} (${counts.complete} complete, ${counts.running} running, ${counts.pending} pending)`
    )

    for (const phase of this.phases.values()) {
      const deps =
        phase.dependencies.length > 0
          ? ` <- [${phase.dependencies.join(', ')}]`
          : ''
      lines.push(`  - ${phase.id} (${phase.status})${deps}`)
    }

    return lines.join('\n')
  }
}
