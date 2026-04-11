# Vision

## Problem

Coding agents waste tokens in predictable ways:

- replaying large file reads
- replaying large search outputs
- replaying shell logs
- copying too much parent transcript into subagents
- keeping stale conversational history in active context

Most current tools either report these costs after the fact or require users to manually switch to wrapper commands.

That is not enough.

## Goal

Build an open-source context-routing layer that sits inside agent runtimes and automatically reduces token waste while preserving task quality.

The system should feel invisible during normal usage:

- the developer works normally
- the runtime shapes context automatically
- the savings are measurable
- the behavior is understandable

## Who This Is For

- developers using coding agents heavily
- teams running multi-agent workflows
- tool builders building agent runtimes
- researchers benchmarking prompt and context efficiency

## Design Constraints

- must be inspectable
- must be benchmarkable
- must be safe by default
- must degrade gracefully under context pressure
- must not silently destroy task-critical state

## Non-Goals

- vague AI productivity claims
- black-box compression without visibility
- broad multi-runtime support before one excellent integration
