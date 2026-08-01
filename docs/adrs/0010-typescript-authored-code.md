# ADR-0010: Consolidate authored executable code in TypeScript

Status: Proposed

## Context

The prototype spreads behavior across browser JavaScript, Node JavaScript,
Python, and shell. Achieving meaningful 100% branch/function/line/statement
coverage and sharing versioned contracts is harder across those boundaries.

## Decision

Implement version 1 application, CLI, generators, migrations, providers, API,
worker, and browser domain logic in strict TypeScript on a pinned supported Node
LTS runtime. Keep shell/container files declarative and move behavior into
covered modules. Generated JavaScript and third-party assets are artifacts.

## Consequences

The build pipeline becomes required and browser code needs bundling. Native
geospatial tools remain external pinned subprocesses behind adapters. A single
coverage stack can enforce all four metrics across most authored behavior.

## Alternatives

- Preserve JavaScript/Python/shell mix: rejected because shared contracts and
  coverage policy become fragmented.
- Rewrite everything in Go or Rust: rejected because it discards the useful
  web/Node prototype without a demonstrated operational need.

## Links

- Issue #1
- MR-QUAL-010 through MR-QUAL-014
