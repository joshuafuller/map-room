# ADR-0004: Use a modular monolith with a separate worker process

Status: Proposed

## Context

The application needs coherent domain transactions and a simple deployment,
while downloads and transformations are long-running and resource intensive.
Microservices would increase operational burden; executing jobs inside HTTP
requests would make cancellation and restart recovery unsafe.

## Decision

Build one versioned application with enforced domain modules, deployed as a
control/API process and a separate worker process sharing transactional metadata
and artifact storage. The serving plane remains independently restartable and
continues with the last published release.

## Consequences

Module boundaries need architecture tests. The worker can be scaled only within
the concurrency guarantees of the shared queue. This is not distributed HA.

## Alternatives

- Single process: rejected for lifecycle and resource isolation.
- Independent microservices and broker: deferred until measured scale requires
  them.
- Kubernetes operators: out of version 1 scope.

## Links

- Issue #1
- MR-SYS-001 through MR-SYS-012
