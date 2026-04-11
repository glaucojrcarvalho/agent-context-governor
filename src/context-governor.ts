import { ContextBudgetPolicy } from './budget-policy.js'
import { DEFAULT_GOVERNOR_CONFIG, mergeGovernorConfig, type GovernorConfig } from './config.js'
import {
  compareCandidates,
  evaluateCandidate,
  toDecision,
} from './rules.js'
import { SavingsReporter } from './savings-reporter.js'
import type {
  GovernorInput,
  GovernorResult,
  OptimizationDecision,
} from './types.js'

export class ContextGovernor {
  constructor(private readonly config: GovernorConfig = DEFAULT_GOVERNOR_CONFIG) {}

  optimize(input: GovernorInput): GovernorResult {
    const effectiveConfig = mergeGovernorConfig({
      ...this.config,
      budget: input.budget,
    })
    const policy = new ContextBudgetPolicy(effectiveConfig.budget)
    const reporter = new SavingsReporter()
    const baselineTokens = policy.sumTokens(input.candidates)
    const decisions: OptimizationDecision[] = []

    const ordered = [...input.candidates].sort((left, right) =>
      compareCandidates(left, right, effectiveConfig),
    )

    let runningTokens = 0
    const finalContext: string[] = []

    for (const candidate of ordered) {
      const action = evaluateCandidate(candidate, {
        softLimitTokens: effectiveConfig.budget.softLimitTokens,
        hardLimitTokens: effectiveConfig.budget.hardLimitTokens,
        runningTokens,
        config: effectiveConfig,
      })

      if (action.type === 'keep') {
        finalContext.push(candidate.content)
        runningTokens += action.tokenCost
        decisions.push(toDecision(candidate.id, action))
        continue
      }

      if (action.type === 'replace') {
        finalContext.push(action.replacement)
        runningTokens += action.tokenCost
        decisions.push(toDecision(candidate.id, action))
        continue
      }

      decisions.push(toDecision(candidate.id, action))
    }

    const report = reporter.createReport(baselineTokens, runningTokens)

    return {
      finalContext,
      decisions,
      baselineTokens: report.baselineTokens,
      optimizedTokens: report.optimizedTokens,
    }
  }
}
