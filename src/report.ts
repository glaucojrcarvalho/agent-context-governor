import { writeFileSync } from 'node:fs'

import { runClaudeReviewComparison } from './claude.js'
import { parseScenarioFile } from './input.js'

// Minimum Jaccard similarity to classify two differently-worded findings as equivalent
const SIMILARITY_THRESHOLD = 0.25

// ---
// Extraction
// ---

// Captures bullet points, numbered lists, and substantial non-heading paragraphs.
// Claude review outputs often mix formats, so limiting to "- " alone misses too much.
export function extractFindings(text: string): string[] {
  const findings: string[] = []

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) continue

    const bulletMatch = /^[-*•]\s+(.+)/.exec(line)
    if (bulletMatch) {
      findings.push(bulletMatch[1].trim())
      continue
    }

    const numberedMatch = /^\d+[.)]\s+(.+)/.exec(line)
    if (numberedMatch) {
      findings.push(numberedMatch[1].trim())
      continue
    }

    // Substantial paragraph: long enough to be a real finding, not a section label
    if (line.length > 40 && !line.endsWith(':')) {
      findings.push(line)
    }
  }

  return findings
}

// ---
// Normalisation & similarity
// ---

function normalizeFinding(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_:#()[\].,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Jaccard similarity over words longer than 2 characters (skip stop-word noise)
export function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string): Set<string> =>
    new Set(normalizeFinding(s).split(' ').filter(w => w.length > 2))

  const wa = words(a)
  const wb = words(b)
  if (wa.size === 0 || wb.size === 0) return 0

  const intersection = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return intersection / union
}

// ---
// Topic inference
// ---

const FINDING_TOPICS: Record<string, string[]> = {
  token_estimation: ['estimateTokens', 'token estimation', 'tokenizer', 'hardcoded / 4'],
  claude_api_surface: ['claude.ts', 'public api', 'public index', 'spawnsync', 'claude binary'],
  permissions: ['bypasspermissions', 'permission-mode', 'permission system'],
  prioritization: ['priority', 'comparecandidates', 'ranking'],
  architecture_gap: ['architecture', 'contextartifactstore', 'surrogatebuilder', 'implementation gap'],
  parsing_validation: ['json.parse', 'validation', 'schema', 'malformed', 'external output'],
  testing: ['test', 'stale dist', 'pre-test build'],
  linting: ['eslint', 'typescript-eslint', 'lint'],
  ci_runtime: ['ci', 'github actions', 'node 20', 'engines'],
  config_validation: ['mergegovernorconfig', 'nan', 'hardlimittokens', 'softlimittokens'],
}

function inferTopics(text: string): string[] {
  const normalized = normalizeFinding(text)

  return Object.entries(FINDING_TOPICS)
    .filter(([, patterns]) =>
      patterns.some(pattern => normalized.includes(normalizeFinding(pattern))),
    )
    .map(([topic]) => topic)
}

// ---
// Overlap computation
// ---

type ProbableMatch = {
  baseline: string
  optimized: string
  score: number
}

type TopicCoverage = {
  shared: string[]
  baselineOnly: string[]
  optimizedOnly: string[]
}

type OverlapResult = {
  exact: string[]
  probable: ProbableMatch[]
  baselineOnly: string[]
  optimizedOnly: string[]
  topicCoverage: TopicCoverage
  // % of baseline topics that were also covered by the optimized run (0–100)
  qualityScore: number
}

export function computeOverlap(
  baselineFindings: string[],
  optimizedFindings: string[],
): OverlapResult {
  const baselineNorm = baselineFindings.map(normalizeFinding)
  const optimizedNorm = optimizedFindings.map(normalizeFinding)

  const matchedBaselineIdx = new Set<number>()
  const matchedOptimizedIdx = new Set<number>()
  const exact: string[] = []
  const probable: ProbableMatch[] = []

  // First pass: exact normalized matches
  for (let i = 0; i < baselineFindings.length; i++) {
    const j = optimizedNorm.indexOf(baselineNorm[i])
    if (j !== -1 && !matchedOptimizedIdx.has(j)) {
      exact.push(baselineFindings[i])
      matchedBaselineIdx.add(i)
      matchedOptimizedIdx.add(j)
    }
  }

  // Second pass: similarity matching for unmatched findings
  for (let i = 0; i < baselineFindings.length; i++) {
    if (matchedBaselineIdx.has(i)) continue

    let bestIdx = -1
    let bestScore = 0

    for (let j = 0; j < optimizedFindings.length; j++) {
      if (matchedOptimizedIdx.has(j)) continue
      const score = jaccardSimilarity(baselineFindings[i], optimizedFindings[j])
      if (score > bestScore) {
        bestScore = score
        bestIdx = j
      }
    }

    if (bestScore >= SIMILARITY_THRESHOLD && bestIdx !== -1) {
      probable.push({
        baseline: baselineFindings[i],
        optimized: optimizedFindings[bestIdx],
        score: bestScore,
      })
      matchedBaselineIdx.add(i)
      matchedOptimizedIdx.add(bestIdx)
    }
  }

  const baselineOnly = baselineFindings.filter((_, i) => !matchedBaselineIdx.has(i))
  const optimizedOnly = optimizedFindings.filter((_, i) => !matchedOptimizedIdx.has(i))

  // Topic-level coverage
  const baselineTopics = new Set(baselineFindings.flatMap(inferTopics))
  const optimizedTopics = new Set(optimizedFindings.flatMap(inferTopics))
  const sharedTopics = [...baselineTopics].filter(t => optimizedTopics.has(t))
  const baselineOnlyTopics = [...baselineTopics].filter(t => !optimizedTopics.has(t))
  const optimizedOnlyTopics = [...optimizedTopics].filter(t => !baselineTopics.has(t))

  const qualityScore =
    baselineTopics.size === 0
      ? 100
      : Math.round((sharedTopics.length / baselineTopics.size) * 100)

  return {
    exact,
    probable,
    baselineOnly,
    optimizedOnly,
    topicCoverage: {
      shared: sharedTopics,
      baselineOnly: baselineOnlyTopics,
      optimizedOnly: optimizedOnlyTopics,
    },
    qualityScore,
  }
}

// ---
// Report rendering
// ---

function formatUsd(value: number | undefined): string {
  return typeof value === 'number' ? value.toFixed(6) : 'unknown'
}

function formatScore(score: number): string {
  if (score >= 80) return `${score}% (good)`
  if (score >= 50) return `${score}% (partial)`
  return `${score}% (low)`
}

function renderProbableMatches(matches: ProbableMatch[]): string[] {
  if (matches.length === 0) return ['- None']
  return matches.flatMap(m => [
    `- **Baseline:** ${m.baseline}`,
    `  **Optimized:** ${m.optimized}`,
    `  *(similarity ${(m.score * 100).toFixed(0)}%)*`,
    '',
  ])
}

export function writeClaudeReviewReport(
  scenarioPath: string,
  outFile: string,
): string {
  const scenario = parseScenarioFile(scenarioPath)
  const result = runClaudeReviewComparison(scenario)

  const baselineFindings = extractFindings(result.baseline.rawResult)
  const optimizedFindings = extractFindings(result.optimized.rawResult)
  const overlap = computeOverlap(baselineFindings, optimizedFindings)

  const totalMatched = overlap.exact.length + overlap.probable.length
  const totalBaseline = baselineFindings.length

  const markdown = [
    `# Claude Review Report`,
    ``,
    `Scenario: ${scenario.title}`,
    ``,
    `## Quality Score`,
    ``,
    `**Topic recall: ${formatScore(overlap.qualityScore)}**`,
    `(${overlap.topicCoverage.shared.length} of ${overlap.topicCoverage.shared.length + overlap.topicCoverage.baselineOnly.length} baseline topics also found in optimized run)`,
    ``,
    `Findings matched: ${totalMatched} of ${totalBaseline} baseline findings (${overlap.exact.length} exact, ${overlap.probable.length} probable)`,
    ``,
    `## Usage`,
    ``,
    `- Saved prompt input tokens: ${result.savedInputTokens}`,
    `- Saved output tokens: ${result.savedOutputTokens}`,
    `- Saved non-cache tokens: ${result.savedNonCacheTokens}`,
    `- Saved cache creation tokens: ${result.savedCacheCreationTokens}`,
    `- Saved cache read tokens: ${result.savedCacheReadTokens}`,
    `- Observed total token delta: ${result.savedTotalTokens}`,
    `- Baseline observed total tokens: ${result.baselineObservedTotalTokens}`,
    `- Optimized observed total tokens: ${result.optimizedObservedTotalTokens}`,
    `- Cost delta USD: ${formatUsd(result.costDeltaUsd)}`,
    `- Baseline cost USD: ${formatUsd(result.baseline.totalCostUsd)}`,
    `- Optimized cost USD: ${formatUsd(result.optimized.totalCostUsd)}`,
    ``,
    `Note: observed total token delta includes Claude cache effects and is less stable across runs than prompt-input and cost deltas.`,
    ``,
    `## Topic Coverage`,
    ``,
    `**Shared topics (${overlap.topicCoverage.shared.length}):** ${overlap.topicCoverage.shared.length > 0 ? overlap.topicCoverage.shared.join(', ') : 'none'}`,
    `**Baseline-only topics (${overlap.topicCoverage.baselineOnly.length}):** ${overlap.topicCoverage.baselineOnly.length > 0 ? overlap.topicCoverage.baselineOnly.join(', ') : 'none'}`,
    `**Optimized-only topics (${overlap.topicCoverage.optimizedOnly.length}):** ${overlap.topicCoverage.optimizedOnly.length > 0 ? overlap.topicCoverage.optimizedOnly.join(', ') : 'none'}`,
    ``,
    `## Probable Matches`,
    ``,
    `Findings that address the same concern with different wording (similarity ≥ ${Math.round(SIMILARITY_THRESHOLD * 100)}%):`,
    ``,
    ...renderProbableMatches(overlap.probable),
    `## Exact Matches`,
    ``,
    ...(overlap.exact.length > 0 ? overlap.exact.map(item => `- ${item}`) : ['- None']),
    ``,
    `## Baseline-Only Findings`,
    ``,
    ...(overlap.baselineOnly.length > 0
      ? overlap.baselineOnly.map(item => `- ${item}`)
      : ['- None']),
    ``,
    `## Optimized-Only Findings`,
    ``,
    ...(overlap.optimizedOnly.length > 0
      ? overlap.optimizedOnly.map(item => `- ${item}`)
      : ['- None']),
    ``,
    `## Baseline Review`,
    ``,
    result.baseline.rawResult || '(empty)',
    ``,
    `## Optimized Review`,
    ``,
    result.optimized.rawResult || '(empty)',
    ``,
  ].join('\n')

  writeFileSync(outFile, markdown, 'utf8')
  return markdown
}
