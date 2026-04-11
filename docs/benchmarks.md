# Benchmarks

## Purpose

This document defines how the project should prove savings claims.

## Baseline Questions

- How many tokens are sent without optimization?
- Which artifact types dominate token usage?
- How much token waste comes from subagent inheritance?
- What latency overhead does optimization introduce?

## Initial Benchmark Dimensions

- baseline tokens
- optimized tokens
- saved tokens
- savings percentage
- runtime overhead
- task quality notes

## Current Reality

The repository already supports two benchmark layers:

1. offline scenario comparison using projected token estimates
2. real Claude comparison using the local `claude` CLI

Current caution:

- raw cache-token totals from Claude are not yet reliable enough to be the primary savings metric across runs
- cost deltas and non-cache input deltas are easier to compare honestly today
- review-quality retention still needs stronger evaluation than exact bullet overlap

## First Benchmark Scenarios

1. Large file-read heavy debugging task
2. Search-heavy refactor task
3. Shell-log heavy test-fix task
4. Multi-subagent exploration task

## Reporting Rule

Every benchmark should publish both:

- projected baseline tokens
- actual optimized tokens

Without that pair, "tokens saved" is not credible.

## Near-Term Improvements

- separate cost deltas from token deltas in reports
- distinguish prompt input from cache effects
- preserve a minimum code slice for review-mode comparisons
- add better topic-level quality comparison
