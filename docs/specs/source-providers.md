# Source-provider specification

Status: Draft for issue #1

## Goal

Providers describe where map inputs come from. Core Map Room logic describes
what those inputs can do. Provider names, URLs, authentication, update
semantics, and licensing MUST NOT leak into generic orchestration contracts.

## Provider capabilities

Each adapter MUST return a machine-readable capability document covering:

- catalog discovery: hierarchical, searchable, paginated, or none;
- acquisition: remote download, local import, range access, or none;
- content: features, vector tiles, raster tiles, imagery, elevation, terrain,
  styles, or metadata;
- formats and versions;
- update model: immutable versions, latest snapshot, conditional request,
  replication diff, manual replacement, or none;
- known size and checksum availability;
- bounds, zooms, coordinate reference system, tile scheme, and tile size;
- license, attribution, caching, transformation, and redistribution policy;
- credential and network requirements;
- resumability and rate-limit semantics.

- **MR-SRC-001.** Core code MUST branch on declared capabilities, never on a
  provider name.
- **MR-SRC-002.** Unknown or unsupported capability combinations MUST fail with
  an incompatibility result before material work begins.
- **MR-SRC-003.** Provider response data MUST be normalized at the adapter
  boundary and retain the original provider payload as optional evidence.
- **MR-SRC-004.** Provider IDs and item IDs MUST be treated as untrusted input
  and MUST NOT directly form filesystem paths or subprocess arguments.

## Adapter interface

Every adapter MUST implement the applicable operations:

```text
describeProvider() -> ProviderDescriptor
listItems(cursor?, query?) -> CatalogPage
getItem(providerItemId) -> SourceDescriptor
checkVersion(providerItemId, installedVersion?) -> VersionResult
planAcquisition(providerItemId, version) -> AcquisitionPlan
acquire(plan, destination, progress, cancellation) -> SourceSnapshot
validateSnapshot(snapshot) -> ValidationReport
```

Unsupported optional operations MUST return a typed unsupported-capability
result.

- **MR-SRC-010.** Adapter contract tests MUST run unchanged against every
  provider implementation.
- **MR-SRC-011.** Network adapters MUST support timeouts and cancellation and
  MUST classify HTTP status, transport, integrity, and policy failures.
- **MR-SRC-012.** Redirects MUST be bounded and final origins MUST be checked
  against provider policy.
- **MR-SRC-013.** Downloads MUST use staging paths and atomic finalization.
- **MR-SRC-014.** When a provider supplies a checksum, acquisition MUST verify
  it before a snapshot becomes usable.
- **MR-SRC-015.** When no provider checksum exists, Map Room MUST compute and
  record its own content checksum without implying upstream authenticity.

## Initial adapter: Geofabrik

The Geofabrik adapter uses the versioned no-geometry index and `.osm.pbf`
downloads. Geofabrik documents the index ID, parent, name, ISO arrays, PBF URL,
and update-directory URL, and states that the versioned structure remains
stable.

- **MR-SRC-GF-001.** Catalog identity MUST use Geofabrik `id`, not display name
  or URL-derived labels.
- **MR-SRC-GF-002.** Catalog hierarchy MUST use `parent` and tolerate missing
  parents or fields.
- **MR-SRC-GF-003.** ISO fields MUST be treated as arrays.
- **MR-SRC-GF-004.** Only entries with a PBF URL are selectable by the PBF
  adapter.
- **MR-SRC-GF-005.** The UI MUST display provider-reported PBF size when known;
  otherwise it MUST label size unknown until metadata is obtained.
- **MR-SRC-GF-006.** Version checks SHOULD use stable provider metadata such as
  `state.txt`, ETag, Last-Modified, and content length in a documented priority
  order; timestamps alone MUST NOT prove content identity.
- **MR-SRC-GF-007.** Version 1 MUST use full immutable regional rebuilds. It MAY
  discover update directories but MUST NOT apply replication diffs.
- **MR-SRC-GF-008.** Download policy SHOULD prefer a stable timestamped URL when
  the provider exposes one and resumability matters; use of `latest` MUST record
  the resolved response metadata.
- **MR-SRC-GF-009.** Geofabrik/OSM attribution and ODbL obligations MUST be
  propagated to derived artifacts and public metadata.

Authoritative reference: <https://download.geofabrik.de/technical.html>

## Initial adapter: local archive import

The local adapter provides a source-neutral path for organization-owned or
third-party artifacts without pretending they came from Geofabrik.

- **MR-SRC-LOCAL-001.** Version 1 MUST accept supported MBTiles and PMTiles
  files through an explicit import workflow.
- **MR-SRC-LOCAL-002.** The importer MUST inspect format, metadata, tile kind,
  scheme, bounds, zooms, and schema before offering publication choices.
- **MR-SRC-LOCAL-003.** Missing license, attribution, source, or update metadata
  MUST be shown and resolved by the maintainer; it MUST NOT be invented.
- **MR-SRC-LOCAL-004.** An imported file MUST be copied or atomically adopted
  into managed storage before publication; Map Room MUST NOT depend on a
  removable source path remaining present.
- **MR-SRC-LOCAL-005.** Imports without an update source remain manual-update
  selections.
- **MR-SRC-LOCAL-006.** Applying Map Room themes MUST require a declared and
  validated compatible vector schema.

## Future adapters

Remote raster, WMTS, COG/GeoTIFF, elevation, terrain, and authenticated private
catalog adapters are separate release scopes. Each requires an ADR if it adds a
new artifact class, credential model, or redistribution policy.

## Provider conformance suite

The shared suite MUST cover descriptor validation, hostile identifiers,
pagination, missing optional fields, cancellation, timeouts, redirects,
partial downloads, unknown length, checksum match/mismatch, changed content,
unchanged version, policy rejection, secret redaction, and deterministic error
classification.
