# ADR-0022: Publish stock-ATAK streaming vector sources

## Status

Accepted for device validation

## Context

Map Room originally treated ATAK as a raster client and later exposed a whole
MBTiles archive plus a separate custom style for native-vector testing. That
offline path works with a self-contained archive, but requiring a connected
device to transfer hundreds of megabytes before drawing its first map is not a
streaming-vector product.

Source inspection of ATAK CIV 5.5.1.11 found a registered `tak-cdn` dataset
descriptor that accepts `content: "vector"`, a streaming tile client that
substitutes `{$z}`, `{$x}`, and `{$y}` into an HTTP URL, the native
`GLVectorTiles` renderer, and an offline SQLite cache path. Static analysis of
the supplied ATAK 5.8.0.1 APK found the corresponding implementation and URL
substitution path. This is stronger evidence than strings alone, but it is not
physical-device validation.

ATAK's descriptor is not ordinary TileJSON. It is a small TAK-specific JSON
document whose schema, projected bounds, tile matrix, content type, and metadata
must agree with the published vector tileset. ATAK's custom vector styles also
use an older Mapbox v8 expression dialect than the MapLibre styles authored for
the browser.

The current all-regions browser map composes independently generated regional
archives at style/render time. It is visually one map, but it is not one vector
tile source. Advertising it as a single remote ATAK vector publication would be
false: ATAK would receive either multiple layers or an incomplete source.

## Decision

Treat a vector publication as one immutable, validated vector artifact with a
stable ID, TileJSON document, raw PBF endpoint, provenance manifest, and
compatible style versions. Generate an ATAK `tak-cdn` descriptor from the
publication's actual TileJSON and the browser-visible Map Room origin.

The descriptor uses schema `4.0.0`, `content: "vector"`, EPSG:3857, an implicit
quadtree beginning at zoom zero, the publication's real maximum zoom,
Web-Mercator-projected bounds, vector-tile MIME type, attribution, download/cache
eligibility, and ATAK's built-in OMT schema marker. Its URL points directly to:

```text
/data/{publication}/{$z}/{$x}/{$y}.pbf
```

The exact dollar-prefixed placeholders are part of ATAK's contract. Publication
IDs and origins are validated before being embedded. Query strings, fragments,
credentials, unsafe IDs, malformed bounds, non-PBF sources, missing attribution,
missing vector-layer metadata, and unsupported zoom contracts fail closed.

ATAK 5.8 probes dataset descriptors through an 8 KiB bounded reader. The
descriptor therefore does not duplicate TileJSON's expanded `vector_layers`
field catalog: that made a Florida descriptor exceed the probe limit and ATAK
reported the otherwise valid JSON as unsupported. `styleSchema: "omt"` selects
ATAK's built-in OpenMapTiles schema directly and keeps the import document well
inside the limit.

Map Room generates the descriptor in the browser so the device-reachable origin
matches the address the operator used. This follows ADR-0015. The website offers
four distinct artifacts rather than presenting them as interchangeable:

1. remote ATAK vector descriptor;
2. ATAK-compatible custom style;
3. raster `customMapSource` fallback;
4. optional offline MBTiles archive.

Cyberpunk remains the reference compatibility style, not a fixed product
identity. Every browser theme now includes a default-off, guided 3D-building
layer driven by the OMT `render_height` and `render_min_height` attributes.
The ATAK compiler expresses those attributes as legacy identity functions and
enables the layer in the client derivative. Sprites and glyphs remain
self-hosted.

Until selected upstream inputs are rebuilt together into one overlap-safe
archive, remote vector export is enabled only for an actual individual
publication. The composed all-regions browser view is not mislabeled as a
single vector publication. MBTiles remains the server-side storage detail and
optional full-offline transfer.

## Consequences

A connected ATAK device can begin with a small configuration file and request
only the PBF tiles it needs. ATAK's cache path may retain a selected area for
later disconnected use. Browser, raster, and ATAK outputs share the same source
data and self-hosted assets.

The current prototype still requires a user to choose one regional publication
for remote-vector testing. Satisfying the multi-input product goal requires the
build plane to run the selected source inputs through one vector build, validate
the resulting shared low-zoom tiles and building schema, and atomically promote
that one artifact. Copying rows between existing MBTiles files remains rejected
because overlapping tile coordinates would discard features.

Custom style import and property-driven extrusion remain device-test claims,
not validated compatibility claims, until exercised on ATAK 5.8. Automated
tests establish descriptor structure and probe size, endpoint availability,
style compilation, and selection of ATAK's built-in OMT schema only.

## Rejected alternatives

- Require the entire MBTiles archive for connected use: rejected because it
  defeats streaming and delays first render.
- Change the raster XML URL from PNG to PBF: rejected because
  `customMapSource` describes raster imagery, not ATAK vector datasets.
- Build an ATAK plugin first: deferred because stock ATAK already contains a
  remote vector descriptor, client, renderer, and cache path.
- Advertise the composed regional browser style as one vector source: rejected
  because it is currently multiple independent archives.
- Merge existing MBTiles rows: rejected because overlapping tiles would be
  overwritten rather than feature-merged.
