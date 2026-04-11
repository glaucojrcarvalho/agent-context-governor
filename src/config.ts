import type { ContextArtifactKind, ContextBudget, ContextCandidatePriority } from './types.js'

export type ReplacementConfig = {
  enabledKinds: ContextArtifactKind[]
  tokenCosts: Partial<Record<ContextArtifactKind, number>>
}

export type PriorityConfig = {
  scores: Record<ContextCandidatePriority, number>
}

export type GovernorConfig = {
  budget: ContextBudget
  replacement: ReplacementConfig
  priority: PriorityConfig
  protectedSources?: string[]
  review?: {
    preserveSourcePatterns: string[]
    implementationSourcePatterns: string[]
    minimumImplementationCandidates: number
  }
}

export const DEFAULT_GOVERNOR_CONFIG: GovernorConfig = {
  budget: {
    softLimitTokens: 1000,
    hardLimitTokens: 1200,
  },
  replacement: {
    enabledKinds: [
      'file_read',
      'search_result',
      'shell_output',
      'diagnostic',
      'transcript_snapshot',
    ],
    tokenCosts: {
      file_read: 36,
      search_result: 28,
      shell_output: 32,
      diagnostic: 24,
      web_content: 40,
      transcript_snapshot: 22,
      other: 24,
    },
  },
  priority: {
    scores: {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    },
  },
  protectedSources: [
    'README.md',
    'package.json',
    'SECURITY.md',
    'CONTRIBUTING.md',
    '.github/',
    '.gitignore',
    'eslint.config.js',
    'docs/architecture.md',
    'src/context-governor.ts',
    'src/cli.ts',
    'src/claude.ts',
  ],
  review: {
    preserveSourcePatterns: [
      'src/context-governor.ts',
      'src/rules.ts',
      'src/input.ts',
      'src/importer.ts',
      'src/claude.ts',
      'src/report.ts',
    ],
    implementationSourcePatterns: [
      'src/',
    ],
    minimumImplementationCandidates: 3,
  },
}

export function mergeGovernorConfig(
  override?: Partial<GovernorConfig>,
): GovernorConfig {
  if (!override) {
    return DEFAULT_GOVERNOR_CONFIG
  }

  return {
    budget: {
      softLimitTokens:
        override.budget?.softLimitTokens ??
        DEFAULT_GOVERNOR_CONFIG.budget.softLimitTokens,
      hardLimitTokens:
        override.budget?.hardLimitTokens ??
        DEFAULT_GOVERNOR_CONFIG.budget.hardLimitTokens,
    },
    replacement: {
      enabledKinds:
        override.replacement?.enabledKinds ??
        DEFAULT_GOVERNOR_CONFIG.replacement.enabledKinds,
      tokenCosts: {
        ...DEFAULT_GOVERNOR_CONFIG.replacement.tokenCosts,
        ...override.replacement?.tokenCosts,
      },
    },
    priority: {
      scores: {
        ...DEFAULT_GOVERNOR_CONFIG.priority.scores,
        ...override.priority?.scores,
      },
    },
    protectedSources:
      override.protectedSources ?? DEFAULT_GOVERNOR_CONFIG.protectedSources,
    review: {
      preserveSourcePatterns:
        override.review?.preserveSourcePatterns ??
        DEFAULT_GOVERNOR_CONFIG.review?.preserveSourcePatterns ??
        [],
      implementationSourcePatterns:
        override.review?.implementationSourcePatterns ??
        DEFAULT_GOVERNOR_CONFIG.review?.implementationSourcePatterns ??
        [],
      minimumImplementationCandidates:
        override.review?.minimumImplementationCandidates ??
        DEFAULT_GOVERNOR_CONFIG.review?.minimumImplementationCandidates ??
        0,
    },
  }
}
