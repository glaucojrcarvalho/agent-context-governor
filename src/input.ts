import { readFileSync } from 'node:fs'

import type {
  BenchmarkScenario,
  ContextArtifactKind,
  ContextBudget,
  ContextCandidatePriority,
  GovernorInput,
  InputCandidate,
  InputScenario,
  TokenEstimatorFn,
} from './types.js'

const VALID_KINDS: ContextArtifactKind[] = [
  'file_read',
  'search_result',
  'shell_output',
  'diagnostic',
  'web_content',
  'transcript_snapshot',
  'other',
]

const VALID_PRIORITIES: ContextCandidatePriority[] = [
  'critical',
  'high',
  'medium',
  'low',
]

// Estimates token count without external dependencies.
//
// Uses the higher of two signals:
//   - chars / 4: accurate for long words and tightly packed text
//   - words + symbols: accurate for code, where operators and punctuation
//     each become their own BPE token regardless of character length
//
// This outperforms the naive chars/4 heuristic for code-heavy content
// (shell output, file reads, search results) which is the primary use case.
// For exact counts, pass a custom TokenEstimatorFn wrapping tiktoken or
// Claude's count_tokens API endpoint.
export function estimateTokens(text: string): number {
  const normalized = text.trim()
  if (normalized.length === 0) return 0

  const words = normalized.split(/\s+/).length
  const symbols = (normalized.match(/[{}()[\];:.<>!@#$%^&*|/\\=+\-`~,]/g) ?? []).length

  return Math.ceil(Math.max(normalized.length / 4, words + symbols))
}

function normalizeBudget(budget: unknown): ContextBudget {
  const data = assertObject(budget, 'budget')
  const softLimitTokens = data.softLimitTokens
  const hardLimitTokens = data.hardLimitTokens

  if (
    typeof softLimitTokens !== 'number' ||
    typeof hardLimitTokens !== 'number' ||
    !Number.isFinite(softLimitTokens) ||
    !Number.isFinite(hardLimitTokens) ||
    softLimitTokens <= 0 ||
    hardLimitTokens <= 0
  ) {
    throw new Error(
      'Invalid "budget": expected positive numeric softLimitTokens and hardLimitTokens',
    )
  }

  if (hardLimitTokens < softLimitTokens) {
    throw new Error(
      'Invalid "budget": hardLimitTokens must be greater than or equal to softLimitTokens',
    )
  }

  return {
    softLimitTokens,
    hardLimitTokens,
  }
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid "${field}": expected non-empty string`)
  }
  return value
}

function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid "${field}": expected object`)
  }
  return value as Record<string, unknown>
}

function normalizeCandidate(
  candidate: unknown,
  index: number,
  estimator: TokenEstimatorFn = estimateTokens,
): BenchmarkScenario['candidates'][number] {
  const data = assertObject(candidate, `candidates[${index}]`)
  const id = assertString(data.id, `candidates[${index}].id`)
  const kind = assertString(data.kind, `candidates[${index}].kind`)
  const priority = assertString(
    data.priority,
    `candidates[${index}].priority`,
  )
  const content = assertString(data.content, `candidates[${index}].content`)

  if (!VALID_KINDS.includes(kind as ContextArtifactKind)) {
    throw new Error(`Invalid "${id}.kind": expected one of ${VALID_KINDS.join(', ')}`)
  }

  if (!VALID_PRIORITIES.includes(priority as ContextCandidatePriority)) {
    throw new Error(
      `Invalid "${id}.priority": expected one of ${VALID_PRIORITIES.join(', ')}`,
    )
  }

  const inputCandidate = data as unknown as InputCandidate
  const tokenEstimate =
    typeof inputCandidate.tokenEstimate === 'number'
      ? inputCandidate.tokenEstimate
      : estimator(content)

  if (!Number.isFinite(tokenEstimate) || tokenEstimate < 0) {
    throw new Error(`Invalid "${id}.tokenEstimate": expected non-negative finite number`)
  }

  return {
    id,
    kind: kind as ContextArtifactKind,
    priority: priority as ContextCandidatePriority,
    content,
    tokenEstimate,
    artifactId:
      typeof inputCandidate.artifactId === 'string'
        ? inputCandidate.artifactId
        : undefined,
    metadata:
      typeof inputCandidate.metadata === 'object' &&
      inputCandidate.metadata !== null &&
      !Array.isArray(inputCandidate.metadata)
        ? inputCandidate.metadata
        : undefined,
  }
}

export function validateGovernorInput(input: GovernorInput): GovernorInput {
  const budget = normalizeBudget(input.budget)

  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    throw new Error('Invalid "candidates": expected a non-empty array')
  }

  const ids = new Set<string>()
  const candidates = input.candidates.map((candidate, index) => {
    const normalized = normalizeCandidate(candidate, index)

    if (ids.has(normalized.id)) {
      throw new Error(`Invalid "candidates": duplicate id "${normalized.id}"`)
    }
    ids.add(normalized.id)

    return normalized
  })

  return {
    ...input,
    budget,
    candidates,
  }
}

export function parseScenarioFile(
  filePath: string,
  estimator: TokenEstimatorFn = estimateTokens,
): BenchmarkScenario {
  const raw = readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw) as InputScenario
  const data = assertObject(parsed, 'root')
  const budget = normalizeBudget(data.budget)

  if (!Array.isArray(data.candidates) || data.candidates.length === 0) {
    throw new Error('Invalid "candidates": expected a non-empty array')
  }

  return {
    id:
      typeof data.id === 'string' && data.id.trim() !== ''
        ? data.id
        : 'custom-scenario',
    title:
      typeof data.title === 'string' && data.title.trim() !== ''
        ? data.title
        : 'Custom Scenario',
    description:
      typeof data.description === 'string' ? data.description : '',
    budget,
    candidates: data.candidates.map((c, i) => normalizeCandidate(c, i, estimator)),
    mode: data.mode === 'review' ? 'review' : 'default',
  }
}
