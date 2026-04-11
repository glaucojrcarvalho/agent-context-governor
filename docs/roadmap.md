# Roadmap

## Phase 0: Documentation

Goal:
Define the product clearly enough to build without drifting.

Deliverables:

- project README
- vision document
- architecture document
- roadmap

Status: completed

## Phase 1: Baseline Measurement

Goal:
Measure current token waste patterns before optimizing.

Deliverables:

- token accounting model
- baseline benchmark scenarios
- artifact taxonomy
- first savings report format

Questions:

- Which artifact types dominate token waste?
- How much waste comes from subagent inheritance?
- What is the latency overhead budget for optimization?

Status: mostly completed

## Phase 2: Minimal Governor And CLI

Goal:
Ship the smallest runtime layer that changes behavior.

Deliverables:

- `ContextGovernor`
- `ContextBudgetPolicy`
- `SavingsReporter`
- CLI flows for `run`, `import`, `import-review`, and review benchmarking

Scope:

- focus on subagent context slicing
- support file read, grep, and shell-output replacement first
- emit before/after metrics

Status: in progress

## Phase 3: Quality-Preserving Review Mode

Goal:
Improve quality retention for review-style tasks without losing the value of the benchmark harness.

Deliverables:

- review-safe preservation policy
- better metric separation for prompt tokens, cache tokens, and cost
- improved overlap reporting by topic
- lower-friction repo benchmark flow

## Phase 4: Snapshot Replacement

Goal:
Collapse stale transcript regions into compact snapshots.

Deliverables:

- snapshot builder
- transcript replacement rules
- replay and traceability support

## Phase 5: Runtime Integrations

Goal:
Prove the design works in a real coding-agent runtime.

Deliverables:

- first deep integration
- benchmark report
- public examples

## Phase 6: Open-Source Growth

Goal:
Make the project easier to use and evaluate.

Deliverables:

- public benchmarks
- demo recordings
- integration guides
- issue templates
- contribution guidelines
