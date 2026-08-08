# Choosing a map format for ATAK: the rubric

A scoring frame for deciding which map format is best for **ATAK users
generally** — military, coalition, and civilian — not only for Map Room's own
users. Map Room's persona is one column in this, not the frame.

That matters because the ATAK community's constraints are wider than any one
deployment's: a volunteer SAR team on donated phones, a fire district covering
a county, a coalition partner who cannot receive unreleasable data, and an
infantry platoon provisioning fifty EUDs before a flight all want different
things from the same map.

Cells already filled are measured; see [ATAK import workflows](ATAK_IMPORT_WORKFLOWS.md).
Everything else is explicitly marked unknown. A rubric with guessed cells is
worse than no rubric, because it launders assumption as analysis.

## Hard gates

A candidate that fails any of these is out, whatever else it scores.

| Gate | Why |
| --- | --- |
| **No API token, account, or hosted vendor dependency** | Self-hostable is the product. A format that routes through someone else's service is disqualified regardless of merit |
| **No licence cost or per-seat fee** | Same reason |
| **Works with the server unreachable**, for any candidate offered for the offline workflow | Otherwise it is not an offline option |
| **Failure is visible** | A format that fails silently — successful import, no map, no error — cannot be supported for a user who does not know what a tile is. This disqualified Data Packages |

## Use cases to score against

Scores are per use case. A format that wins one may lose another, and that is
the point: the honest answer is likely to be different formats for different
situations.

| # | Use case | Who | Shape |
| --- | --- | --- | --- |
| **A** | Server-hosted operation | CP, EOC, fire district | TAK server or LAN reachable throughout; devices stream |
| **B** | Whole-region offline | Deployed units, expedition | Everything transferred before departure, no comms after |
| **C** | Bounded AO, high detail | Urban op, SAR grid | Small area, deep zoom, offline |
| **D** | Intermittent connectivity | Cell, SATCOM, vehicle | Stream when possible, cache what is needed |
| **E** | Coalition / partner | FMS, allied units | Release-approved data only |
| **F** | Map plus terrain | Aviation, fires, viewshed | Elevation alongside the basemap |
| **G** | Mass provisioning | Any unit issuing many devices | Fifty EUDs loaded before departure, quickly and identically |
| **H** | Austere or legacy device | Donated phones, older EUDs | Limited storage, older ATAK version |
| **I** | Volunteer / civil | SAR, CERT, fire | No GIS staff, no server admin, someone's laptop |

Use cases G, H and I are where community adoption is won or lost, and they are
the ones a vendor-centric analysis usually omits. G punishes anything requiring
per-device manual steps. H punishes size and version sensitivity. I punishes
anything needing infrastructure to stand up.

## Criteria

Each has a stated measurement method, so two people scoring independently get
the same answer.

| # | Criterion | How it is measured |
| --- | --- | --- |
| 1 | **Stock ATAK support** | Works on unmodified ATAK 5.8 — yes/no, plus version sensitivity |
| 2 | **User steps** | Counted interactions from artifact to rendered map, one-time setup excluded, as measured in the workflows doc |
| 3 | **Failure visibility** | Does a wrong or partial artifact produce an error the user can act on |
| 4 | **Size** | GB for the reference region (Colorado, z0-14), measured not projected |
| 5 | **Scaling with styles** | Does size multiply per look |
| 6 | **Discoverability** | Where it lands in ATAK's UI: map list, overlay list, or elevation |
| 7 | **Offline completeness** | Renders with the network fully disabled, verified in airplane mode |
| 8 | **Selective acquisition** | Can the user take only their area, and see the size before committing |
| 9 | **Update story** | Can it be refreshed without re-transferring everything |
| 10 | **Legibility** | Readable at operational zoom; judged on same-viewport captures |
| 11 | **Self-hostable** | No token, no vendor — gate 1, restated for scoring within survivors |
| 12 | **Our build burden** | Pipeline complexity and whether it version-locks us to ATAK releases |
| 13 | **Ecosystem momentum** | Is the format gaining adoption outside TAK |
| 14 | **Cross-TAK support** | Does it also work in iTAK and WinTAK, or is it ATAK-only |
| 15 | **ATAK version sensitivity** | Does it work across the long tail of deployed versions, or only recent ones |
| 16 | **Mass-provisioning cost** | Per-device time and whether it can be scripted or imaged rather than tapped |
| 17 | **Constrained-device fit** | Usable footprint on a device with little free storage |
| 18 | **Releasability** | Can the data be handed to a coalition partner without a release process |
| 19 | **Set-up burden for the publisher** | What a volunteer organisation must stand up to use it at all |

## What ATAK already supports — context, not candidates

Not the subject of this rubric, but the baseline anything new must beat.
Raster containers: **MBTiles**, **GeoPackage**, **OSM Droid SQLite**, **Zip
tileset**, plus GDAL-georeferenced files and world-file images. Vector tiles:
**MBTiles (MVT)** and **direct `.mvt`/`.pbf`**. Services: **WMS**, **WMTS**.
Terrain: **DTED**, **SRTM**, **GeoTIFF**, **Mapbox RGB**, **Terrarium**. 3D:
**OBJ**, **COLLADA**, **glTF/GLB**, **Cesium 3D Tiles** (b3dm full, i3dm
partial). Full detail in ATAK's `ATAK_Supported_Map_Types.md`.

### Check the roadmap before building anything

ATAK's own planned-formats section changes the calculus, because building what
ATAK is about to ship natively is wasted effort:

| Feature | ATAK status | Target |
| --- | --- | --- |
| **Custom style sheet import** | Planned | 5.7+ |
| **Shortbread default styles** | Planned | 5.8+ |
| **Map Manager download** (streaming vector region download) | Planned | 5.8+ |
| RBT default styles | Planned | 5.7+ |
| **Cesium Quantized Mesh** | Planned | 5.8+ |
| ESRI **TPKX** / **VTPK** | In development | 5.7 |

Two consequences worth absorbing. Custom stylesheet import being *planned*
explains the dead `overrideStyle` variable, and means the styling limitation may
be temporary. And "Map Manager download" being planned rather than shipped
suggests streaming vector region caching is **not** available in 5.8 — which
would answer [#109](https://github.com/joshuafuller/map-room/issues/109) in the
negative and must be verified before that spike is scoped.

Do not build: TPKX, VTPK, Shortbread styling, or quantized mesh. ATAK is
already doing them.

## Candidates — formats ATAK does not support

These are the plugin candidates, scored against each other.

| Candidate | What it is | Why it might matter |
| --- | --- | --- |
| **PMTiles** | Single-file tile archive read by HTTP range request | No tile server at all — static hosting, or one file offline. The self-hosting community has largely settled on it |
| **COMTiles** | Cloud-optimised tile archive, same idea | Alternative to PMTiles; far less adoption |
| **COG** (Cloud-Optimised GeoTIFF) | Range-request GeoTIFF | Standard for imagery in the wider geo world; ATAK reads plain GeoTIFF but not cloud-optimised access |
| **MLT** (MapLibre Tiles) | Next-generation vector tile encoding | Substantially better compression than MVT; early, and moving |
| **FlatGeobuf** | Streamable flat feature format with spatial index | Feature data rather than tiles; good for large overlays |
| **Protomaps basemap** | A complete open basemap build and schema, shipped as PMTiles | The community's turnkey self-hosted basemap |
| **Shortbread** | Geofabrik's open vector tile schema | Open governance alternative to OMT — but ATAK plans native styles for it |
| **Overture** | Open data supply (places, buildings, transport) | Changes the input, not the delivery format |

### Additional criteria for plugin candidates

On top of the nineteen above, these decide build-versus-wait:

| # | Criterion | How it is measured |
| --- | --- | --- |
| 20 | **Plugin implementation effort** | Which SPIs it needs — `TileContainerFactory`, `DatasetDescriptorFactory2`, `GLMapLayerFactory`, an `ImportResolver` — measured against the `customtiles` example as the unit of work |
| 21 | **Range-request dependency** | Does its advantage require HTTP range access, and does that advantage survive offline where there is no HTTP at all |
| 22 | **Spec stability and governance** | Is the spec versioned, owned by a foundation or a company, and stable enough to ship against |
| 23 | **Does ATAK plan it natively** | If yes, building it is throwaway work |
| 24 | **Existing tooling** | Can Map Room produce it with tools already in the pipeline, or does it need a new toolchain |

### First-pass reading, to be tested not trusted

**PMTiles** is the strongest candidate on paper: open spec, no vendor, static
hosting, and one file offline. But its headline advantage — range requests
against dumb storage — is a *hosting* advantage, and for a disconnected device
it degenerates to "a single file", which MBTiles already is. The honest question
is whether it beats MBTiles **on the device**, or only in how we serve it. If
only the latter, we can use PMTiles internally and keep shipping MBTiles to
ATAK, with no plugin at all.

**MLT** would be the real prize if the compression claims hold, because size is
the binding constraint on every offline case. It is also the least mature.

**COG** matters only if imagery becomes a priority; ATAK already reads GeoTIFF.

**Shortbread and quantized mesh are off the list** — ATAK is shipping both.

## What is already measured

| Criterion | Streaming raster | Streaming vector | MBTiles vector | MBTiles raster (styled) |
| --- | --- | --- | --- | --- |
| Stock ATAK | yes | yes | yes | yes |
| User steps | 3 (scan, Yes, pick) | 3 | 6 via Import Manager, or file copy | same as vector |
| Failure visibility | poor — empty layer if unreachable | poor | poor — silent overlay placement | poor |
| Size, Colorado z0-14 | n/a (streamed) | n/a (streamed) | **0.36 GB** | **~6 GB per style** (projected from measured 43 KB/tile) |
| Scales with styles | no — one archive, ATAK styles it | no | no | **yes** — one archive per look |
| Discoverability | map list | map list | **overlay list** unless imported as `Imagery` | same |
| Offline | no | no | **yes**, verified airplane mode | **yes**, verified |
| Selective acquisition | n/a | unknown — #109 | no — whole archive | no |
| Legibility | good | **best measured** — labels, buildings | as streaming vector | good, our styling |
| Self-hostable | yes | yes | yes | yes |

## What must be measured to finish this

Ordered by how much each would change the answer.

1. **Does streaming vector support region caching** — [#109](https://github.com/joshuafuller/map-room/issues/109). If yes it likely wins A, C and D outright, and largely dissolves B.
2. **Import ceiling** above 356 MB, and behaviour on interrupted transfer.
3. **Update semantics** — does re-importing replace or duplicate.
4. **PMTiles via plugin** — feasibility and effort against `customtiles`.
5. **Terrain triangle** — DTED against Terrain-RGB against quantized mesh, on size and on whether each coexists with a vector basemap.
6. **GeoPackage** — cheap to test and may already do much of this.

## How to run the shootout

For each surviving candidate, on the emulator harness in `scripts/atak/`:

- Build the artifact for the same reference region.
- Import it by its intended route, counting every interaction.
- Capture the same viewport at the same zoom for legibility comparison.
- Disable the network and verify what still renders, attributing by access log
  rather than appearance.
- Record size on device, not just artifact size.

Same region, same viewport, same method, every time. The comparison is only
worth something if the conditions are identical.

## A note on the likely answer

Measurements so far: streaming vector wins on size and legibility wherever a
server is reachable, and an offline archive is the only thing that works when
it is not. Region caching may collapse that split — one streaming source,
cached where needed — which is why #109 is first on the list.

But the community cases may not follow the measurements. A volunteer SAR team
with no server (case I) cannot use anything streamed, however efficient. A unit
provisioning fifty devices (case G) will take a format that images onto an SD
card over one that needs six taps per device, even at several times the size.
And a coalition handover (case E) is decided by releasability, not by bytes.

The likely outcome is a small set of recommended formats keyed to situation,
with one default — not a single winner. The rubric exists to make that
recommendation defensible rather than habitual.
