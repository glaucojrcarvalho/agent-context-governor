# Architecture

## Overview

Agent Context Governor is currently a prototype library plus benchmark harness.

The intended long-term direction is deeper runtime integration at the point where an agent runtime is about to assemble and send model context.

## Core Flow

1. Gather candidate context.
2. Estimate token pressure.
3. Classify context by type and value.
4. Apply optimization policies.
5. Emit final context payload.
6. Record savings metrics.

## Core Modules

### `ContextArtifactStore` (planned)

Stores bulky artifacts separately from the prompt payload.

Examples:

- file read outputs
- grep outputs
- shell logs
- diagnostics
- web content

Responsibilities:

- persist artifacts by ID
- expose compact metadata
- expose summary payloads
- allow expansion when the runtime explicitly needs the full artifact again

### `ContextGovernor` (implemented)

Main orchestration layer.

Responsibilities:

- accept raw context candidates
- run estimation
- call ranking and replacement policies
- produce the optimized context payload
- emit decisions and savings metrics

### `ContextBudgetPolicy` (implemented)

Defines how much context may be sent for a turn or subagent.

Responsibilities:

- enforce hard and soft token budgets
- handle per-agent overrides
- choose which classes of context degrade first

### `ContextRanker` (implicit today, explicit later)

Ranking is currently embedded in comparison and evaluation rules. A standalone ranker is still planned.

Likely high-value inputs:

- active task objective
- recent file edits
- current errors
- latest tool calls
- task-specific memory

Likely lower-value inputs:

- old search output
- repeated file reads
- long shell logs already resolved
- stale chat history

### `SurrogateBuilder` (partially implemented)

Surrogate building currently exists as fixed rule-based replacement strings. A richer structured surrogate builder is still planned.

Examples:

- "Read `src/foo.ts` previously; key exports: X, Y, Z"
- "Search result set stored as artifact `grep_17`; 32 matches across 5 files"
- "Shell output summarized: build failed in a test file due to a missing configuration value"

### `SavingsReporter` (implemented)

Measures optimization effect.

Metrics:

- projected baseline tokens
- actual tokens sent
- saved tokens
- savings percentage
- latency overhead

## Data Model

Initial conceptual types:

- `ContextArtifact`
- `ContextCandidate`
- `ContextSummary`
- `OptimizationDecision`
- `BudgetResult`
- `SavingsReport`

## Current Integration Surface

The repository currently exposes:

1. a library-level governor
2. a CLI for synthetic and imported scenarios
3. a real benchmark path using the local `claude` CLI

## Future Integration Points

The most valuable runtime hooks are:

1. before a main agent request is sent
2. before a subagent request is forked
3. when a tool result is ingested
4. when older transcript regions become stale

## Prototype Notes

Current constraints:

- token estimation is heuristic
- review-safe preservation rules are still evolving
- the benchmark harness is more mature than the runtime integration story
- exact quality comparison between raw and optimized reviews is still noisy

## MVP Architecture

The first version should stay simple:

- artifact storage in local files or memory
- heuristic ranking, not ML ranking
- explicit replacement rules for known bulky artifact types
- one runtime integration first

## Safety Rules

- never drop the current task objective
- never drop recent write/edit intent
- never compact unresolved error state out of existence
- keep a trace of every optimization decision
- support debug mode to inspect before/after context

## Benchmark Harness

The architecture should include a repeatable benchmark mode.

The benchmark should compare:

- baseline runtime behavior
- optimized runtime behavior

Across each run, record:

- token usage
- latency
- tool count
- final task outcome quality
