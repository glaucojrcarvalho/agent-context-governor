import { writeFileSync } from 'node:fs'

import { runClaudeReviewComparison } from './claude.js'
import { parseScenarioFile } from './input.js'

function extractBullets(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- ') || line.startsWith('* '))
    .map(line => line.slice(2).trim())
}

function normalizeFinding(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_:#()[\].,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

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

function computeOverlap(
  baselineFindings: string[],
  optimizedFindings: string[],
): {
  shared: string[]
  baselineOnly: string[]
  optimizedOnly: string[]
  sharedTopics: string[]
  baselineOnlyTopics: string[]
  optimizedOnlyTopics: string[]
} {
  const optimizedNormalized = new Map(
    optimizedFindings.map(item => [normalizeFinding(item), item]),
  )
  const baselineNormalized = new Map(
    baselineFindings.map(item => [normalizeFinding(item), item]),
  )

  const shared: string[] = []
  const baselineOnly: string[] = []
  const optimizedOnly: string[] = []

  for (const item of baselineFindings) {
    if (optimizedNormalized.has(normalizeFinding(item))) {
      shared.push(item)
    } else {
      baselineOnly.push(item)
    }
  }

  for (const item of optimizedFindings) {
    if (!baselineNormalized.has(normalizeFinding(item))) {
      optimizedOnly.push(item)
    }
  }

  const baselineTopics = new Set(baselineFindings.flatMap(inferTopics))
  const optimizedTopics = new Set(optimizedFindings.flatMap(inferTopics))

  const sharedTopics = [...baselineTopics].filter(topic => optimizedTopics.has(topic))
  const baselineOnlyTopics = [...baselineTopics].filter(
    topic => !optimizedTopics.has(topic),
  )
  const optimizedOnlyTopics = [...optimizedTopics].filter(
    topic => !baselineTopics.has(topic),
  )

  return {
    shared,
    baselineOnly,
    optimizedOnly,
    sharedTopics,
    baselineOnlyTopics,
    optimizedOnlyTopics,
  }
}

export function writeClaudeReviewReport(
  scenarioPath: string,
  outFile: string,
): string {
  const scenario = parseScenarioFile(scenarioPath)
  const result = runClaudeReviewComparison(scenario)
  const baselineFindings = extractBullets(result.baseline.rawResult)
  const optimizedFindings = extractBullets(result.optimized.rawResult)
  const overlap = computeOverlap(baselineFindings, optimizedFindings)

  const markdown = [
    `# Claude Review Report`,
    ``,
    `Scenario: ${scenario.title}`,
    ``,
    `## Usage`,
    ``,
    `- Saved input tokens: ${result.savedInputTokens}`,
    `- Saved cache creation tokens: ${result.savedCacheCreationTokens}`,
    `- Saved cache read tokens: ${result.savedCacheReadTokens}`,
    `- Saved total tokens: ${result.savedTotalTokens}`,
    `- Baseline cost USD: ${result.baseline.totalCostUsd ?? 'unknown'}`,
    `- Optimized cost USD: ${result.optimized.totalCostUsd ?? 'unknown'}`,
    ``,
    `## Overlap Summary`,
    ``,
    `- Shared findings: ${overlap.shared.length}`,
    `- Baseline-only findings: ${overlap.baselineOnly.length}`,
    `- Optimized-only findings: ${overlap.optimizedOnly.length}`,
    ``,
    `## Topic Overlap`,
    ``,
    `- Shared topics: ${overlap.sharedTopics.length}`,
    ...(overlap.sharedTopics.length > 0
      ? overlap.sharedTopics.map(topic => `- ${topic}`)
      : ['- None']),
    `- Baseline-only topics: ${overlap.baselineOnlyTopics.length}`,
    ...(overlap.baselineOnlyTopics.length > 0
      ? overlap.baselineOnlyTopics.map(topic => `- ${topic}`)
      : ['- None']),
    `- Optimized-only topics: ${overlap.optimizedOnlyTopics.length}`,
    ...(overlap.optimizedOnlyTopics.length > 0
      ? overlap.optimizedOnlyTopics.map(topic => `- ${topic}`)
      : ['- None']),
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
