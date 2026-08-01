# ADR-0009: Use a REST control API and Server-Sent Events

Status: Proposed

## Context

The maintainer needs ordinary resource operations plus one-way job/status
updates. WebSockets add a bidirectional protocol and recovery semantics that
the current use case does not require.

## Decision

Expose versioned JSON resources and idempotent mutations over HTTP. Stream live
changes with SSE backed by a durable event journal and `Last-Event-ID` recovery.
Clients refresh resource snapshots when replay is unavailable.

## Consequences

SSE connection limits and proxy buffering must be tested. Commands remain HTTP
mutations, making authorization and retries explicit.

## Alternatives

- Polling only: rejected as inefficient and visually stale for progress.
- WebSockets: deferred until a bidirectional low-latency contract exists.
- GraphQL subscriptions: rejected as unnecessary complexity for version 1.

## Links

- Issue #1
- MR-API-001 through MR-API-024
