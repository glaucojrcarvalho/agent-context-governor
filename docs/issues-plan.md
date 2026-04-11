# Initial Issue Plan

This document captures the first public work items that should exist as GitHub issues.

## 1. Add Review-Safe Preservation Policy

Why:
The current governor can reduce token usage substantially, but review quality still drifts too much when code context is compressed too aggressively.

Target:

- preserve a minimum set of implementation files for review tasks
- separate review-mode rules from generic budget rules
- document the preservation strategy

## 2. Improve Benchmark Metrics

Why:
Real Claude benchmark runs currently mix prompt tokens, cache effects, and cost in ways that can be misleading.

Target:

- report prompt input deltas separately from cache-token effects
- emphasize cost delta as a more stable real-world metric
- stop presenting unstable aggregate values as the primary signal

## 3. Add Input Validation At Public Boundaries

Why:
Imported scenarios and future integrations should reject malformed or abusive input before it reaches optimization logic.

Target:

- validate imported scenario structure
- validate governor input at public entry points
- add tests for malformed input

## 4. Add Type-Aware Linting

Why:
The repository is TypeScript, but current lint coverage is still shallow.

Target:

- add `typescript-eslint`
- lint `.ts` files directly
- keep the ruleset small and practical

## 5. Pin GitHub Actions By SHA

Why:
Current CI uses floating action tags. That is acceptable early on, but not ideal for supply-chain hygiene.

Target:

- pin workflow actions to immutable SHAs
- document update process

## 6. Build A Better Quality Comparison Report

Why:
Exact bullet overlap is too brittle for comparing two independent reviews.

Target:

- improve topic matching
- group findings by area
- highlight likely equivalent findings with different wording
