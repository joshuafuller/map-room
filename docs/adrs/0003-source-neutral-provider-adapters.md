# ADR-0003: Keep the core source-neutral through provider adapters

Status: Accepted

## Context

Geofabrik and OpenStreetMap are useful initial sources, but Map Room may also
serve organization-owned archives, imagery, terrain, elevation, commercial
sources, and private catalogs. Embedding PBF or OSM assumptions in selections,
jobs, artifacts, or UI language would make those integrations invasive.

## Decision

Core workflows use provider capabilities and normalized source/artifact
contracts. Provider adapters own discovery, version checks, acquisition,
authentication, provider metadata, and policy translation. Version 1 implements
Geofabrik PBF and local MBTiles/PMTiles adapters.

## Consequences

Adapters require a strict conformance suite. Not every source can use every
style, update path, cache, or client. Capability negotiation and explicit
incompatibility are product behavior.

## Alternatives

- OSM-first domain model with later abstractions: rejected because provider
  assumptions would already persist in state and interfaces.
- Universal lowest-common-denominator source: rejected because it would erase
  important licensing, schema, and update differences.

## Links

- Issue #1 requirement update
- MR-PROD-001
- MR-SRC-001 through MR-SRC-015
