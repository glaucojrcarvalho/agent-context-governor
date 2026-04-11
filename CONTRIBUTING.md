# Contributing

## Current Stage

This project is still early.

The current priorities are:

- validate the architecture
- improve benchmark scenarios
- make optimization rules more realistic
- prepare the repository for public iteration

## How To Contribute

Useful early contributions:

- benchmark scenarios from real agent workflows
- better artifact classification
- safer replacement heuristics
- runtime integration ideas
- docs improvements

## Contribution Guidelines

- keep changes small and reviewable
- prefer explicit heuristics over vague magic
- document any new optimization rule
- avoid hidden behavior that makes savings hard to audit
- include benchmark impact when possible

## Development

Planned local workflow:

```bash
npm install
npm run check
npm run build
npm run bench
```

## Discussion Standard

This project should stay pragmatic.

Claims about token savings should be tied to:

- a benchmark scenario
- a clear before/after comparison
- an explanation of the rule that caused the difference
