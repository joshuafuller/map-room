# ADR-0021: Validate ATAK vector rendering with a Map Room-owned style

## Status

Accepted for device validation

## Context

Static analysis of the supplied ATAK 5.8.0.1 CIV APK found a built-in importer
for MVT and MBTiles, a native GL vector-tile renderer, bundled Mapbox Style
Specification v8 documents and sprites, and a layer-options workflow that
imports a custom JSON or ZIP style and persists it against a vector layer.

That evidence establishes a plausible no-plugin path, but it does not prove
that Map Room's style expressions and assets render correctly on a physical
ATAK device. The current browser composition also uses one vector source per
installed regional archive. Publishing those archives independently would
again expose multiple ATAK layers, while naively copying their SQLite tile rows
into one database would discard features where low-zoom tiles overlap.

## Decision

Use one existing Florida OpenMapTiles-compatible MBTiles archive for the first
falsifiable device test. The website exposes the archive without copying it
into source control and generates an ATAK-targeted style document from the
Cyberpunk Map Room theme.

The generated style retains Map Room's authored layers and symbology, selects
the complete Florida layer set from the server's composed runtime style,
collapses it back to exactly one vector source for ATAK's selected tile
container, and rewrites its data, sprite, and glyph locations to absolute URLs
based on the browser-visible Map Room origin. ATAK rejected the first device
artifact because it contained only the background layer; runtime composition
had renamed every authored `osm` source layer to a region-specific source.

The second device result loaded the corrected document and rendered simple
Cyberpunk building fills and outlines, but omitted roads and airport symbols.
ATAK's bundled OMT style documents use the legacy Mapbox v8 dialect: property
names appear directly in filters, zoom functions use `stops` objects, and text
uses token fields. They do not use Map Room's newer MapLibre `get`, `literal`,
`match`, `coalesce`, or `interpolate` expressions.

The ATAK compiler therefore emits a compatibility-specific representation. It
splits roads by hierarchy so each class retains its authored neon color and
zoom-width curve, splits POI and shield categories so each retains its sprite,
uses the dedicated `aerodrome_label` source layer for airport symbols, and
converts runways, taxiways, filters, labels, and remaining zoom functions to
the syntax demonstrated by ATAK's bundled style. The browser and raster styles
remain unchanged.

The operator imports the MBTiles archive, opens that vector layer's style
options, and imports the generated JSON. Physical-device results must record
import success, custom colors and symbols, sharp zoom behavior, and offline
behavior separately from the static APK findings.

## Consequences

This provides a small test artifact using every critical production primitive:
real vector data, ATAK's built-in renderer, Map Room styling, sprites, glyphs,
and offline tile storage. It requires two explicit imports during validation.

It does not yet satisfy simultaneous-region production delivery. After device
validation, selected upstream PBF inputs must be rendered together into one
MBTiles archive so shared low-zoom tiles contain all features and ATAK exposes
one logical layer. A plugin or remote vector descriptor remains unnecessary
unless the physical test disproves the built-in workflow.

## Rejected alternatives

- Claim support from APK strings or decompiled code alone: rejected because it
  does not exercise ATAK's importer or renderer.
- Merge existing regional MBTiles with SQLite row replacement: rejected because
  overlapping tile coordinates would silently discard regional features.
- Build an ATAK plugin first: deferred because ATAK already exposes local vector
  import and custom style selection.
- Convert the style to raster: rejected because this decision specifically
  validates native vector sharpness and Map Room-controlled symbology.
