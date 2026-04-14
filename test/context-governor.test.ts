import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_GOVERNOR_CONFIG } from '../src/config.js'
import { ContextGovernor } from '../src/context-governor.js'
import { runScenario } from '../src/benchmark.js'
import { getDefaultScenarios } from '../src/fixtures.js'
import { estimateTokens, parseScenarioFile } from '../src/input.js'
import { buildRepoReviewImportOptions } from '../src/importer.js'

void test('context governor reduces token count under pressure', () => {
  const scenario = getDefaultScenarios()[0]
  assert.ok(scenario, 'expected built-in scenario')

  const result = runScenario(scenario, DEFAULT_GOVERNOR_CONFIG)

  assert.ok(result.optimizedTokens < result.baselineTokens)
  assert.ok(result.savedTokens > 0)
  assert.ok(result.decisions.some(decision => decision.type === 'replace'))
})

void test('context governor keeps critical context in final payload', () => {
  const governor = new ContextGovernor(DEFAULT_GOVERNOR_CONFIG)
  const result = governor.optimize({
    budget: {
      softLimitTokens: 80,
      hardLimitTokens: 120,
    },
    candidates: [
      {
        id: 'objective',
        kind: 'other',
        priority: 'critical',
        tokenEstimate: 100,
        content: 'Fix the failing sample login flow.',
      },
      {
        id: 'old-log',
        kind: 'shell_output',
        priority: 'low',
        tokenEstimate: 300,
        content: 'Very long shell output',
      },
    ],
  })

  assert.equal(result.decisions[0]?.candidateId, 'objective')
  assert.ok(result.finalContext.length > 0)
})

void test('config overrides affect candidate ordering and optimization', () => {
  const scenario = getDefaultScenarios()[1]
  assert.ok(scenario, 'expected built-in scenario')

  const governor = new ContextGovernor({
    ...DEFAULT_GOVERNOR_CONFIG,
    priority: {
      scores: {
        critical: 10,
        high: 1,
        medium: 1,
        low: 1,
      },
    },
  })

  const result = governor.optimize({
    candidates: scenario.candidates,
    budget: scenario.budget,
  })

  assert.ok(result.decisions.length > 0)
  assert.equal(result.decisions[0]?.candidateId, 'refactor-objective')
})

void test('review mode keeps a minimum implementation slice under pressure', () => {
  const governor = new ContextGovernor(DEFAULT_GOVERNOR_CONFIG)
  const result = governor.optimize({
    mode: 'review',
    budget: {
      softLimitTokens: 120,
      hardLimitTokens: 240,
    },
    candidates: [
      {
        id: 'objective',
        kind: 'other',
        priority: 'critical',
        tokenEstimate: 20,
        content: 'Review this repository for architecture and security.',
        metadata: { source: 'objective' },
      },
      {
        id: 'readme',
        kind: 'file_read',
        priority: 'high',
        tokenEstimate: 80,
        content: 'Project overview',
        metadata: { source: 'README.md' },
      },
      {
        id: 'governor',
        kind: 'file_read',
        priority: 'high',
        tokenEstimate: 60,
        content: 'ContextGovernor implementation',
        metadata: { source: 'src/context-governor.ts' },
      },
      {
        id: 'rules',
        kind: 'file_read',
        priority: 'high',
        tokenEstimate: 60,
        content: 'Rule implementation',
        metadata: { source: 'src/rules.ts' },
      },
      {
        id: 'input',
        kind: 'file_read',
        priority: 'high',
        tokenEstimate: 60,
        content: 'Input implementation',
        metadata: { source: 'src/input.ts' },
      },
      {
        id: 'search',
        kind: 'search_result',
        priority: 'medium',
        tokenEstimate: 200,
        content: 'Large search output',
        metadata: { source: 'rg token' },
      },
    ],
  })

  assert.ok(result.decisions.some(decision => decision.candidateId === 'governor' && decision.type === 'keep'))
  assert.ok(result.decisions.some(decision => decision.candidateId === 'rules' && decision.type === 'keep'))
  assert.ok(result.decisions.some(decision => decision.candidateId === 'input' && decision.type === 'keep'))
})

void test('input parser estimates tokens from content when omitted', () => {
  const scenario = parseScenarioFile(
    resolve('examples/sample-session.json'),
  )

  assert.equal(scenario.title, 'Sample Real Session')
  assert.ok(scenario.candidates.length > 0)
  assert.ok(scenario.candidates.every(candidate => candidate.tokenEstimate > 0))
})

void test('estimateTokens returns stable positive values for non-empty text', () => {
  assert.equal(estimateTokens(''), 0)
  assert.equal(estimateTokens('abcd'), 1)
  assert.equal(estimateTokens('abcdefgh'), 2)
})

void test('context governor rejects malformed public input', () => {
  const governor = new ContextGovernor(DEFAULT_GOVERNOR_CONFIG)

  assert.throws(
    () =>
      governor.optimize({
        budget: {
          softLimitTokens: 100,
          hardLimitTokens: 50,
        },
        candidates: [],
      }),
    /Invalid "budget"|Invalid "candidates"/,
  )
})

void test('repo review import options include common repo files when present', () => {
  const options = buildRepoReviewImportOptions({
    rootDir: resolve('.'),
  })

  assert.ok(options.readPaths.some(filePath => filePath.endsWith('/README.md')))
  assert.ok(
    options.readPaths.some(filePath => filePath.endsWith('/src/context-governor.ts')),
  )
  assert.ok(options.searchPatterns.includes('token'))
  assert.ok(options.searchPatterns.includes('claude'))
})
