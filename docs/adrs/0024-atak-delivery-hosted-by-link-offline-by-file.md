# ADR-0024: Deliver hosted maps by link and offline maps by file import

Status: accepted

Date: 2026-08-07

## Context

Map Room needs ATAK users to get a map with as little effort as possible. The
intuition was a single Data Package delivered by QR code that carries everything
— tiles and styles, hosted and offline. Every part of that intuition was tested
against ATAK 5.8.0.1 on an emulator, with the source at
`tak.gov/atak-civ-client` read to explain each result. Evidence is in
[ATAK import workflows](../ATAK_IMPORT_WORKFLOWS.md).

Four findings constrain the design.

**A Data Package cannot carry map definitions.** A zip containing
`MANIFEST/manifest.xml` routes to `MissionPackageExtractor`, which places
declared contents in its own package directory. The imagery resolvers never
inspect it, so styles silently fail to register — a successful import that
produces no map and no error. A zip *without* a manifest routes to
`PlainZipExtractor`, which feeds the normal resolver chain, and everything
registers.

**No URL import can produce a map source.** `ImportFileTask` offers the user a
resolver choice only when the caller sets `FlagPromptOnMultipleMatch`. Every
call site that sets it is a file path. URL imports use a shared downloader built
without it, and that downloader serves both the QR deep link and the Import
Manager's HTTP URL option. Both take the first matching resolver, which for any
non-terrain `.mbtiles` is `ImportGRGSort` — it promotes itself ahead of the
others. A URL-delivered archive is therefore always an Image Overlay, never a
selectable map.

**ATAK cannot apply our styles to vector tiles.** `GLVectorTiles` selects a
renderer from the tileset schema; `Schema.java` hardcodes OMT and RBT. No
sprite, glyph, or style document is loaded anywhere in that path. Vector tiles
render with ATAK's built-in appearance, and that appearance cannot be changed.

**Zoom depth is a real trade.** A z0-12 Colorado archive is 47 MB against 309 MB
for z0-14, but past its maxzoom ATAK scales the deepest tile rather than
re-rendering, and OMT carries no minor streets at z12. The detail is absent from
the data, so a shallow archive cannot be over-zoomed into a detailed one.

## Decision

Deliver by two distinct paths, and describe them to users by whether the server
will be reachable rather than by format.

**Hosted, delivered by link.** One plain zip — no manifest — containing one
`customMapSource` XML per style, published over HTTP and encoded in a QR as
`tak://com.atakmap.app/import?url=<percent-encoded>`. The user scans, confirms,
and picks a style: three interactions, styles switchable thereafter. Definitions
are generated through the address the device will use, because the tile URL is
embedded absolutely.

**Offline, delivered as a file.** Publish the archive as a plain download. The
user puts it on the device and imports it through `Tools -> Import -> Local SD`,
answering `Imagery` at the import-method prompt, or copies it into
`atak/imagery/`. This cannot be reduced to a scan, and the instructions must
name the `Imagery` choice explicitly because the default produces an overlay.

**Offline styling is chosen at bake time, not on the device.** Vector archives
render with ATAK's appearance. To deliver a Map Room style offline, bake a
raster archive with the style already applied. Vector is roughly 17x smaller for
the same coverage and does not multiply per style; raster carries the chosen
look at roughly 6 GB per style for a state at z14.

**Never emit a `MANIFEST` directory** on any ATAK-bound archive.

## Consequences

The hosted path is genuinely streamlined and needs no further mechanism.

The offline path retains a file-handling step that cannot be designed away
within stock ATAK. Presenting hosted and offline as equivalent one-scan
experiences would be dishonest; the UI should ask whether the server will be
reachable and then be explicit about what the offline path costs.

Offering several looks offline multiplies storage by the number of looks. For
broad coverage the affordable answer is a single vector archive in ATAK's
appearance; styled raster suits bounded areas at high zoom.

Users will find an imported offline archive filed under Image Overlay with a
list entry reporting 0 deg, 0 deg. The layer is correctly bounded and renders;
only the entry is wrong. This must be explained rather than left to discovery.

If a future ATAK sets `FlagPromptOnMultipleMatch` on the URL path, or loads a
style document for vector tiles, this decision should be revisited — both would
remove the constraints that shape it.

## Alternatives considered

**A Data Package for everything.** Tested and rejected: it silently fails to
register map definitions.

**Bundling the offline archive into the QR-delivered zip.** Works, and the tiles
do render, but they arrive as an overlay rather than a map. Acceptable only if
overlay placement is acceptable to the user.

**Shipping shallower archives to save space.** Rejected as a general answer:
detail cannot be recovered past maxzoom. It remains valid where regional context
is all that is needed.

**Stripping unread attributes from vector tiles.** Measured at 2.4% of archive
bytes. Not worth the build complexity for size alone.
