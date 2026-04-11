import type {
  ContextCandidate,
  OptimizationDecision,
} from './types.js'
import type { GovernorConfig } from './config.js'

export type RuleContext = {
  softLimitTokens: number
  hardLimitTokens: number
  runningTokens: number
  config: GovernorConfig
  mode: 'default' | 'review'
  preservedImplementationCount: number
}

export type RuleAction =
  | {
      type: 'keep'
      tokenCost: number
      reason: string
    }
  | {
      type: 'replace'
      tokenCost: number
      replacement: string
      reason: string
    }
  | {
      type: 'drop'
      reason: string
    }

export function compareCandidates(
  left: ContextCandidate,
  right: ContextCandidate,
  config: GovernorConfig,
  mode: 'default' | 'review' = 'default',
): number {
  const priorityDelta =
    config.priority.scores[right.priority] - config.priority.scores[left.priority]
  if (priorityDelta !== 0) return priorityDelta

  if (mode === 'review') {
    const leftReviewPreferred = isReviewPreserveSource(left, config)
    const rightReviewPreferred = isReviewPreserveSource(right, config)
    if (leftReviewPreferred !== rightReviewPreferred) {
      return rightReviewPreferred ? 1 : -1
    }

    const leftImplementation = isImplementationSource(left, config)
    const rightImplementation = isImplementationSource(right, config)
    if (leftImplementation !== rightImplementation) {
      return rightImplementation ? 1 : -1
    }
  }

  const leftProtected = isProtectedSource(left, config)
  const rightProtected = isProtectedSource(right, config)
  if (leftProtected !== rightProtected) {
    return rightProtected ? 1 : -1
  }

  return left.tokenEstimate - right.tokenEstimate
}

function getSource(candidate: ContextCandidate): string {
  return typeof candidate.metadata?.source === 'string'
    ? candidate.metadata.source
    : candidate.id
}

export function isProtectedSource(
  candidate: ContextCandidate,
  config: GovernorConfig,
): boolean {
  const source = getSource(candidate)
  return (config.protectedSources ?? []).some(pattern =>
    source.includes(pattern),
  )
}

export function isReviewPreserveSource(
  candidate: ContextCandidate,
  config: GovernorConfig,
): boolean {
  const source = getSource(candidate)
  return (config.review?.preserveSourcePatterns ?? []).some(pattern =>
    source.includes(pattern),
  )
}

export function isImplementationSource(
  candidate: ContextCandidate,
  config: GovernorConfig,
): boolean {
  const source = getSource(candidate)
  return (config.review?.implementationSourcePatterns ?? []).some(pattern =>
    source.includes(pattern),
  )
}

export function getReplacementTokenCost(
  candidate: ContextCandidate,
  config: GovernorConfig,
): number {
  return config.replacement.tokenCosts[candidate.kind] ?? 24
}

export function buildReplacement(candidate: ContextCandidate): string {
  const source =
    typeof candidate.metadata?.source === 'string'
      ? candidate.metadata.source
      : candidate.id

  switch (candidate.kind) {
    case 'file_read':
      return `[file_read] ${source} was read earlier. Keep only exported symbols, key functions, and the active section.`
    case 'search_result':
      return `[search_result] ${source} produced prior matches. Keep only matched files and the most relevant hit clusters.`
    case 'shell_output':
      return `[shell_output] ${source} generated a log earlier. Keep only failing command, exit status, and top actionable lines.`
    case 'diagnostic':
      return `[diagnostic] ${source} had prior diagnostics. Keep only unresolved errors and affected files.`
    case 'web_content':
      return `[web_content] ${source} was fetched earlier. Keep only the summary and any quoted constraints already extracted.`
    case 'transcript_snapshot':
      return `[transcript_snapshot] ${source} was summarized earlier. Keep only the current task state and unresolved decisions.`
    default:
      return `[${candidate.kind}] compact reference for ${source}`
  }
}

export function shouldReplace(
  candidate: ContextCandidate,
  config: GovernorConfig,
): boolean {
  if (candidate.priority === 'critical' || candidate.priority === 'high') {
    return false
  }

  return config.replacement.enabledKinds.includes(candidate.kind)
}

export function evaluateCandidate(
  candidate: ContextCandidate,
  context: RuleContext,
): RuleAction {
  if (candidate.priority === 'critical') {
    const nextTotal = context.runningTokens + candidate.tokenEstimate
    if (nextTotal <= context.hardLimitTokens) {
      return {
        type: 'keep',
        tokenCost: candidate.tokenEstimate,
        reason: 'critical task context',
      }
    }
  }

  if (context.mode === 'review' && isReviewPreserveSource(candidate, context.config)) {
    const nextTotal = context.runningTokens + candidate.tokenEstimate
    if (nextTotal <= context.hardLimitTokens) {
      return {
        type: 'keep',
        tokenCost: candidate.tokenEstimate,
        reason: 'review-preserved source',
      }
    }
  }

  if (
    context.mode === 'review' &&
    isImplementationSource(candidate, context.config) &&
    context.preservedImplementationCount <
      (context.config.review?.minimumImplementationCandidates ?? 0)
  ) {
    const nextTotal = context.runningTokens + candidate.tokenEstimate
    if (nextTotal <= context.hardLimitTokens) {
      return {
        type: 'keep',
        tokenCost: candidate.tokenEstimate,
        reason: 'review implementation floor',
      }
    }
  }

  if (isProtectedSource(candidate, context.config)) {
    const nextTotal = context.runningTokens + candidate.tokenEstimate
    if (nextTotal <= context.hardLimitTokens) {
      return {
        type: 'keep',
        tokenCost: candidate.tokenEstimate,
        reason: 'protected review-critical context',
      }
    }
  }

  const nextTotal = context.runningTokens + candidate.tokenEstimate

  if (nextTotal <= context.softLimitTokens) {
    return {
      type: 'keep',
      tokenCost: candidate.tokenEstimate,
      reason: 'within soft budget',
    }
  }

  if (shouldReplace(candidate, context.config)) {
    const replacement = buildReplacement(candidate)
    const replacementCost = getReplacementTokenCost(candidate, context.config)
    const replacementTotal = context.runningTokens + replacementCost

    if (replacementTotal <= context.hardLimitTokens) {
      return {
        type: 'replace',
        tokenCost: replacementCost,
        replacement,
        reason:
          candidate.priority === 'critical' || candidate.priority === 'high'
            ? 'preserve important context in compact form'
            : 'compressed bulky context to stay within budget',
      }
    }
  }

  return {
    type: 'drop',
    reason: 'exceeds budget and has low replacement priority',
  }
}

export function toDecision(
  candidateId: string,
  action: RuleAction,
): OptimizationDecision {
  if (action.type === 'keep') {
    return {
      type: 'keep',
      candidateId,
      reason: action.reason,
    }
  }

  if (action.type === 'replace') {
    return {
      type: 'replace',
      candidateId,
      replacement: action.replacement,
      reason: action.reason,
    }
  }

  return {
    type: 'drop',
    candidateId,
    reason: action.reason,
  }
}
