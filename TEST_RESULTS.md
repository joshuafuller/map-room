# Prototype test results

Date: 2026-08-01
Fixtures: Florida and California
Planetiler: 0.10.1
TileServer GL: 5.6.0
MapLibre GL JS: 6.1.0

## Passed

- Planetiler produced an OpenMapTiles 3.16 MBTiles archive from the current
  Geofabrik Florida extract.
- The archive reports an OSM replication timestamp of `2026-07-31T20:21:56Z`.
- The 653 MB PBF produced a 655 MB archive containing 57,952 tiles and roughly
  31.2 million encoded features in 2 minutes 22 seconds on the test host.
- TileServer GL accepted the generated multi-source style documents without
  warnings.
- Daylight, Midnight, Cyberpunk Classic, and Cyberpunk Tactical vector style
  endpoints returned valid JSON.
- A representative vector tile returned `application/x-protobuf`.
- All four raster themes returned valid 256×256 PNG and 512×512 HiDPI images.
- One composed style and raster route returned representative California and
  Florida tiles without switching the underlying map layer.
- The frontend, MapLibre bundle, glyphs, styles, manifest, and tiles are all
  locally served.
- The generated ATAK XML contains exactly one `customMapSource` with the
  expected PNG tile type, z0-z20 range, and composed
  `all-<theme>/{$z}/{$x}/{$y}` URL template.
- A disposable internal-only Docker network served the frontend, style, and
  raster tile while an external request failed because no outbound route was
  available.
- Chromium rendered the MapLibre canvas, local region catalog, map controls,
  and all themes without page or request failures. Choosing Florida or
  California moved the camera while retaining the composed style.
- The ATAK vector device-test route serves the 655 MB Florida MBTiles archive
  with resumable byte ranges. The browser generates a Cyberpunk Mapbox v8 style
  containing 27 layers, one Florida vector source, and absolute data, sprite,
  and glyph URLs.
- The ATAK-targeted style compiler has 100% line, branch, and function coverage.

Run the repeatable checks with:

```sh
./scripts/test.sh
./scripts/test-offline.sh
npm run test:browser
```

## Not yet validated

- Importing the generated XML into an actual supported ATAK release
- Applying the corrected 27-layer Cyberpunk style in ATAK 5.8. The first
  device artifact was rejected because an implementation defect reduced it to
  one background layer and zero layers accepted by ATAK's style validator.
- ATAK area download followed by device airplane-mode use
- PWA installation and browser-held offline map packages
- Visual regression coverage beyond the inspected California and Florida views
- Data refresh, atomic archive promotion, rollback, authentication, and metrics

The current result proves the central build-and-serve architecture and an
isolated runtime. It does not yet prove ATAK client compatibility or the full
production update lifecycle.
