# Delivery-interface specification

Status: Draft for issue #1

## General HTTP contract

- **MR-API-001.** JSON APIs MUST live below `/api/v1` and use documented,
  additive-compatible schemas within version 1.
- **MR-API-002.** Mutation requests MUST support an idempotency key or an
  equivalent resource-identity guarantee.
- **MR-API-003.** Errors MUST use a common envelope containing stable code,
  message, correlation ID, retryability, and field details where applicable.
- **MR-API-004.** Timestamps MUST be RFC 3339 UTC. Byte counts MUST be integers.
  Durations MUST use seconds or an explicitly named unit.
- **MR-API-005.** IDs MUST be opaque strings and URL encoded by clients.
- **MR-API-006.** Pagination MUST be deterministic and cursor based when a
  collection can grow beyond one response.
- **MR-API-007.** Protected endpoints MUST reject unauthenticated requests
  before disclosing provider credentials, paths, or diagnostic internals.

## Control API resources

The version 1 control API MUST provide these logical resources; exact schemas
are frozen by issue-scoped contract tests before implementation.

```text
GET    /api/v1/providers
GET    /api/v1/providers/{providerId}/items
GET    /api/v1/providers/{providerId}/items/{itemId}
GET    /api/v1/selections
PUT    /api/v1/selections/{selectionId}
DELETE /api/v1/selections/{selectionId}
POST   /api/v1/reconcile
GET    /api/v1/jobs
GET    /api/v1/jobs/{jobId}
POST   /api/v1/jobs/{jobId}/cancel
GET    /api/v1/maps
GET    /api/v1/maps/{mapId}
POST   /api/v1/maps/{mapId}/rollback
DELETE /api/v1/maps/{mapId}
GET    /api/v1/settings
PATCH  /api/v1/settings
GET    /api/v1/events
```

- **MR-API-010.** Selection updates MUST return desired state and any resulting
  reconciliation job IDs.
- **MR-API-011.** Deletion MUST distinguish disabling a selection, removing a
  publication, and purging retained artifacts.
- **MR-API-012.** Reconcile MUST be safe to call repeatedly.
- **MR-API-013.** Job responses MUST expose phase, state, byte progress, rate,
  elapsed time, ETA confidence/state, attempts, warnings, and error details.
- **MR-API-014.** Cancellation is a request until the worker reaches a safe
  cancellation point; the API MUST distinguish requested from completed.
- **MR-API-015.** Settings changes MUST validate bounds and report whether they
  require reconciliation or restart.

## Event stream

Version 1 uses Server-Sent Events for one-way UI updates.

- **MR-API-020.** Events MUST have monotonically ordered durable IDs within one
  installation.
- **MR-API-021.** Reconnection with `Last-Event-ID` MUST replay retained events
  or explicitly instruct the client to refresh snapshots.
- **MR-API-022.** Event types MUST be versioned and payloads MUST include the
  affected resource ID and current revision.
- **MR-API-023.** Progress events MAY be coalesced, but terminal transitions
  MUST be durable and delivered.
- **MR-API-024.** Events MUST NOT contain credentials, raw authorization
  headers, or unredacted provider URLs containing secrets.

## Public map catalog and manifest

```text
GET /api/v1/public/maps
GET /api/v1/public/maps/{mapId}
GET /api/v1/public/maps/{mapId}/manifest
```

- **MR-MAN-001.** A manifest MUST identify the stable map, active artifact,
  source lineage, timestamps, checksums, bounds, zooms, content kind, format,
  tile scheme, schema, styles, endpoints, attribution, license, and tool
  versions.
- **MR-MAN-002.** Unknown values MUST be `null` or absent according to schema;
  they MUST NOT be replaced with acquisition time or guessed defaults.
- **MR-MAN-003.** Manifests MUST be immutable for an artifact and separately
  addressable after a newer artifact is published.
- **MR-MAN-004.** The active-map response MUST identify its revision so caches
  and clients can detect promotion.

## Tile and style endpoints

Public paths use stable map and style IDs:

```text
GET /maps/{mapId}/manifest.json
GET /maps/{mapId}/vector/{z}/{x}/{y}.pbf
GET /maps/{mapId}/styles/{styleId}/style.json
GET /maps/{mapId}/styles/{styleId}/xyz/{z}/{x}/{y}.png
GET /maps/{mapId}/styles/{styleId}/tms/{z}/{x}/{y}.png
GET /maps/{mapId}/styles/{styleId}/tilejson.json
GET /maps/{mapId}/styles/{styleId}/wmts.xml
GET /maps/{mapId}/atak/{styleId}.xml
```

Endpoints MUST exist only when declared by the map capability document.

- **MR-TILE-001.** XYZ uses a top-left origin and increasing Y toward the south.
- **MR-TILE-002.** Strict TMS uses the OSGeo lower-left-origin row convention;
  for Web Mercator zoom `z`, `y_xyz = (2^z - 1) - y_tms`.
- **MR-TILE-003.** XYZ and strict TMS MUST have different explicit paths and
  metadata. The product MUST NOT label an XYZ route as TMS.
- **MR-TILE-004.** Coordinates outside the matrix, unsupported zooms, missing
  maps/styles, and missing tiles MUST have tested status/cache behavior.
- **MR-TILE-005.** Raster output MUST declare image format, pixel dimensions,
  bounds, zoom range, attribution, and cache validators.
- **MR-TILE-006.** Vector output MUST declare media type, encoding, schema, and
  compatible style versions.
- **MR-TILE-007.** Tile responses MUST use immutable or revision-aware cache
  keys so promotion cannot mix artifacts.
- **MR-TILE-008.** WMTS capabilities MUST describe the same published artifact
  and tile matrix semantics as its corresponding endpoints.
- **MR-TILE-009.** Browser raster preview MUST request the exact public endpoint
  and scheme it claims to preview.

TileServer GL documents rendered tile paths and PNG/JPEG/WebP formats at
<https://tileserver.readthedocs.io/en/latest/endpoints.html>. The OSGeo TMS
baseline is at
<https://wiki.osgeo.org/wiki/Tile_Map_Service_Specification>. Map Room's public
contract is its own stable gateway contract and MUST be adapter-tested against
the selected underlying tile service.

## Style contract

- **MR-STYLE-001.** Each style MUST have stable ID, display name, semantic
  version, compatible artifact schema range, theme tokens, and attribution.
- **MR-STYLE-002.** Shared layer ordering, expressions, fonts, sprites, and
  zoom rules MUST have one source of truth; generated style JSON is an artifact.
- **MR-STYLE-003.** A style MUST NOT be offered for an incompatible map schema.
- **MR-STYLE-004.** Every released style MUST have approved reference images
  across the representative place/zoom matrix.
- **MR-STYLE-005.** Daylight, Midnight, Tactical Canvas, and High Contrast MUST
  be independently reviewed; names describe visual treatment, not data content
  or military endorsement.

## Compatibility and deprecation

Breaking HTTP or manifest changes require a new API or artifact schema version,
an ADR, migration guidance, and a deprecation issue. Generated configuration
formats MAY evolve independently but MUST record generator and schema versions.
