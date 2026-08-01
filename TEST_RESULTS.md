# Prototype test results

Date: 2026-08-01
Fixture: Florida
Planetiler: 0.10.1
TileServer GL: 5.6.0
MapLibre GL JS: 6.1.0

## Passed

- Planetiler produced an OpenMapTiles 3.16 MBTiles archive from the current
  Geofabrik Florida extract.
- The archive reports an OSM replication timestamp of `2026-07-31T20:21:56Z`.
- The 653 MB PBF produced a 655 MB archive containing 57,952 tiles and roughly
  31.2 million encoded features in 2 minutes 22 seconds on the test host.
- TileServer GL accepted both generated style documents without warnings.
- Daylight and Midnight vector style endpoints returned valid JSON.
- A representative vector tile returned `application/x-protobuf`.
- Daylight and Midnight raster tiles returned valid 256×256 PNG images.
- The two raster themes produced different content hashes and were visually
  inspected at full-state scale and on a dense Miami tile for legibility.
- The frontend, MapLibre bundle, glyphs, styles, manifest, and tiles are all
  locally served.
- The generated ATAK XML contains the expected PNG tile type, zoom range, and
  theme-specific `{$z}/{$x}/{$y}` URL template.
- A disposable internal-only Docker network served the frontend, style, and
  raster tile while an external request failed because no outbound route was
  available.
- Chromium rendered the MapLibre canvas, local manifest, map controls, and both
  themes without page or request failures.

Run the repeatable checks with:

```sh
./scripts/test.sh
./scripts/test-offline.sh
npm run test:browser
```

## Not yet validated

- Importing the generated XML into an actual supported ATAK release
- ATAK area download followed by device airplane-mode use
- PWA installation and browser-held offline map packages
- Visual regression coverage beyond the inspected Monaco tile
- Data refresh, atomic archive promotion, rollback, authentication, and metrics

The current result proves the central build-and-serve architecture and an
isolated runtime. It does not yet prove ATAK client compatibility or the full
production update lifecycle.
