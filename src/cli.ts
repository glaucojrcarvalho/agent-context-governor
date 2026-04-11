#!/usr/bin/env node

import { resolve } from 'node:path'

import { runBenchmarks, runScenario } from './benchmark.js'
import { runClaudeBenchmark, runClaudeReviewComparison } from './claude.js'
import { getDefaultScenarios } from './fixtures.js'
import { buildRepoReviewImportOptions, writeImportedScenario } from './importer.js'
import { parseScenarioFile } from './input.js'
import { writeClaudeReviewReport } from './report.js'

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function formatScenarioList(): string {
  return getDefaultScenarios()
    .map(scenario => `- ${scenario.id}: ${scenario.title}`)
    .join('\n')
}

function formatBenchmarkOutput(): string {
  const results = runBenchmarks(getDefaultScenarios())

  return results
    .map(result => {
      const lines = [
        `Scenario: ${result.scenarioTitle}`,
        `Baseline tokens: ${result.baselineTokens}`,
        `Optimized tokens: ${result.optimizedTokens}`,
        `Saved tokens: ${result.savedTokens} (${formatPercent(result.savingsRatio)})`,
        'Decisions:',
        ...result.decisions.map(
          decision => `- ${decision.type} ${decision.candidateId}: ${decision.reason}`,
        ),
      ]

      return lines.join('\n')
    })
    .join('\n\n')
}

function formatSingleScenario(id: string): string {
  const scenario = getDefaultScenarios().find(item => item.id === id)
  if (!scenario) {
    return [
      `Unknown scenario: ${id}`,
      'Available scenarios:',
      formatScenarioList(),
    ].join('\n')
  }

  const result = runScenario(scenario)
  return [
    `Scenario: ${result.scenarioTitle}`,
    `Baseline tokens: ${result.baselineTokens}`,
    `Optimized tokens: ${result.optimizedTokens}`,
    `Saved tokens: ${result.savedTokens} (${formatPercent(result.savingsRatio)})`,
    'Final context:',
    ...result.finalContext.map(line => `- ${line}`),
    'Decisions:',
    ...result.decisions.map(
      decision => `- ${decision.type} ${decision.candidateId}: ${decision.reason}`,
    ),
  ].join('\n')
}

function formatScenarioResult(result: ReturnType<typeof runScenario>): string {
  return [
    `Scenario: ${result.scenarioTitle}`,
    `Baseline tokens: ${result.baselineTokens}`,
    `Optimized tokens: ${result.optimizedTokens}`,
    `Saved tokens: ${result.savedTokens} (${formatPercent(result.savingsRatio)})`,
    'Final context:',
    ...result.finalContext.map(line => `- ${line}`),
    'Decisions:',
    ...result.decisions.map(
      decision => `- ${decision.type} ${decision.candidateId}: ${decision.reason}`,
    ),
  ].join('\n')
}

function formatFileScenario(filePath: string): string {
  const scenario = parseScenarioFile(resolve(filePath))
  const result = runScenario(scenario)
  return formatScenarioResult(result)
}

function formatClaudeComparison(filePath: string): string {
  const scenario = parseScenarioFile(resolve(filePath))
  const result = runClaudeBenchmark(scenario, {
    permissionMode: 'bypassPermissions',
  })

  return [
    `Scenario: ${scenario.title}`,
    `Claude baseline prompt input tokens: ${result.baseline.inputTokens}`,
    `Claude optimized prompt input tokens: ${result.optimized.inputTokens}`,
    `Saved prompt input tokens: ${result.savedInputTokens}`,
    `Baseline output tokens: ${result.baseline.outputTokens}`,
    `Optimized output tokens: ${result.optimized.outputTokens}`,
    `Saved output tokens: ${result.savedOutputTokens}`,
    `Saved non-cache tokens: ${result.savedNonCacheTokens}`,
    `Claude baseline cache creation tokens: ${result.baseline.cacheCreationInputTokens}`,
    `Claude optimized cache creation tokens: ${result.optimized.cacheCreationInputTokens}`,
    `Saved cache creation tokens: ${result.savedCacheCreationTokens}`,
    `Claude baseline cache read tokens: ${result.baseline.cacheReadInputTokens}`,
    `Claude optimized cache read tokens: ${result.optimized.cacheReadInputTokens}`,
    `Saved cache read tokens: ${result.savedCacheReadTokens}`,
    `Observed total token delta: ${result.savedTotalTokens}`,
    `Baseline observed total tokens: ${result.baselineObservedTotalTokens}`,
    `Optimized observed total tokens: ${result.optimizedObservedTotalTokens}`,
    `Cost delta USD: ${result.costDeltaUsd ?? 'unknown'}`,
    `Baseline cost USD: ${result.baseline.totalCostUsd ?? 'unknown'}`,
    `Optimized cost USD: ${result.optimized.totalCostUsd ?? 'unknown'}`,
  ].join('\n')
}

function formatClaudeReviewComparison(filePath: string): string {
  const scenario = parseScenarioFile(resolve(filePath))
  const result = runClaudeReviewComparison(scenario, {
    permissionMode: 'bypassPermissions',
  })

  return [
    `Scenario: ${scenario.title}`,
    `Saved prompt input tokens: ${result.savedInputTokens}`,
    `Saved output tokens: ${result.savedOutputTokens}`,
    `Saved non-cache tokens: ${result.savedNonCacheTokens}`,
    `Saved cache creation tokens: ${result.savedCacheCreationTokens}`,
    `Saved cache read tokens: ${result.savedCacheReadTokens}`,
    `Observed total token delta: ${result.savedTotalTokens}`,
    `Cost delta USD: ${result.costDeltaUsd ?? 'unknown'}`,
    '',
    'Baseline review:',
    result.baseline.rawResult || '(empty)',
    '',
    'Optimized review:',
    result.optimized.rawResult || '(empty)',
  ].join('\n')
}

function getFlagValues(argv: string[], flag: string): string[] {
  const values: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag) {
      const value = argv[i + 1]
      if (value && !value.startsWith('--')) {
        values.push(value)
      }
    }
  }
  return values
}

function getFlagValue(argv: string[], flag: string): string | undefined {
  return getFlagValues(argv, flag)[0]
}

function formatImportedScenario(argv: string[]): string {
  const objective = getFlagValue(argv, '--objective')
  if (!objective) {
    throw new Error('Missing required flag: --objective')
  }

  const title = getFlagValue(argv, '--title') ?? 'Imported Scenario'
  const outFile = getFlagValue(argv, '--out') ?? './acg-session.json'
  const searchRoot = getFlagValue(argv, '--search-root') ?? '.'
  const softLimitTokens = Number(getFlagValue(argv, '--soft-limit') ?? '4000')
  const hardLimitTokens = Number(getFlagValue(argv, '--hard-limit') ?? '6000')
  const readPaths = getFlagValues(argv, '--read')
  const logPaths = getFlagValues(argv, '--log')
  const searchPatterns = getFlagValues(argv, '--search')

  const scenario = writeImportedScenario({
    title,
    objective,
    outFile,
    softLimitTokens,
    hardLimitTokens,
    readPaths,
    logPaths,
    searchPatterns,
    searchRoot,
  })

  return [
    `Wrote scenario: ${outFile}`,
    `Title: ${scenario.title}`,
    `Candidates: ${scenario.candidates.length}`,
    `Budget: soft=${scenario.budget.softLimitTokens} hard=${scenario.budget.hardLimitTokens}`,
  ].join('\n')
}

function formatRepoReviewScenario(argv: string[]): string {
  const rootDir = getFlagValue(argv, '--root') ?? '.'
  const title = getFlagValue(argv, '--title')
  const objective = getFlagValue(argv, '--objective')
  const outFile = getFlagValue(argv, '--out')
  const softLimitTokens = Number(getFlagValue(argv, '--soft-limit') ?? '2600')
  const hardLimitTokens = Number(getFlagValue(argv, '--hard-limit') ?? '3600')

  const scenario = writeImportedScenario(
    buildRepoReviewImportOptions({
      rootDir,
      title,
      objective,
      outFile,
      softLimitTokens,
      hardLimitTokens,
    }),
  )

  return [
    `Wrote scenario: ${resolve(rootDir, outFile ?? './acg-repo-review.json')}`,
    `Title: ${scenario.title}`,
    `Candidates: ${scenario.candidates.length}`,
    `Budget: soft=${scenario.budget.softLimitTokens} hard=${scenario.budget.hardLimitTokens}`,
  ].join('\n')
}

function formatReviewReport(argv: string[]): string {
  const filePath = argv[1]
  if (!filePath) {
    throw new Error('Missing scenario file path.')
  }

  const outFile = getFlagValue(argv, '--out') ?? './review-report.md'
  writeClaudeReviewReport(resolve(filePath), resolve(outFile))

  return [
    `Wrote report: ${outFile}`,
    `Scenario: ${filePath}`,
  ].join('\n')
}

function printHelp(): string {
  return [
    'Agent Context Governor CLI',
    '',
    'Usage:',
    '  acg help',
    '  acg list',
    '  acg demo',
    '  acg bench',
    '  acg scenario <id>',
    '  acg run <scenario.json>',
    '  acg compare-claude <scenario.json>',
    '  acg import --objective <text> [options]',
    '  acg import-review [--root <dir>] [options]',
    '  acg review-claude <scenario.json>',
    '  acg review-report <scenario.json> [--out <file>]',
    '',
    'Commands:',
    '  help       Show this help text',
    '  list       List built-in benchmark scenarios',
    '  demo       Run the default demo output',
    '  bench      Run all built-in benchmark scenarios',
    '  scenario   Run one built-in scenario by id',
    '  run        Run a custom scenario from a JSON file',
    '  compare-claude  Benchmark raw vs optimized context with real Claude usage',
    '  import     Build a scenario JSON from real files, logs, and search results',
    '  import-review   Build a repo-review scenario from common project files automatically',
    '  review-claude   Run a real Claude review with raw and optimized context',
    '  review-report   Save a markdown report for the raw vs optimized Claude review',
  ].join('\n')
}

function main(argv: string[]): void {
  const [, , command = 'help', arg] = argv

  switch (command) {
    case 'help':
      console.log(printHelp())
      return
    case 'list':
      console.log(formatScenarioList())
      return
    case 'demo':
    case 'bench':
      console.log(formatBenchmarkOutput())
      return
    case 'scenario':
      if (!arg) {
        console.log('Missing scenario id.\n')
        console.log(formatScenarioList())
        return
      }
      console.log(formatSingleScenario(arg))
      return
    case 'run':
      if (!arg) {
        console.log('Missing scenario file path.\n')
        console.log('Example: acg run ./examples/sample-session.json')
        return
      }
      console.log(formatFileScenario(arg))
      return
    case 'compare-claude':
      if (!arg) {
        console.log('Missing scenario file path.\n')
        console.log('Example: acg compare-claude ./examples/sample-session.json')
        return
      }
      console.log(formatClaudeComparison(arg))
      return
    case 'review-claude':
      if (!arg) {
        console.log('Missing scenario file path.\n')
        console.log('Example: acg review-claude ./examples/sample-session.json')
        return
      }
      console.log(formatClaudeReviewComparison(arg))
      return
    case 'import':
      console.log(formatImportedScenario(argv.slice(2)))
      return
    case 'import-review':
      console.log(formatRepoReviewScenario(argv.slice(2)))
      return
    case 'review-report':
      console.log(formatReviewReport(argv.slice(2)))
      return
    default:
      console.log(`Unknown command: ${command}\n`)
      console.log(printHelp())
  }
}

try {
  main(process.argv)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Error: ${message}`)
  process.exit(1)
}
