import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

import type { BenchmarkScenario, ContextCandidate, ContextCandidatePriority } from './types.js'
import { estimateTokens } from './input.js'

export type ImportOptions = {
  title: string
  objective: string
  outFile: string
  softLimitTokens: number
  hardLimitTokens: number
  readPaths: string[]
  logPaths: string[]
  searchPatterns: string[]
  searchRoot: string
  mode?: 'default' | 'review'
}

const DEFAULT_REPO_REVIEW_READ_PATHS = [
  'README.md',
  'package.json',
  'SECURITY.md',
  'CONTRIBUTING.md',
  '.gitignore',
  'eslint.config.js',
  'tsconfig.json',
  'docs/architecture.md',
  'src/cli.ts',
  'src/context-governor.ts',
  'src/rules.ts',
  'src/config.ts',
  'src/input.ts',
  'src/importer.ts',
  'src/claude.ts',
  'src/report.ts',
  '.github/workflows/ci.yml',
  '.github/workflows/secret-scan.yml',
]

const DEFAULT_REPO_REVIEW_SEARCH_PATTERNS = [
  'token',
  'claude',
  'security',
  'review',
]

function createCandidate(args: {
  id: string
  kind: ContextCandidate['kind']
  priority: ContextCandidatePriority
  content: string
  source: string
}): ContextCandidate {
  return {
    id: args.id,
    kind: args.kind,
    priority: args.priority,
    content: args.content,
    tokenEstimate: estimateTokens(args.content),
    metadata: { source: args.source },
  }
}

function readSearchResults(pattern: string, searchRoot: string): string {
  const result = spawnSync(
    'rg',
    [
      '-n',
      '--no-heading',
      '--max-count',
      '200',
      '--max-columns',
      '240',
      '--glob',
      '!examples/repo-review*.json',
      '--glob',
      '!examples/repo-review-report*.md',
      pattern,
      searchRoot,
    ],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  )

  if (result.error) {
    throw new Error(result.error.message)
  }

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || `rg failed for pattern: ${pattern}`)
  }

  return result.stdout.trim()
}

export function buildImportedScenario(options: ImportOptions): BenchmarkScenario {
  const candidates: ContextCandidate[] = [
    {
      id: 'objective',
      kind: 'other',
      priority: 'critical',
      content: options.objective,
      tokenEstimate: estimateTokens(options.objective),
      metadata: { source: 'objective' },
    },
  ]

  for (const filePath of options.readPaths) {
    const absolutePath = resolve(filePath)
    const content = readFileSync(absolutePath, 'utf8')
    candidates.push(
      createCandidate({
        id: `read-${basename(filePath).replace(/\W+/g, '-').toLowerCase()}`,
        kind: 'file_read',
        priority: 'high',
        content,
        source: filePath,
      }),
    )
  }

  for (const filePath of options.logPaths) {
    const absolutePath = resolve(filePath)
    const content = readFileSync(absolutePath, 'utf8')
    candidates.push(
      createCandidate({
        id: `log-${basename(filePath).replace(/\W+/g, '-').toLowerCase()}`,
        kind: 'shell_output',
        priority: 'medium',
        content,
        source: filePath,
      }),
    )
  }

  for (const pattern of options.searchPatterns) {
    const content = readSearchResults(pattern, options.searchRoot)
    if (!content) continue
    candidates.push(
      createCandidate({
        id: `search-${pattern.replace(/\W+/g, '-').toLowerCase()}`,
        kind: 'search_result',
        priority: 'medium',
        content,
        source: `rg ${pattern}`,
      }),
    )
  }

  return {
    id: options.title.toLowerCase().replace(/\W+/g, '-'),
    title: options.title,
    description: `Imported scenario for ${options.title}`,
    budget: {
      softLimitTokens: options.softLimitTokens,
      hardLimitTokens: options.hardLimitTokens,
    },
    candidates,
    mode: options.mode ?? 'default',
  }
}

function getExistingPaths(paths: string[], rootDir: string): string[] {
  return paths.filter(filePath => existsSync(resolve(rootDir, filePath)))
}

export function buildRepoReviewImportOptions(args: {
  rootDir: string
  title?: string
  objective?: string
  outFile?: string
  softLimitTokens?: number
  hardLimitTokens?: number
}): ImportOptions {
  const rootDir = resolve(args.rootDir)

  return {
    title: args.title ?? 'Repository Review',
    objective:
      args.objective ??
      'Review this repository for architecture, maintainability, usability friction, and security. Return concise findings.',
    outFile: resolve(rootDir, args.outFile ?? './acg-repo-review.json'),
    softLimitTokens: args.softLimitTokens ?? 2600,
    hardLimitTokens: args.hardLimitTokens ?? 3600,
    readPaths: getExistingPaths(DEFAULT_REPO_REVIEW_READ_PATHS, rootDir).map(
      filePath => resolve(rootDir, filePath),
    ),
    logPaths: [],
    searchPatterns: DEFAULT_REPO_REVIEW_SEARCH_PATTERNS,
    searchRoot: rootDir,
    mode: 'review',
  }
}

export function writeImportedScenario(options: ImportOptions): BenchmarkScenario {
  const scenario = buildImportedScenario(options)
  writeFileSync(options.outFile, `${JSON.stringify(scenario, null, 2)}\n`, 'utf8')
  return scenario
}
