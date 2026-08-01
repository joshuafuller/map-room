# ADR-0007: Expose XYZ, strict TMS, and WMTS explicitly

Status: Proposed

## Context

The term TMS is often used informally for any tiled raster URL, but OSGeo TMS
uses a lower-left origin while common XYZ uses a top-left origin. Conflation can
produce geographically wrong tiles that still return HTTP 200.

## Decision

Use separate stable `/xyz/` and `/tms/` endpoints with tested Y conversion.
Expose WMTS when the backing tile service can describe the same artifact.
Metadata and client configuration must name the actual scheme. Browser preview
must use the exact endpoint it labels.

## Consequences

The gateway owns a durable public protocol independent of TileServer GL paths.
Coordinate transformation and negative orientation tests become release gates.

## Alternatives

- Call XYZ “TMS” for TAK familiarity: rejected as technically ambiguous.
- Publish only XYZ: rejected because the user explicitly needs browser-testable
  TMS and interoperable clients.
- Publish only WMTS: rejected because simple template clients need direct tiles.

## Links

- Issue #1
- MR-TILE-001 through MR-TILE-009
