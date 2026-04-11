# Claude Review Report

Scenario: Repository Review

## Usage

- Saved input tokens: 0
- Saved cache creation tokens: -2597
- Saved cache read tokens: 0
- Saved total tokens: -2907
- Baseline cost USD: 2.8982027999999995
- Optimized cost USD: 0.035307149999999995

## Overlap Summary

- Shared findings: 0
- Baseline-only findings: 6
- Optimized-only findings: 6

## Topic Overlap

- Shared topics: 3
- architecture_gap
- ci_runtime
- parsing_validation
- Baseline-only topics: 3
- claude_api_surface
- token_estimation
- permissions
- Optimized-only topics: 3
- testing
- config_validation
- linting

## Baseline-Only Findings

- **Architecture/implementation gap** — `docs/architecture.md` documents three core modules (`ContextArtifactStore`, `SurrogateBuilder`, `ContextRanker`) that have no implementation. The public API shape is incomplete relative to what the project describes itself as.
- **Token estimation is a silent liability** — `estimateTokens` uses a hardcoded `/ 4` character heuristic (`src/input.ts:27-29`) with no abstraction boundary. Swapping to a real tokenizer requires touching every call site, and miscounts directly corrupt the governor's core budget decisions.
- **`claude.ts` bleeds into the public API** — `src/index.ts:11` does `export * from './claude.js'`, exposing `runClaudeBenchmark`, `runClaudeReviewComparison`, and other internal CLI helpers as library surface. Consumers get a noisy, unstable API they didn't ask for.
- **Unguarded `JSON.parse` on subprocess output** — `parseClaudeResult` calls `JSON.parse(stdout)` without try/catch (`src/claude.ts:42-86`). Any non-JSON output from the Claude CLI (errors, warnings, version mismatches) throws an unhandled exception at the library boundary.
- **Hardcoded `--permission-mode bypassPermissions`** — `runClaudeBenchmark` unconditionally passes this flag (`src/claude.ts:108`). Callers have no way to opt out, and it silently elevates privilege for every benchmark invocation without documented intent.
- **Security posture is solid on supply chain** — zero runtime dependencies eliminates the primary npm attack surface. CI runs `npm audit` and Gitleaks on every push/PR, which is appropriate for a tool that handles LLM orchestration context.

## Optimized-Only Findings

- **Architecture gap**: `ContextArtifactStore` is defined in the architecture doc and referenced as a core module, but absent from the actual source — the surrogate/replacement pipeline has no persistent artifact layer yet, leaving a major planned component unimplemented.
- **Test feedback loop**: `pretest` compiles TypeScript before every test run (`npm run build`). Tests run against `dist/`, not source — slower iteration and test errors may lag behind source changes by one compile cycle.
- **Supply chain exposure**: CI actions use floating major tags (`actions/checkout@v4`, `gitleaks/gitleaks-action@v2`) rather than pinned SHAs. A compromised tag could silently execute malicious code in the pipeline.
- **Config merge on every call**: `ContextGovernor.optimize()` calls `mergeGovernorConfig` on every invocation, rebuilding effective config per call. At high throughput this is unnecessary overhead; config should be resolved once at construction time unless per-call overrides are intentional.
- **No input validation boundary**: `GovernorInput` candidates enter `optimize()` with no schema validation or sanitization. The security doc acknowledges fixture parsing is not hardened — this is the specific gap to close before any untrusted-input path (CLI, future HTTP integration) is added.
- **ESLint covers JS only**: `eslint.config.js` targets `src/**/*.js` and `test/**/*.js`, but the project is TypeScript. Without `@typescript-eslint`, lint passes silently on `.ts` files, giving false confidence in static analysis coverage.

## Baseline Review

- **Architecture/implementation gap** — `docs/architecture.md` documents three core modules (`ContextArtifactStore`, `SurrogateBuilder`, `ContextRanker`) that have no implementation. The public API shape is incomplete relative to what the project describes itself as.

- **Token estimation is a silent liability** — `estimateTokens` uses a hardcoded `/ 4` character heuristic (`src/input.ts:27-29`) with no abstraction boundary. Swapping to a real tokenizer requires touching every call site, and miscounts directly corrupt the governor's core budget decisions.

- **`claude.ts` bleeds into the public API** — `src/index.ts:11` does `export * from './claude.js'`, exposing `runClaudeBenchmark`, `runClaudeReviewComparison`, and other internal CLI helpers as library surface. Consumers get a noisy, unstable API they didn't ask for.

- **Unguarded `JSON.parse` on subprocess output** — `parseClaudeResult` calls `JSON.parse(stdout)` without try/catch (`src/claude.ts:42-86`). Any non-JSON output from the Claude CLI (errors, warnings, version mismatches) throws an unhandled exception at the library boundary.

- **Hardcoded `--permission-mode bypassPermissions`** — `runClaudeBenchmark` unconditionally passes this flag (`src/claude.ts:108`). Callers have no way to opt out, and it silently elevates privilege for every benchmark invocation without documented intent.

- **Security posture is solid on supply chain** — zero runtime dependencies eliminates the primary npm attack surface. CI runs `npm audit` and Gitleaks on every push/PR, which is appropriate for a tool that handles LLM orchestration context.

## Optimized Review

- **Architecture gap**: `ContextArtifactStore` is defined in the architecture doc and referenced as a core module, but absent from the actual source — the surrogate/replacement pipeline has no persistent artifact layer yet, leaving a major planned component unimplemented.

- **Test feedback loop**: `pretest` compiles TypeScript before every test run (`npm run build`). Tests run against `dist/`, not source — slower iteration and test errors may lag behind source changes by one compile cycle.

- **Supply chain exposure**: CI actions use floating major tags (`actions/checkout@v4`, `gitleaks/gitleaks-action@v2`) rather than pinned SHAs. A compromised tag could silently execute malicious code in the pipeline.

- **Config merge on every call**: `ContextGovernor.optimize()` calls `mergeGovernorConfig` on every invocation, rebuilding effective config per call. At high throughput this is unnecessary overhead; config should be resolved once at construction time unless per-call overrides are intentional.

- **No input validation boundary**: `GovernorInput` candidates enter `optimize()` with no schema validation or sanitization. The security doc acknowledges fixture parsing is not hardened — this is the specific gap to close before any untrusted-input path (CLI, future HTTP integration) is added.

- **ESLint covers JS only**: `eslint.config.js` targets `src/**/*.js` and `test/**/*.js`, but the project is TypeScript. Without `@typescript-eslint`, lint passes silently on `.ts` files, giving false confidence in static analysis coverage.
