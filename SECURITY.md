# Security Policy

## Scope

This project is an early-stage open-source library and CLI for context optimization in coding-agent workflows.

Security issues are taken seriously, especially in areas related to:

- dependency safety
- malicious input handling
- unsafe file or shell interactions
- benchmark or fixture parsing
- future runtime integrations

## Reporting

If you find a security issue, do not open a public GitHub issue first.

Please report it privately to the maintainer with:

- a clear description
- impact
- affected versions or commit range
- reproduction steps if possible

Until a dedicated security contact exists, use GitHub private reporting if enabled for the repository.

## Current Security Posture

Current prototype protections:

- no runtime dependencies
- no network-facing server
- no dynamic shell execution in the library itself
- no user-supplied code execution paths in the current CLI

Current limitations:

- the project is still early
- the benchmark and fixture model is not yet hardened for untrusted input
- future integrations must be reviewed carefully before claiming production readiness

## Disclosure Expectations

- acknowledge the report
- validate severity and impact
- prepare a fix
- publish a changelog entry when a fix is released

## Best-Practice Direction

The repository should continue to maintain:

- minimal dependency surface
- CI verification
- dependency update automation
- explicit security review for any future runtime or network integration
