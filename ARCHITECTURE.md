# Historical prototype architecture proposal

> **Non-normative:** This document records the initial OpenStreetMap-focused
> prototype proposal. It is superseded by the source-neutral specifications in
> [`docs/specs/`](docs/specs/README.md) and retained as prototype evidence and
> rationale only. New work MUST cite the normative specifications and ADRs.

Status: concept draft
Date: 2026-08-01

## Executive recommendation

Build Map Room as an independent replacement rather than modernizing the
upstream reference project's all-in-one container.

The recommended first version is:

- **Planetiler** to turn a current OpenStreetMap `.osm.pbf` extract into an
  OpenMapTiles-compatible MBTiles archive.
- **TileServer GL** to serve that archive as vector tiles for the website and
  rendered raster XYZ tiles for ATAK and other legacy clients.
- **MapLibre GL JS** in a small, self-contained web application for map viewing,
  theme selection, endpoint discovery, data-freshness status, and offline/ATAK
  downloads.
- **A versioned style catalog** that renders one shared tileset as several
  polished maps, with matching vector and raster outputs.
- **A reverse proxy** as the single HTTP entry point, with authentication and
  TLS available when the deployment requires them.
- **A scheduled build job** that creates, tests, and atomically promotes a new
  map archive without changing the live archive in place.

This is a regional, archive-first design. It is substantially easier to operate
than a continuously mutating PostGIS/renderd stack and gives every client a
consistent snapshot. A planet-scale or near-real-time service is a different
operating profile and is described below.

## Why not continue the upstream project as-is?

The current project was useful because it packaged a traditional OSM raster
stack into one container. Its last upstream commit is dated 2023-06-25. The
container currently owns all of these responsibilities:

- PostgreSQL/PostGIS initialization and storage
- `osm2pgsql` import and replication
- OpenStreetMap Carto compilation
- Mapnik/renderd rendering and disk caching
- Apache/mod_tile serving
- cron-based update and tile-expiry processing
- a 35-line Leaflet demonstration page

That coupling makes upgrades risky, observability weak, and failures difficult
to isolate. The demo also is not a user-facing product, and the old README's
offline warning shows that runtime assets were historically allowed to depend
on the public internet.

The replacement should preserve the good product contract—give it a PBF and get
a locally hosted map—while separating build, serving, and user experience.

## Product definition

The service is a self-hosted OpenStreetMap distribution point for three kinds
of users:

1. **Website users** open a URL, browse/search the available map, see when its
   data was built, and get clear download instructions.
2. **Disconnected users** can run the service on an isolated network with no
   CDN or external runtime requests, or download an explicitly supported map
   package before disconnecting.
3. **ATAK users** can install a generated map-source XML file, stream raster XYZ
   tiles, and use ATAK's area-download workflow to retain tiles offline.

The first release is a basemap service. It does not include routing, geocoding,
satellite imagery, elevation, TAK messaging, or collaborative annotations.
Those should remain separate services and can be integrated later.

## Proposed architecture

```text
                    scheduled build plane

Geofabrik/latest PBF --> Planetiler --> map-YYYYMMDD.mbtiles
                              |                 |
                              +--> manifest ----+--> validation --> atomic promote

                    runtime serving plane

Browser / ATAK / GIS --> reverse proxy --> web app
                              |
                              +----------> TileServer GL
                                              |
                                              +--> current.mbtiles
                                                   vector + raster + WMTS
```

The generated manifest should travel with every archive and include:

- source URL, file size, and checksum
- source replication timestamp when available
- build start/end timestamps
- Planetiler profile and version
- TileServer/style compatibility version
- archive checksum and tile bounds
- validation result

`current.mbtiles` should be a symlink or release pointer. A completed build is
promoted by changing that pointer and restarting/reloading the serving process;
the prior known-good archive remains available for rollback.

## Frontend: intentionally simple

The initial web interface should have one primary map screen and a small status
drawer rather than an administrative dashboard.

Required capabilities:

- full-window MapLibre map with zoom, location, scale, and coordinate display
- a visual style picker with large previews and instant switching
- local assets only; no CDN, public fonts, or third-party tile calls
- visible OSM attribution
- data status: region, covered bounds, source date, build date, and health
- an **ATAK** action that downloads the generated map-source XML and shows the
  short import/cache instructions
- an **Offline** action that lists available prebuilt regional archives and
  clearly shows size and coverage before download
- copyable vector TileJSON, raster XYZ, style JSON, and WMTS endpoints for
  technical users
- an installable PWA shell so the help/status UI can open without a connection

The PWA shell alone must not be described as an offline map. Browser storage is
not a reliable way to silently cache an unbounded tile pyramid. Offline map
coverage must be an explicit, size-bounded user action.

## Cartography and theme system

"Multiple renderers" should initially mean multiple carefully designed styles
rendered by the same tested engine, not several independent rendering stacks.
One vector archive can support many MapLibre Style JSON documents, and
TileServer GL can expose a raster XYZ endpoint for each of them. This keeps
roads, labels, and boundaries consistent across clients while still giving
users genuinely different maps.

The initial catalog should include:

- **Daylight** — warm, quiet neutrals; crisp roads and labels; the default
  general-purpose street map.
- **Midnight** — a true dark theme designed for low-glare use, not a mechanical
  color inversion.
- **Tactical Canvas** — subdued land and transport colors so operational
  overlays remain visually dominant. This is a basemap treatment, not a claim
  to provide military symbology.
- **High Contrast** — stronger feature separation and label hierarchy for
  accessibility, difficult displays, and screenshots/printing.

A future **Terrain** style would require contours, hillshade, and possibly land
cover sources in addition to basic OSM data. Satellite or aerial themes require
separately sourced and licensed imagery; they cannot be synthesized from an OSM
street dataset.

Styles should be implemented as a shared theme system rather than four copied
JSON files. Common layer ordering, zoom rules, fonts, sprites, and feature
filters remain centralized; color, emphasis, and selected visibility rules are
theme tokens. Every published theme has:

- a stable ID and human-readable name
- a version and compatible tileset-schema version
- light/dark browser color-scheme metadata
- bundled fonts and sprites
- vector style, raster XYZ, TileJSON/WMTS where supported, and ATAK XML links
- preview images generated from a fixed set of representative places and zooms

Cartographic quality needs its own release gate. Automated screenshots should
cover dense city, rural roads, coast/water, parks, boundaries, tunnels/bridges,
and multilingual labels in every theme. Pixel diffs flag unexpected changes;
human review decides whether a deliberate change is actually better. Contrast
and color-vision checks should supplement, not replace, visual review.

## Offline modes

"Offline" has three meanings, and the product should name them separately.

### 1. Isolated server deployment (MVP)

Ship a Compose bundle and a prebuilt archive. Once transferred to the target
network, every runtime image, JavaScript module, font, sprite, style, and tile is
local. The runtime requires no internet access.

### 2. ATAK area cache (MVP)

ATAK consumes a generated `customMapSource` XML file pointing to the service's
raster XYZ endpoint. A user can then select an area and zoom range in ATAK's map
manager and download it for later use. The website should explain the tile count
and likely device cost before users choose a large zoom range.

The exact XML and cache behavior must be tested against the supported ATAK
release; community examples are useful evidence, but not a compatibility test.

### 3. Browser/device map packages (phase 2)

Offer named, prebuilt PMTiles or MBTiles downloads for bounded regions. A later
PWA can open a user-selected local PMTiles archive through MapLibre. Arbitrary
polygon extraction is deliberately deferred until the operational and storage
limits are known.

For pre-provisioned ATAK devices, phase 2 can also produce a TAK data package
containing the source definition and a compatible raster cache. Its SQLite
schema and import behavior must be validated with actual target devices before
it becomes a promised output format.

## ATAK contract

TileServer GL is recommended over a vector-only server for the first release
because it can render the same vector archive and style catalog into PNG raster
tiles on the server. That gives the web UI a modern vector path while retaining
conventional themed endpoints for ATAK.

Expected endpoints (final paths depend on the selected TileServer GL config):

```text
GET /styles/daylight/style.json
GET /styles/midnight/style.json
GET /data/osm/{z}/{x}/{y}.pbf
GET /styles/daylight/{z}/{x}/{y}.png
GET /styles/midnight/{z}/{x}/{y}.png
GET /atak/daylight.xml
GET /atak/midnight.xml
```

Each generated ATAK XML file should be treated as a product artifact. Tests
should verify its theme-specific URL template, min/max zoom, tile type,
attribution, TLS behavior, and ability to load and cache a small fixture area in
the target ATAK version. A small ATAK data package may bundle all theme source
files so users install the catalog once and switch maps inside ATAK.

Authentication needs an early decision. A browser can use interactive login;
ATAK tile requests need credentials that its map-source mechanism can actually
send. The MVP should prefer a reachable trusted network or a scoped tile token
over assuming browser cookies will work in ATAK.

## Staying current

Data freshness and software freshness are separate promises.

### Map data

- Configure one or more explicit Geofabrik region identifiers.
- Check the source metadata on a schedule, daily by default.
- Skip the build when the source has not changed.
- Download to staging, verify the download, build a new immutable archive, and
  run smoke/semantic checks before promotion.
- Never overwrite the live archive during generation.
- Publish `source_age_seconds`, `last_successful_build`, build duration, archive
  size, and failed-build count.
- Alert when source age exceeds the service-level target while continuing to
  serve the last known-good archive.
- Retain at least the current and previous successful builds.

Regional full rebuilds are the recommended starting point. Incremental updates
are attractive, but they reintroduce mutable database state, tile invalidation,
and more difficult rollback. Revisit them only if measured build time makes the
freshness target impossible.

### Software and supply chain

- Pin base images and major components to reviewed versions/digests.
- Enable weekly dependency PRs for Docker, npm, and GitHub Actions.
- Build and test upgrades against a tiny fixture region before merge.
- Generate and compare the full visual-regression gallery for renderer, style,
  font, sprite, or tileset-schema changes.
- Run scheduled container vulnerability scans and publish an SBOM for releases.
- Do not automatically deploy untested major-version updates.
- Use health checks that request the homepage, style JSON, one vector tile, one
  raster tile, and the ATAK XML—not merely an open TCP port.
- Show running component versions in a protected diagnostics response.

## Alternative operating profile: live or planet-scale

If requirements become near-real-time, highly customized, or planet-scale,
replace the archive build plane with PostgreSQL/PostGIS plus modern `osm2pgsql`
flex output and replication. Martin is a strong candidate for serving vector
tiles from PostGIS, MBTiles, or PMTiles. A raster renderer would still be needed
for ATAK unless the chosen ATAK version gains a validated vector-tile path.

That profile has materially higher storage, memory, import, cache-invalidation,
backup, and on-call costs. It should not be the default merely because the old
project used a database.

## MVP delivery slices

### Slice 0: prove compatibility

- Build a tiny fixture region with Planetiler.
- Serve vector and raster tiles with TileServer GL.
- Load Daylight and Midnight in a local MapLibre page with all network access
  disabled and verify theme switching does not refetch the underlying tileset.
- Import generated Daylight and Midnight source XML files into the supported
  ATAK version.
- Cache a small area, disable networking, and verify the cached tiles remain.

Exit criterion: one source snapshot is visibly equivalent enough for the web
use case and works online/offline in a real ATAK client.

### Slice 1: useful single-region service

- Compose deployment with pinned images and persistent data directories
- one configured regional build job with atomic promotion and rollback
- branded map page, visual theme gallery, freshness status, endpoint list, and
  OSM attribution
- Daylight, Midnight, Tactical Canvas, and High Contrast themes with reviewed
  previews and versioned assets
- downloadable ATAK theme catalog and concise user instructions
- end-to-end fixture tests and basic metrics/health checks

### Slice 2: durable operations

- scheduled data refresh, alerting, retention, and failed-build recovery
- authenticated deployment option and tested ATAK token strategy
- dependency automation, SBOM, image scanning, backup/restore exercise
- documented disconnected installation and upgrade bundle

### Slice 3: bounded offline distribution

- catalog of downloadable regional PMTiles/MBTiles artifacts
- local-file support in the web application
- measured size estimates and guardrails by bounds/zoom
- validated ATAK offline data package, if target-client testing supports it

## Acceptance criteria for the first production release

- The website and map function on an isolated network with outbound traffic
  blocked.
- The UI reports the actual source and build timestamps from the promoted
  manifest.
- A failed refresh cannot corrupt or replace the currently served map.
- Rollback to the previous archive is documented and demonstrated.
- Vector and raster endpoints return correct content types and valid tiles at
  representative zooms and bounds for every published theme.
- The supported ATAK version can import each theme XML, display the intended
  raster style, download a bounded area, and display that area after network
  loss.
- Every theme passes the agreed visual gallery review, and a style or renderer
  upgrade cannot silently change its published appearance.
- OSM attribution appears in the website, service metadata, and generated client
  configuration where the client format permits it.
- No runtime HTML, CSS, JavaScript, font, sprite, style, or map request depends
  on a public CDN.
- Component and data freshness failures are observable.

## Decisions needed before implementation

1. Which region(s) must the first deployment cover, and what is the largest
   expected region?
2. What maximum OSM data age is acceptable: 24 hours, one week, or another
   target?
3. Does "offline users" primarily mean an isolated shared server, individual
   downloadable browser maps, pre-provisioned ATAK packages, or all three?
4. Which ATAK release(s) and device class must be supported?
5. Is the service private, internet-facing, or deployed on a trusted tactical
   network?
6. Is street-map data sufficient, or are imagery, terrain, contours, routing,
   or geocoding also required?
7. Which visual character should the brand favor, and should Tactical Canvas
   prioritize daytime overlay clarity, low-light use, or both as separate
   themes?

## Primary upstream references

- Existing project: <https://github.com/Overv/openstreetmap-tile-server>
- Planetiler: <https://github.com/onthegomap/planetiler>
- TileServer GL: <https://github.com/maptiler/tileserver-gl>
- MapLibre GL JS: <https://maplibre.org/maplibre-gl-js/docs/>
- Martin (alternative/live profile): <https://github.com/maplibre/martin>
- PMTiles: <https://github.com/protomaps/PMTiles>
- Geofabrik extracts: <https://download.geofabrik.de/>
- OpenStreetMap attribution/license: <https://www.openstreetmap.org/copyright>
