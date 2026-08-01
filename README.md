# Map Room

**Map Room is a self-hosted map library and distribution server.**

It is intended to give a person one simple place to choose the maps their team
needs, download or import them, keep them current, preview them in a browser,
and make them available to web, GIS, offline-network, and ATAK users.

Map Room is for situations where depending on a public map service is
undesirable or impossible: field deployments, disconnected networks, private
infrastructure, emergency response, labs, vehicles, and ordinary organizations
that want control of their own map availability.

## What it does

```text
Map sources                 Map Room                      Map users

provider catalogs  --->  acquire and verify  --->  interactive website
local map files     --->  build and style     --->  vector tile clients
future imagery      --->  retain and update   --->  raster XYZ/TMS and WMTS
private catalogs    --->  publish and monitor --->  ATAK and offline networks
```

A maintainer should be able to:

1. Open the Map Room website.
2. Search or browse available map sources.
3. Select one or many regions or import a compatible map archive.
4. Review download size, storage needs, capabilities, license, and attribution.
5. Start synchronization and see its phase, progress, rate, elapsed time, and a
   defensible ETA when one can be calculated.
6. Leave Map Room to finish the work and safely resume after a restart.
7. Keep selected maps updated automatically without replacing a working map
   with a failed build.
8. Open any installed map, choose a visual style, and copy or download the
   correct endpoint/configuration for another client.

## What goes in

Map Room is designed around source-provider adapters rather than one map
vendor. Initial version 1 sources are planned to be:

- Geofabrik regional `.osm.pbf` extracts;
- compatible local MBTiles and PMTiles archives.

OpenStreetMap and Geofabrik are initial integrations, not the identity or limit
of the product. The architecture explicitly allows future organization-owned
catalogs, licensed raster maps, COG/GeoTIFF imagery, elevation, terrain, and
other providers. Each source keeps its own format, update, credential, license,
attribution, transformation, caching, and redistribution rules.

## What comes out

Depending on the capabilities of an installed map, Map Room is intended to
publish:

- a simple interactive browser map;
- vector tiles and compatible MapLibre styles;
- server-rendered raster XYZ tiles;
- strict TMS tiles with explicit Y-axis semantics;
- WMTS metadata where supported;
- provenance, freshness, bounds, zoom, checksum, license, and attribution
  manifests;
- versioned ATAK map-source configuration for validated ATAK profiles;
- a fully local serving bundle for networks without internet access.

Not every source supports every output. Map Room must report incompatible
combinations clearly instead of pretending that any map can be converted,
restyled, cached, or redistributed.

## Why it exists

Traditional self-hosted map stacks often assume a knowledgeable GIS/Linux
operator and combine downloading, databases, rendering, caching, serving, and
updates into one difficult-to-maintain system. Map Room separates those
responsibilities while presenting routine operation as a guided product rather
than a collection of infrastructure commands.

Its core safety model is:

- acquire into staging;
- verify the source and its policy;
- build a new immutable artifact;
- validate the artifact and every advertised output;
- atomically publish it;
- retain the last known-good map for rollback.

A failed download, build, validation, or update must never destroy or replace a
working published map.

## Current status

**Map Room is a specification-stage project with an early compatibility
prototype. It is not a production release.**

The prototype has demonstrated:

- Geofabrik PBF to OpenMapTiles-compatible MBTiles generation with Planetiler;
- vector and server-rendered raster delivery through TileServer GL;
- a self-contained MapLibre browser viewer;
- Daylight and Midnight visual themes;
- browser preview of the same PNG/XYZ raster route currently generated for
  ATAK configuration;
- operation on an isolated container network with no outbound route.

The prototype has **not** yet validated:

- importing and caching its configuration on a real supported ATAK release;
- strict OSGeo TMS delivery—the current ATAK/browser raster prototype is XYZ;
- the no-expertise maintainer interface;
- multiple provider selections and concurrent published maps;
- automatic acquisition, update, atomic promotion, rollback, and retention;
- authentication, backup/restore, observability, or production packaging;
- any non-Geofabrik source adapter.

See [prototype evidence](TEST_RESULTS.md) for the exact tested boundary.

## Development contract

Map Room uses Spec-Driven Development:

- behavior is specified before implementation;
- every unit of work is a GitHub issue;
- every issue requires explicit Acceptance Criteria and Definition of Done;
- consequential decisions are recorded as ADRs;
- all behavior changes follow the Iron Law: a test must first fail for the
  expected reason, then production code may be written;
- all repository-authored executable production code must maintain exactly
  100% line, statement, function, and branch coverage.

Start with:

- [Normative specifications](docs/specs/README.md)
- [Architecture Decision Records](docs/adrs/README.md)
- [Contributing and Iron Law workflow](CONTRIBUTING.md)
- [Historical prototype proposal](ARCHITECTURE.md)

## Run the current prototype

Prerequisites: Docker, Node.js/npm, Python 3, `curl`, and `unzip`.

```sh
./scripts/prepare-fixture.sh monaco
docker compose up -d
```

Open <http://localhost:8088>.

Florida is also supported as a larger development fixture:

```sh
./scripts/prepare-fixture.sh florida
```

Preparation downloads source/build inputs and can require substantial time,
storage, memory, and network transfer. Generated data is excluded from Git.

## Verify the prototype

```sh
./scripts/test.sh
./scripts/test-offline.sh
npx playwright install chromium # first browser-test run only
npm run test:browser
```

Stop it with:

```sh
docker compose down
```

These checks characterize the prototype. They do not yet satisfy the planned
production-wide 100% coverage gate or real ATAK validation matrix.

## Attribution

Map Room is an independent project. It is not affiliated with or endorsed by
OpenStreetMap, Geofabrik, MapLibre, TileServer GL, Planetiler, or the TAK Product
Center. Maps published through Map Room retain the licenses and attribution
requirements of their sources.
