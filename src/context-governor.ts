import { ContextBudgetPolicy } from './budget-policy.js'
import { DEFAULT_GOVERNOR_CONFIG, mergeGovernorConfig, type GovernorConfig } from './config.js'
import {
  compareCandidates,
  evaluateCandidate,
  isImplementationSource,
  toDecision,
} from './rules.js'
import { SavingsReporter } from './savings-reporter.js'
import type {
  GovernorInput,
  GovernorResult,
  OptimizationDecision,
} from './types.js'
import { validateGovernorInput } from './input.js'

export class ContextGovernor {
  constructor(private readonly config: GovernorConfig = DEFAULT_GOVERNOR_CONFIG) {}

  optimize(input: GovernorInput): GovernorResult {
    const validatedInput = validateGovernorInput(input)
    const effectiveConfig = mergeGovernorConfig({
      ...this.config,
      budget: validatedInput.budget,
    })
    const policy = new ContextBudgetPolicy(effectiveConfig.budget)
    const reporter = new SavingsReporter()
    const baselineTokens = policy.sumTokens(validatedInput.candidates)
    const decisions: OptimizationDecision[] = []

    const ordered = [...validatedInput.candidates].sort((left, right) =>
      compareCandidates(left, right, effectiveConfig, validatedInput.mode ?? 'default'),
    )

    let runningTokens = 0
    let preservedImplementationCount = 0
    const finalContext: string[] = []

    for (const candidate of ordered) {
      const action = evaluateCandidate(candidate, {
        softLimitTokens: effectiveConfig.budget.softLimitTokens,
        hardLimitTokens: effectiveConfig.budget.hardLimitTokens,
        runningTokens,
        config: effectiveConfig,
        mode: validatedInput.mode ?? 'default',
        preservedImplementationCount,
      })

      if (action.type === 'keep') {
        finalContext.push(candidate.content)
        runningTokens += action.tokenCost
        if (isImplementationSource(candidate, effectiveConfig)) {
          preservedImplementationCount += 1
        }
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
