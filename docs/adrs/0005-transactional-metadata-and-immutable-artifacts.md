# ADR-0005: Store transactional metadata in SQLite and maps as immutable files

Status: Proposed

## Context

Selections, jobs, events, versions, and publication pointers require atomic
constraints and crash recovery. Map archives are large immutable files and do
not belong in relational blobs. The prototype JSON state store cannot safely
coordinate multiple processes or migrations.

## Decision

Use SQLite with explicit migrations and transactions for structured metadata.
Use a managed filesystem for staged inputs and immutable artifacts identified by
internal IDs and checksums. Publish through validated release directories and
atomic pointers/configuration.

## Consequences

Backup/restore includes both stores and must preserve their relationship.
SQLite write concurrency remains intentionally bounded. Network filesystems
require explicit validation and are not assumed safe.

## Alternatives

- JSON files: rejected for concurrency, constraints, and migrations.
- PostgreSQL: deferred because it adds administration beyond version 1 needs.
- Store archives in SQLite: rejected due to file size and serving patterns.

## Links

- Issue #1
- MR-SYS-007 through MR-SYS-009
