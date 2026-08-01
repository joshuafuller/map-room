# ADR-0001: Record consequential architecture decisions

Status: Accepted

## Context

Map Room combines provider integration, long-running work, storage, map
protocols, rendering, offline operation, and external clients. Decisions can
outlive their original context and otherwise become accidental constraints.

## Decision

Use ADRs for decisions that materially affect module boundaries, data
durability, protocols, security, deployment, provider compatibility, testing,
or irreversible migration. Every ADR records context, decision, consequences,
alternatives, and issue links. Accepted ADRs are superseded, not rewritten.

## Consequences

Pull requests must cite affected ADRs or explain why no ADR is needed. This adds
small documentation cost and prevents architectural decisions from existing
only in chat or implementation detail.

## Alternatives

- Decisions only in issues: rejected because issues mix planning and enduring
  rationale.
- One living architecture document: retained for system shape but rejected as
  the sole decision history.

## Links

- Issue #1
