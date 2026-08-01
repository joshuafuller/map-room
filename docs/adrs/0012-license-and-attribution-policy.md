# ADR-0012: Treat license and attribution as artifact policy

Status: Accepted

## Context

Different map providers allow different transformation, caching, and
redistribution behavior. Reachability does not grant permission, and derived
tiles must retain required attribution and provenance.

## Decision

Attach normalized license/attribution/caching/transformation/redistribution
policy to every source snapshot and derived artifact. Validators block
publication when required policy is missing or incompatible. Display and
machine-readable outputs propagate attribution where supported.

## Consequences

Some technically usable sources will be rejected until a maintainer supplies
or verifies policy. Provider adapters need policy translation tests.

## Alternatives

- Put attribution only in UI copy: rejected because artifacts and other clients
  escape that surface.
- Treat all URLs as cacheable: rejected.

## Links

- Issue #1
- MR-PROD-011
- MR-LIC-001 through MR-LIC-004
