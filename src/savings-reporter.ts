import type { SavingsReport } from './types.js'

export class SavingsReporter {
  createReport(
    baselineTokens: number,
    optimizedTokens: number,
  ): SavingsReport {
    const savedTokens = Math.max(0, baselineTokens - optimizedTokens)
    const savingsRatio =
      baselineTokens === 0 ? 0 : savedTokens / baselineTokens

    return {
      baselineTokens,
      optimizedTokens,
      savedTokens,
      savingsRatio,
    }
  }
}
