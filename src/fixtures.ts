import type { BenchmarkScenario } from './types.js'

export function getDefaultScenarios(): BenchmarkScenario[] {
  return [
    {
      id: 'subagent-debug',
      title: 'Subagent Debug Flow',
      description:
        'A debugging subagent receives too much inherited context, including file reads, search results, and shell logs.',
      budget: {
        softLimitTokens: 900,
        hardLimitTokens: 1100,
      },
      candidates: [
        {
          id: 'task-objective',
          kind: 'other',
          priority: 'critical',
          tokenEstimate: 120,
          content:
            'Fix the failing login flow in a sample service without changing external behavior.',
          metadata: { source: 'task-objective' },
        },
        {
          id: 'recent-edit-plan',
          kind: 'transcript_snapshot',
          priority: 'high',
          tokenEstimate: 180,
          content:
            'Parent agent notes: issue likely in session refresh handling; inspect middleware and retry logic.',
          metadata: { source: 'parent-summary' },
        },
        {
          id: 'auth-service-read',
          kind: 'file_read',
          priority: 'high',
          tokenEstimate: 620,
          content:
            'Full contents of src/session/service.ts with all helper functions and comments.',
          metadata: { source: 'src/session/service.ts' },
        },
        {
          id: 'grep-auth-errors',
          kind: 'search_result',
          priority: 'medium',
          tokenEstimate: 340,
          content:
            'Search output for session refresh usage across handlers, middleware, and tests.',
          metadata: { source: 'session refresh grep' },
        },
        {
          id: 'test-log',
          kind: 'shell_output',
          priority: 'medium',
          tokenEstimate: 520,
          content:
            'Verbose failing test log with stack trace, environment noise, and unrelated warnings.',
          metadata: { source: 'pnpm test session.spec.ts' },
        },
        {
          id: 'older-chat',
          kind: 'other',
          priority: 'low',
          tokenEstimate: 260,
          content:
            'Older conversational history about unrelated exploratory ideas and abandoned approaches.',
          metadata: { source: 'older-chat' },
        },
      ],
    },
    {
      id: 'search-heavy-refactor',
      title: 'Search Heavy Refactor',
      description:
        'A refactor task accumulates large search payloads and repeated file reads across several directories.',
      budget: {
        softLimitTokens: 1000,
        hardLimitTokens: 1200,
      },
      candidates: [
        {
          id: 'refactor-objective',
          kind: 'other',
          priority: 'critical',
          tokenEstimate: 140,
          content:
            'Rename the event collector interface and update all call sites without changing runtime behavior.',
          metadata: { source: 'task-objective' },
        },
        {
          id: 'active-errors',
          kind: 'diagnostic',
          priority: 'high',
          tokenEstimate: 260,
          content:
            'Type errors from the compiler after partial refactor across three modules.',
          metadata: { source: 'tsc diagnostics' },
        },
        {
          id: 'collector-search',
          kind: 'search_result',
          priority: 'high',
          tokenEstimate: 700,
          content:
            'Large ripgrep output of every EventCollector reference in the repository.',
          metadata: { source: 'rg EventCollector' },
        },
        {
          id: 'collector-read',
          kind: 'file_read',
          priority: 'medium',
          tokenEstimate: 580,
          content:
            'Full contents of the collector implementation and adjacent helper modules.',
          metadata: { source: 'src/events/collector.ts' },
        },
        {
          id: 'legacy-notes',
          kind: 'transcript_snapshot',
          priority: 'medium',
          tokenEstimate: 210,
          content:
            'Older plan notes from the initial rename attempt and partial migration state.',
          metadata: { source: 'rename-notes' },
        },
      ],
    },
  ]
}
