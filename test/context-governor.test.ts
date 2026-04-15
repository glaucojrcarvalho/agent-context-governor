import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_GOVERNOR_CONFIG } from '../src/config.js'
import { ContextGovernor } from '../src/context-governor.js'
import { runScenario } from '../src/benchmark.js'
import { getDefaultScenarios } from '../src/fixtures.js'
import { estimateTokens, parseScenarioFile } from '../src/input.js'
import { buildRepoReviewImportOptions } from '../src/importer.js'
import { computeOverlap, extractFindings, jaccardSimilarity } from '../src/report.js'

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

// ---
// report: extractFindings
// ---

void test('extractFindings captures dash bullet points', () => {
  const text = '- First finding\n- Second finding'
  const findings = extractFindings(text)
  assert.deepEqual(findings, ['First finding', 'Second finding'])
})

void test('extractFindings captures numbered list items', () => {
  const text = '1. First issue\n2. Second issue\n3. Third issue'
  const findings = extractFindings(text)
  assert.deepEqual(findings, ['First issue', 'Second issue', 'Third issue'])
})

void test('extractFindings captures substantial paragraphs', () => {
  const text = 'This is a substantial paragraph that is long enough to count as a finding.'
  const findings = extractFindings(text)
  assert.ok(findings.length === 1)
  assert.ok(findings[0]?.includes('substantial paragraph'))
})

void test('extractFindings ignores headings and section labels', () => {
  const text = '## Findings\nShort:\n- Real finding here'
  const findings = extractFindings(text)
  assert.deepEqual(findings, ['Real finding here'])
})

void test('extractFindings handles mixed formats in one response', () => {
  const text = [
    '## Architecture',
    '- Token estimation is naive',
    '1. No runtime integration yet',
    'The artifact store uses a plain in-memory Map with no persistence across calls.',
  ].join('\n')
  const findings = extractFindings(text)
  assert.equal(findings.length, 3)
  assert.ok(findings.some(f => f.includes('Token estimation')))
  assert.ok(findings.some(f => f.includes('runtime integration')))
  assert.ok(findings.some(f => f.includes('artifact store')))
})

// ---
// report: jaccardSimilarity
// ---

void test('jaccardSimilarity returns 1 for identical strings', () => {
  assert.equal(jaccardSimilarity('token estimation is wrong', 'token estimation is wrong'), 1)
})

void test('jaccardSimilarity returns 0 for completely unrelated strings', () => {
  assert.equal(jaccardSimilarity('token estimation', 'unrelated concepts here'), 0)
})

void test('jaccardSimilarity scores partial overlap between 0 and 1', () => {
  const score = jaccardSimilarity(
    'token estimation uses a simple character count heuristic',
    'token counting relies on a simple character count approximation',
  )
  assert.ok(score > 0 && score < 1, `expected 0 < score < 1, got ${score}`)
})

void test('jaccardSimilarity returns 0 for empty strings', () => {
  assert.equal(jaccardSimilarity('', 'something'), 0)
  assert.equal(jaccardSimilarity('something', ''), 0)
})

// ---
// report: computeOverlap
// ---

void test('computeOverlap classifies identical findings as exact matches', () => {
  const findings = ['Token estimation is naive', 'No runtime integration']
  const result = computeOverlap(findings, findings)
  assert.equal(result.exact.length, 2)
  assert.equal(result.probable.length, 0)
  assert.equal(result.baselineOnly.length, 0)
  assert.equal(result.optimizedOnly.length, 0)
  assert.equal(result.qualityScore, 100)
})

void test('computeOverlap classifies semantically similar findings as probable matches', () => {
  const baseline = ['token estimation uses a simple character count heuristic']
  const optimized = ['token counting relies on a simple character count approximation']
  const result = computeOverlap(baseline, optimized)
  assert.equal(result.exact.length, 0)
  assert.equal(result.probable.length, 1)
  assert.equal(result.baselineOnly.length, 0)
  assert.ok((result.probable[0]?.score ?? 0) > 0)
})

void test('computeOverlap classifies unrelated findings correctly', () => {
  const baseline = ['Token estimation is wrong']
  const optimized = ['CI pipeline is missing a lint step']
  const result = computeOverlap(baseline, optimized)
  assert.equal(result.exact.length, 0)
  assert.equal(result.probable.length, 0)
  assert.equal(result.baselineOnly.length, 1)
  assert.equal(result.optimizedOnly.length, 1)
})

void test('computeOverlap quality score reflects topic recall', () => {
  // baseline has a token_estimation finding, optimized has none
  const baseline = ['estimateTokens uses a hardcoded divide-by-4 heuristic']
  const optimized = ['CI pipeline is completely missing']
  const result = computeOverlap(baseline, optimized)
  // token_estimation topic was in baseline but not optimized → score < 100
  assert.ok(result.qualityScore < 100)
})
