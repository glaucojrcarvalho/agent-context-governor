export type ContextArtifactKind =
  | 'file_read'
  | 'search_result'
  | 'shell_output'
  | 'diagnostic'
  | 'web_content'
  | 'transcript_snapshot'
  | 'other'

export type ContextCandidatePriority = 'critical' | 'high' | 'medium' | 'low'

export type ContextArtifact = {
  id: string
  kind: ContextArtifactKind
  source: string
  content: string
  summary?: string
  metadata?: Record<string, string | number | boolean>
}

export type ContextCandidate = {
  id: string
  kind: ContextArtifactKind
  priority: ContextCandidatePriority
  content: string
  tokenEstimate: number
  artifactId?: string
  metadata?: Record<string, string | number | boolean>
}

export type ContextBudget = {
  softLimitTokens: number
  hardLimitTokens: number
}

export type OptimizationDecision =
  | {
      type: 'keep'
      candidateId: string
      reason: string
    }
  | {
      type: 'replace'
      candidateId: string
      replacement: string
      reason: string
    }
  | {
      type: 'drop'
      candidateId: string
      reason: string
    }

export type GovernorInput = {
  candidates: ContextCandidate[]
  budget: ContextBudget
}

export type GovernorResult = {
  finalContext: string[]
  decisions: OptimizationDecision[]
  baselineTokens: number
  optimizedTokens: number
}

export type SavingsReport = {
  baselineTokens: number
  optimizedTokens: number
  savedTokens: number
  savingsRatio: number
}

export type BenchmarkScenario = {
  id: string
  title: string
  description: string
  budget: ContextBudget
  candidates: ContextCandidate[]
}

export type InputCandidate = Omit<ContextCandidate, 'tokenEstimate'> & {
  tokenEstimate?: number
}

export type InputScenario = {
  id?: string
  title?: string
  description?: string
  budget: ContextBudget
  candidates: InputCandidate[]
}

export type BenchmarkResult = {
  scenarioId: string
  scenarioTitle: string
  baselineTokens: number
  optimizedTokens: number
  savedTokens: number
  savingsRatio: number
  decisions: OptimizationDecision[]
  finalContext: string[]
}

export type ClaudeUsageResult = {
  inputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  outputTokens: number
  totalCostUsd?: number
  model?: string
  rawResult: string
}

export type ClaudeComparisonResult = {
  baseline: ClaudeUsageResult
  optimized: ClaudeUsageResult
  savedInputTokens: number
  savedCacheCreationTokens: number
  savedCacheReadTokens: number
  savedTotalTokens: number
}

export type ClaudePromptMode = 'benchmark' | 'review'
