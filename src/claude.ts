import { spawnSync } from 'node:child_process'

import { runScenario } from './benchmark.js'
import type {
  BenchmarkScenario,
  ClaudeComparisonResult,
  ClaudePromptMode,
  ClaudeUsageResult,
} from './types.js'

function buildPrompt(
  task: string,
  contextBlocks: string[],
  mode: ClaudePromptMode,
): string {
  const blocks = contextBlocks.map((block, index) => {
    return `Context Block ${index + 1}:\n${block}`
  })

  const instructions =
    mode === 'benchmark'
      ? [
          'You are being used only for a token benchmark.',
          'Do not perform extra analysis.',
          'Read the provided task and context.',
          'Reply with exactly: OK',
        ]
      : [
          'Review the provided project context.',
          'Focus on architecture, maintainability, and security.',
          'Be concise and concrete.',
          'Output 3-6 short bullet points.',
        ]

  return [
    ...instructions,
    '',
    `Task:\n${task}`,
    '',
    ...blocks,
  ].join('\n')
}

function parseClaudeResult(stdout: string): ClaudeUsageResult {
  let parsed: {
    result?: string
    total_cost_usd?: number
    modelUsage?: Record<
      string,
      {
        inputTokens: number
        outputTokens: number
        cacheReadInputTokens: number
        cacheCreationInputTokens: number
      }
    >
    usage?: {
      input_tokens: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
      output_tokens: number
    }
  }

  try {
    parsed = JSON.parse(stdout) as typeof parsed
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to parse Claude JSON output: ${message}. First 200 chars: ${stdout.slice(0, 200)}`,
    )
  }

  const usage = parsed.usage
  if (!usage) {
    throw new Error('Claude result did not contain usage data')
  }

  const model = parsed.modelUsage ? Object.keys(parsed.modelUsage)[0] : undefined

  return {
    inputTokens: usage.input_tokens,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    outputTokens: usage.output_tokens,
    totalCostUsd: parsed.total_cost_usd,
    model,
    rawResult: parsed.result ?? '',
  }
}

function getObservedTotal(result: ClaudeUsageResult): number {
  return (
    result.inputTokens +
    result.cacheCreationInputTokens +
    result.cacheReadInputTokens +
    result.outputTokens
  )
}

export function runClaudeBenchmark(
  scenario: BenchmarkScenario,
  options?: {
    claudeBin?: string
    model?: string
    mode?: ClaudePromptMode
    permissionMode?: 'default' | 'bypassPermissions'
  },
): ClaudeComparisonResult {
  const claudeBin = options?.claudeBin ?? 'claude'
  const mode = options?.mode ?? 'benchmark'
  const optimized = runScenario(scenario)
  const task = scenario.candidates[0]?.content ?? scenario.title
  const baselinePrompt = buildPrompt(
    task,
    scenario.candidates.map(candidate => candidate.content),
    mode,
  )
  const optimizedPrompt = buildPrompt(task, optimized.finalContext, mode)

  const runClaude = (prompt: string): ClaudeUsageResult => {
    const args = ['-p', '--output-format', 'json']
    if (options?.permissionMode) {
      args.push('--permission-mode', options.permissionMode)
    }
    if (options?.model) {
      args.push('--model', options.model)
    }

    const result = spawnSync(claudeBin, args, {
      input: prompt,
      encoding: 'utf8',
    })

    if (result.status !== 0) {
      throw new Error(result.stderr || `Claude exited with code ${result.status}`)
    }

    return parseClaudeResult(result.stdout)
  }

  const baseline = runClaude(baselinePrompt)
  const optimizedUsage = runClaude(optimizedPrompt)
  const baselineObservedTotal = getObservedTotal(baseline)
  const optimizedObservedTotal = getObservedTotal(optimizedUsage)
  const baselineCost = baseline.totalCostUsd
  const optimizedCost = optimizedUsage.totalCostUsd

  return {
    baseline,
    optimized: optimizedUsage,
    savedInputTokens: baseline.inputTokens - optimizedUsage.inputTokens,
    savedOutputTokens: baseline.outputTokens - optimizedUsage.outputTokens,
    savedNonCacheTokens:
      baseline.inputTokens +
      baseline.outputTokens -
      optimizedUsage.inputTokens -
      optimizedUsage.outputTokens,
    savedCacheCreationTokens:
      baseline.cacheCreationInputTokens -
      optimizedUsage.cacheCreationInputTokens,
    savedCacheReadTokens:
      baseline.cacheReadInputTokens - optimizedUsage.cacheReadInputTokens,
    savedTotalTokens: baselineObservedTotal - optimizedObservedTotal,
    baselineObservedTotalTokens: baselineObservedTotal,
    optimizedObservedTotalTokens: optimizedObservedTotal,
    costDeltaUsd:
      typeof baselineCost === 'number' && typeof optimizedCost === 'number'
        ? baselineCost - optimizedCost
        : undefined,
  }
}

export function runClaudeReviewComparison(
  scenario: BenchmarkScenario,
  options?: {
    claudeBin?: string
    model?: string
    permissionMode?: 'default' | 'bypassPermissions'
  },
): ClaudeComparisonResult {
  return runClaudeBenchmark(scenario, {
    ...options,
    mode: 'review',
  })
}
