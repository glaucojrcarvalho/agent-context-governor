# Agent Context Governor

Open-source project to reduce token usage in coding-agent workflows by shaping context before requests are sent.

## Status

Prototype stage. The repository currently provides a governor library, a CLI, and a benchmark harness for comparing raw versus optimized context.

## What This Project Does

Agent Context Governor is a context-shaping layer for agent-style runtimes.

Current capabilities:

- estimate prompt-size pressure from imported context
- rank and filter context candidates under a token budget
- replace bulky artifacts with compact surrogates
- benchmark raw versus optimized context with the local `claude` CLI
- generate repo-review scenarios with a low-friction CLI flow

Current goals:

- estimate next-turn context cost
- rank context by operational value
- preserve review quality while reducing token usage
- enforce per-agent budgets more safely
- improve real-world benchmark methodology

## Documents

- [Vision](./docs/vision.md)
- [Architecture](./docs/architecture.md)
- [Roadmap](./docs/roadmap.md)
- [Benchmarks](./docs/benchmarks.md)
- [Glossary](./docs/glossary.md)

## Getting Started

```bash
npm install
npm run check
npm run lint
npm run build
npm test
npm run bench
npx acg run ./examples/sample-session.json
npx acg import-review --root .
npx acg review-report ./acg-repo-review.json --out ./review-report.md
```

You can run the CLI from the repository after build with:

```bash
npx acg help
npx acg list
npx acg bench
npx acg scenario subagent-debug
npx acg run ./examples/sample-session.json
npx acg import-review --root .
npx acg compare-claude ./examples/sample-session.json
npx acg review-report ./acg-repo-review.json --out ./review-report.md
```

## Current Limits

- this is not yet a live runtime integration
- token estimates are still heuristic
- real Claude benchmarks are useful, but cache-token totals are not yet a stable primary metric
- quality preservation for review-style tasks still needs work

## Repository Basics

- [License](./LICENSE)
- [Contributing](./CONTRIBUTING.md)

## Configuration

The prototype now includes a small config layer for:

- budget limits
- replacement-enabled artifact kinds
- replacement token costs
- candidate priority scores

The default config lives in [config.ts](./src/config.ts).
