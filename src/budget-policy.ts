import type { ContextBudget, ContextCandidate } from './types.js'

export class ContextBudgetPolicy {
  constructor(private readonly budget: ContextBudget) {}

  getBudget(): ContextBudget {
    return this.budget
  }

  isWithinSoftLimit(candidates: ContextCandidate[]): boolean {
    return this.sumTokens(candidates) <= this.budget.softLimitTokens
  }

  isWithinHardLimit(candidates: ContextCandidate[]): boolean {
    return this.sumTokens(candidates) <= this.budget.hardLimitTokens
  }

  sumTokens(candidates: ContextCandidate[]): number {
    return candidates.reduce((sum, candidate) => sum + candidate.tokenEstimate, 0)
  }
}
