import { DEFAULT_GOVERNOR_CONFIG, type GovernorConfig } from './config.js'
import { ContextGovernor } from './context-governor.js'
import { SavingsReporter } from './savings-reporter.js'
import type { BenchmarkResult, BenchmarkScenario } from './types.js'

export function runScenario(
  scenario: BenchmarkScenario,
  config: GovernorConfig = DEFAULT_GOVERNOR_CONFIG,
): BenchmarkResult {
  const governor = new ContextGovernor(config)
  const reporter = new SavingsReporter()
  const result = governor.optimize({
    candidates: scenario.candidates,
    budget: scenario.budget,
  })
  const savings = reporter.createReport(
    result.baselineTokens,
    result.optimizedTokens,
  )

  return {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    baselineTokens: savings.baselineTokens,
    optimizedTokens: savings.optimizedTokens,
    savedTokens: savings.savedTokens,
    savingsRatio: savings.savingsRatio,
    decisions: result.decisions,
    finalContext: result.finalContext,
  }
}

export function runBenchmarks(
  scenarios: BenchmarkScenario[],
  config: GovernorConfig = DEFAULT_GOVERNOR_CONFIG,
): BenchmarkResult[] {
  return scenarios.map(scenario => runScenario(scenario, config))
}
