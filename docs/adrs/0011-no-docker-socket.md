# ADR-0011: Do not mount the host Docker socket

Status: Proposed

## Context

A convenient prototype can launch Planetiler containers through the host Docker
socket, but socket access is effectively host-level control and makes deployment
and authorization unsafe.

## Decision

Package required build tools into a dedicated worker image/process. The control
plane enqueues structured jobs; the worker invokes pinned tools within its own
constrained environment and shared managed storage. Map Room never requires a
host Docker socket.

## Consequences

The worker image is larger and must be rebuilt for tool upgrades. Resource
limits and subprocess behavior are testable and deployment privileges remain
bounded.

## Alternatives

- Mount `/var/run/docker.sock`: rejected on security grounds.
- Require host-installed Planetiler: rejected as the only supported path, but a
  developer adapter may exist.
- Remote arbitrary command runner: rejected.

## Links

- Issue #1
- MR-SEC-009
