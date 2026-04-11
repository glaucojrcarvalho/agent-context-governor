import { readFileSync } from 'node:fs'

import type {
  BenchmarkScenario,
  ContextArtifactKind,
  ContextCandidatePriority,
  InputCandidate,
  InputScenario,
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

export function estimateTokens(text: string): number {
  const normalized = text.trim()
  if (normalized.length === 0) return 0
  return Math.ceil(normalized.length / 4)
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
      : estimateTokens(content)

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

export function parseScenarioFile(filePath: string): BenchmarkScenario {
  const raw = readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw) as InputScenario
  const data = assertObject(parsed, 'root')
  const budget = assertObject(data.budget, 'budget')

  const softLimitTokens = budget.softLimitTokens
  const hardLimitTokens = budget.hardLimitTokens

  if (
    typeof softLimitTokens !== 'number' ||
    typeof hardLimitTokens !== 'number' ||
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
    budget: {
      softLimitTokens,
      hardLimitTokens,
    },
    candidates: data.candidates.map(normalizeCandidate),
  }
}
