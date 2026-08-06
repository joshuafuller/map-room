# ATAK map delivery and file types

For the source-pinned implementation trace behind this user guide, see
[How ATAK ingests and uses maps](ATAK_MAP_ARCHITECTURE.md).

Map Room offers connected map streaming, ATAK-managed area caching, and
regional archive download. These solve different problems. A small XML or JSON
download is usually a pointer to a hosted map; it is not the map data itself.

## Start with your operating condition

Choose **host on Map Room** when the ATAK device can reach this server over a
trusted local network. Choose **completely offline** when the device must retain
the map even if Map Room is shut down and every network is unavailable.

Caching a hosted map is a useful middle ground, but it covers only the area and
zoom levels selected in ATAK. Do not treat a successful small-area cache as a
complete regional offline map.

## Quick decision guide

| Need | Choose | Server needed during use? | Device storage |
| --- | --- | --- | --- |
| Host coverage with smaller transfers and sharp rendering | Vector source and style (`.json`) — preferred | Yes, except where ATAK successfully caches it | Usually smaller for comparable coverage |
| Use the simplest, broadly compatible hosted display | Raster/TMS-style map source (`.xml`) | Yes, except for areas ATAK has cached | Larger because each tile is a rendered image |
| Carry one region without depending on Map Room | Vector archive (`.mbtiles`) | No after a successful transfer and import | Entire archive size |

Always test the chosen path on the exact ATAK release and Android device that
will use it. Map Room's server tests do not prove ATAK import or offline cache
behavior.

## Vector versus raster/TMS

**Vector is the preferred hosted path** when the target ATAK version renders
the supplied source and style correctly. Each PBF tile carries compact geometry
and attributes; ATAK draws it on the device. For comparable coverage this is
usually smaller to transfer and cache than a set of rendered image tiles, and
lines and labels remain sharp while zooming.

Choose **raster/TMS-style delivery** when straightforward display and client
compatibility matter more than transfer size or restyling. Map Room draws every
PNG tile before sending it, so ATAK has less styling work to do. The tradeoff is
that repeated image pixels generally use more bandwidth and storage.

TMS is not a portable map file type. It describes a tiled map service and its
z/x/y addressing convention. In everyday ATAK usage, “TMS” is also used
loosely for hosted raster tile sources. Map Room's downloaded XML describes the
correct PNG tile URL to ATAK; use that file instead of manually constructing or
flipping tile coordinates.

## Connected raster/TMS-style streaming

The ATAK raster map-source file is a small `.xml` document. It contains a URL
template such as:

```text
http://MAP-ROOM:8088/styles/all-daylight/{z}/{x}/{y}@2x.png
```

ATAK reads the XML, requests PNG image tiles for the current view, and draws
those images as a basemap. Map Room performs the styling and rendering, so the
device sees the same Daylight, Midnight, or Cyberpunk appearance shown in the
browser.

Consequences:

- Map Room must be running and reachable while viewing uncached areas.
- The XML is only a pointer and is tiny; copying it does not copy the map.
- ATAK can download/cache a selected area and zoom range for later use, but
  only that selected coverage is expected to work disconnected.
- Raster tiles are easy for clients to display, but labels and symbols are
  baked into PNG pixels and cannot be independently restyled on the device.

## Connected vector streaming — preferred

Map Room generates two small JSON documents for one selected region:

1. The **vector source JSON** tells ATAK the bounds, zoom levels, attribution,
   and URL template for individual `.pbf` vector tiles.
2. The **style JSON** tells ATAK how to draw roads, water, buildings, labels,
   POIs, sprites, and glyphs from those vector features.

ATAK requests PBF tiles as the map moves. Geometry and labels remain sharp,
and the style is applied on the Android device. Map Room must remain reachable
for uncached tiles, sprites, and fonts.

Vector style support is more ATAK-version-sensitive than raster display. Import
the source first, then apply the style through the layer's **Set Layer Style →
Import File** workflow. Validate the exact ATAK version before choosing vector
solely for its size advantage.

## Regional MBTiles archive

An `.mbtiles` file is a SQLite database containing many map tiles and metadata
in one file. Map Room's downloadable regional archive contains vector PBF
tiles, not pre-rendered PNG tiles.

Transferring the complete archive can remove the runtime dependency on the Map
Room server for that region, but the file may be hundreds of megabytes or
larger. The ATAK device needs enough storage and must support importing and
styling that vector archive. Treat successful import and rendering as a
device-validation requirement.

Map Room does not combine independently built regional MBTiles databases by
copying SQLite rows. The browser and raster service can compose several
installed regions at runtime; a single offline vector archive must be built as
one publication from the desired source coverage.

## Build inputs and supporting files

- `.osm.pbf`: compressed OpenStreetMap source data consumed by Planetiler.
  ATAK does not use this raw build input as a basemap.
- `.mbtiles`: a SQLite map archive containing many tiles plus metadata. An
  archive can contain raster or vector tiles; Map Room creates vector MBTiles.
- Tile `.pbf`: one encoded vector tile returned by Map Room for a specific
  zoom/X/Y coordinate. It is not the same thing as an `.osm.pbf` source file.
- `.png`: one server-rendered raster image tile.
- Map-source `.xml`: ATAK configuration pointing at a raster tile URL.
- Source `.json`: ATAK vector streaming descriptor pointing at PBF tile URLs.
- Style `.json`: drawing rules for vector features.
- Sprite `.png`/`.json` and glyph `.pbf`: icons and font ranges required by a
  vector style.

## What “streaming” means

Streaming means tiles are requested on demand as the user pans and zooms. It
does not mean live location tracking, TAK Cursor-on-Target traffic, or automatic
real-time OpenStreetMap updates. Map freshness is determined by when the source
extract was acquired and when the MBTiles publication was built.

## QR and Add to ATAK onboarding

Map Room can display a QR code and an **Open in ATAK** action for a compatible
hosted raster or vector source. Both carry this deep-link shape:

```text
tak://com.atakmap.app/import?url=<fully-percent-encoded-definition-URL>
```

ATAK asks the user to confirm, downloads the small XML or JSON definition from
Map Room, and passes it to the normal importer. The page also exposes the exact
deep link and the definition file as fallbacks. QR codes are generated locally;
the setup link is not sent to a third-party QR service.

Open Map Room through a device-reachable LAN address or DNS name when possible.
If the page was opened at `localhost`, enter the LAN/DNS Map Room address in the
onboarding dialog. Map Room verifies the hosted definition through that origin,
saves the address in that browser, and only then displays the QR. A loopback
address is rejected because ATAK would try to fetch the definition from the
Android device itself. The QR is only an onboarding shortcut; the device still
needs access to Map Room for uncached tiles. It contains no map tiles,
credentials, MBTiles archive, or Data Package.

Do not use QR onboarding or a TAK Data Package as the default way to push a
large regional MBTiles archive. As a conservative field guideline, keep a
setup Data Package well below roughly 10–20 MB unless the exact ATAK version,
Android device, transport, and import path have been tested with larger files.
This is an operational caution, not a claimed universal ATAK hard limit.
Large offline archives should use an explicit resumable transfer method, show
their full size before transfer, and be verified on-device before departure.
