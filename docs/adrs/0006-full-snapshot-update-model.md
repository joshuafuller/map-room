# ADR-0006: Use full immutable snapshot updates in version 1

Status: Proposed

## Context

Replication diffs can reduce transfer/build cost but introduce mutable source
state, sequence gaps, provider-specific recovery, tile invalidation, and harder
rollback. Regional full builds are already feasible for the initial prototype.

## Decision

Version 1 checks source versions and, when changed, acquires a complete snapshot,
builds a new immutable artifact, validates it, and atomically promotes it. Diff
URLs may be discovered but are not consumed.

## Consequences

Large regions consume more bandwidth, time, and temporary storage. The UI must
estimate or honestly report those costs. Incremental updates require a later
ADR supported by measurements showing full rebuilds cannot meet an agreed SLO.

## Alternatives

- Apply Geofabrik replication diffs: deferred.
- Mutate the active archive: rejected because failure and rollback boundaries
  are unacceptable.

## Links

- Issue #1
- MR-SRC-GF-007
- MR-SYS-030 through MR-SYS-034
