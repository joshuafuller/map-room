# Product specification

Status: Draft for issue #1

## Product statement

Map Room is a self-hosted map distribution and lifecycle-management system. It
lets a non-specialist choose map sources, acquire or build immutable regional
map artifacts, keep them current, inspect them in a browser, and distribute
compatible vector or raster tiles to web, GIS, offline, and TAK clients.

Map Room is source-neutral. OpenStreetMap and Geofabrik are initial
integrations, not the product identity.

## Users

### Maintainer

A person responsible for making maps available. They may understand the areas
they need but MUST NOT need to understand PBF, MBTiles, tile matrices, Docker,
or rendering pipelines for routine operation.

### Browser user

A person who opens Map Room, chooses an available map and style, and navigates
without installing specialist software.

### Offline user

A browser, device, or team using Map Room on an isolated or intermittently
connected network, or carrying an explicitly prepared bounded map package.

### TAK user

An ATAK user who imports a supported map source, views Map Room raster tiles,
and deliberately caches a bounded area for disconnected use.

### Integrator

A technical user who consumes documented TileJSON, XYZ, TMS, WMTS, style,
manifest, health, or administrative interfaces.

## Product principles

- **MR-PROD-001 — Source neutrality.** Core product language and domain logic
  MUST describe providers and artifacts, not assume OpenStreetMap semantics.
  Verification: architecture tests and terminology review.
- **MR-PROD-002 — Novice-safe operation.** Routine installation, selection,
  synchronization, status inspection, and recovery MUST be possible through a
  guided interface without command-line knowledge. Verification: usability
  acceptance test with a first-time user script.
- **MR-PROD-003 — Explicit provenance.** Every published map MUST expose its
  provider, source identity, source timestamp when available, acquisition time,
  transformation chain, artifact checksum, style/schema compatibility, license,
  and attribution. Verification: manifest contract tests.
- **MR-PROD-004 — Last-known-good service.** A failed acquisition, build,
  validation, or update MUST NOT replace a working published artifact.
  Verification: fault-injection integration tests.
- **MR-PROD-005 — Honest capability labels.** The UI and documentation MUST
  distinguish vector, XYZ raster, strict TMS, WMTS, server-offline, device
  cache, and downloadable package behavior. Verification: copy and endpoint
  contract tests.
- **MR-PROD-006 — Bounded resource choices.** Before starting material work,
  the maintainer MUST see known source size and a clearly labeled estimate or
  unknown state for download, build, storage, and time. Verification: UI and
  estimator tests.
- **MR-PROD-007 — Modular evolution.** Providers, transformers, validators,
  publishers, renderers, styles, clients, and storage implementations MUST be
  replaceable behind versioned contracts. Verification: adapter conformance
  tests.
- **MR-PROD-008 — No hidden network dependency.** An isolated deployment MUST
  serve its UI, fonts, styles, metadata, vector tiles, and raster tiles without
  public network access. Verification: egress-blocked system test.
- **MR-PROD-009 — Accessible visual quality.** Supported themes MUST be
  intentionally designed, versioned, visually reviewed, and usable with
  keyboard and common assistive technology. Verification: visual, contrast,
  accessibility, and browser tests.
- **MR-PROD-010 — Safe automation.** Startup reconciliation and scheduled
  updates MUST be observable, cancellable at safe boundaries, recoverable, and
  subject to storage/concurrency limits. Verification: state-machine and
  recovery tests.
- **MR-PROD-011 — Attribution and use constraints.** Provider license,
  attribution, redistribution, caching, and credential rules MUST travel with
  the source and MUST be enforced by compatible publication paths.
  Verification: policy and negative-path tests.
- **MR-PROD-012 — No silent destructive action.** Removal, replacement,
  rollback, and retention operations MUST identify affected maps and recovery
  consequences before execution. Verification: UI and API tests.

## Version 1 outcomes

- A maintainer can search a Geofabrik catalog and select multiple extracts.
- A maintainer can import a compatible local MBTiles or PMTiles artifact.
- Selected sources reconcile on startup and on a configurable schedule.
- Downloads and builds show phase, bytes, percent when knowable, rate, elapsed
  time, ETA when defensible, warnings, and recovery actions.
- Multiple compatible maps are published concurrently without merging their
  source datasets.
- A browser user can switch map and style and preview the exact raster endpoint
  intended for ATAK.
- Compatible vector maps support Daylight, Midnight, Tactical Canvas, and High
  Contrast themes from one versioned style system.
- Clients can discover vector, XYZ raster, strict TMS, WMTS, style, manifest,
  and attribution interfaces when the map's capabilities support them.
- An isolated deployment continues serving all installed maps with egress
  blocked.
- ATAK support is released only for explicitly validated ATAK/device profiles.

## Version 1 non-goals

- Planet-scale builds or minute-level replication.
- Combining overlapping provider regions into one seamless logical dataset.
- Routing, geocoding, TAK messaging, blue-force tracking, or annotation sync.
- Editing upstream map data.
- Arbitrary polygon extraction.
- Unlicensed capture or redistribution of third-party online tiles.
- Claiming satellite, terrain, elevation, or contours from a street-vector
  source that does not contain those capabilities.
- Kubernetes or multi-node high availability.
- Silent background downloads with unbounded storage impact.

## Future-compatible source families

The architecture MUST leave explicit paths for:

- PBF or other feature sources transformed into vector tile archives;
- compatible vector or raster MBTiles/PMTiles imports;
- licensed remote raster/WMTS sources with explicit caching permissions;
- GeoTIFF/COG imagery transformed into raster artifacts;
- elevation, hillshade, terrain, and contour sources;
- organization-owned and authenticated catalogs.

Each source family remains unavailable until its adapter, license policy,
validator, and client compatibility tests are complete.

## Product success measures

- A first-time maintainer completes a two-region setup without documentation or
  command-line assistance.
- A failed update leaves all previously ready maps available.
- Operators can explain the age and origin of every published map from the UI.
- The isolated-runtime suite detects every attempted public dependency.
- Supported ATAK profiles pass import, online display, bounded download, and
  airplane-mode display tests.
- Every release has zero uncovered authored statements, branches, functions,
  and lines.
