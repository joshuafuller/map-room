# What ATAK reads from a vector tile, and what we can stop shipping

ATAK renders OMT-schema vector tiles with a built-in renderer. It reads a fixed
set of layers and attributes and ignores everything else. Anything outside that
set is weight the device carries and never uses.

The authority is `Schema.java` in
`takkernel/engine/src/main/java/com/atakmap/map/layer/feature/vectortiles/`,
which hardcodes the schema as a map of layer to attribute set.

## What ATAK reads

Sixteen layers. Attributes per layer:

| Layer | Attributes ATAK reads | Reads names |
| --- | --- | --- |
| `water` | `brunnel`, `class`, `intermittent` | no |
| `waterway` | `brunnel`, `intermittent`, `class` | yes |
| `landcover` | `class`, `subclass` | no |
| `landuse` | `class` | no |
| `mountain_peak` | `rank`, `ele`, `ele_ft`, `class` | yes |
| `park` | `rank`, `class` | yes |
| `boundary` | `admin_level`, `disputed_name`, `disputed`, `maritime`, `claimed_by` | no |
| `aeroway` | `ref`, `class` | no |
| `transportation` | `layer`, `bicycle`, `service`, `level`, `brunnel`, `indoor`, `ramp`, `horse`, `subclass`, `surface`, `oneway`, `foot`, `mtb_scale`, `class` | no |
| `building` | `render_min_height`, `hide_3d`, `colour`, `render_height` | no |
| `water_name` | `intermittent`, `class` | yes |
| `transportation_name` | `layer`, `subclass`, `indoor`, `network`, `ref`, `level`, `ref_length`, `class` | yes |
| `place` | `rank`, `capital`, `iso_a2`, `class` | yes |
| `housenumber` | `housenumber` | no |
| `poi` | `layer`, `rank`, `subclass`, `indoor`, `level`, `class`, `agg_stop` | yes |
| `aerodrome_label` | `ele`, `iata`, `ele_ft`, `icao`, `class` | yes |

"Reads names" means the layer also accepts the shared name set: `name` plus 70
localisation variants (`name:en`, `name:de`, `name:ja`, `name:latin`,
`name:nonlatin`, `name_en`, `name_int`, and so on).

Note what is **absent**: no `mtb_scale` equivalent for other modes, no route
relations, no address detail beyond `housenumber`, and no styling hints beyond
the building height and colour fields. ATAK's appearance is decided in its own
renderer, not by tile attributes.

## What Map Room currently ships that ATAK ignores

Measured against `colorado.mbtiles`. Our layer set matches ATAK's exactly —
there are no surplus layers — but the layers carry surplus attributes.

**29 attributes ATAK never reads:**

| Layer | Attributes |
| --- | --- |
| `transportation_name` | `route_1_name`, `route_1_network`, `route_1_ref` … through `route_7_*` (21 fields) |
| `transportation` | `access`, `expressway`, `network`, `official`, `toll` |
| `boundary` | `class` |
| `mountain_peak` | `customary_ft` |
| `water` | `id` |

The `route_N_*` block is the largest single item: seven route relations per
road feature, name, network and ref for each, none of it read.

**127 surplus name variants**, if a deployment keeps only `name`, `name:en`,
`name:latin`, `name_en` and `name_int`:

| Layer | Surplus variants |
| --- | --- |
| `place` | 55 |
| `waterway` | 28 |
| `poi` | 17 |
| `park` | 11 |
| `aerodrome_label` | 7 |
| `transportation_name` | 5 |
| `water_name`, `boundary`, `mountain_peak` | 2, 1, 1 |

Every named place currently carries 55 translations that no ATAK user in a
Latin-script deployment will ever see. ATAK will still find `name`.

## What to strip

1. **The `route_N_*` block in `transportation_name`.** Unread, and repeated up
   to seven times per road feature.
2. **The five unread `transportation` attributes** (`access`, `expressway`,
   `network`, `official`, `toll`).
3. **`boundary.class`, `mountain_peak.customary_ft`, `water.id`.**
4. **Name variants beyond the deployment's languages.** Largest saving by far,
   and the one that needs a deliberate decision: dropping `name:ar` is right for
   a US deployment and wrong for a coalition one. This should be configurable,
   not hardcoded.

Nothing here changes what ATAK draws, because none of it reaches the renderer.

## Measured: stripping saves about 2.4%

Measured on `colorado.mbtiles` with `scripts/atak/measure-tile-diet.py`. Both
arms are decoded and re-encoded through the same codec, so the difference is
attributable to attributes rather than encoder behaviour, and both are gzipped
as stored.

| Zoom | Tiles | Archive MB | Share of bytes | Saving |
| --- | --- | --- | --- | --- |
| 0-8 | 78 | 1.4 | 0.4% | 5-26% |
| 9 | 120 | 2.6 | 0.8% | 3.1% |
| 10 | 380 | 4.5 | 1.5% | 3.4% |
| 11 | 1,350 | 10.3 | 3.3% | 3.3% |
| 12 | 5,036 | 24.8 | 8.0% | 4.0% |
| 13 | 19,437 | 74.2 | 24.0% | 2.4% |
| 14 | 75,840 | 190.7 | 61.8% | 2.6% |

**Weighted by actual bytes: 2.4%.** On a 309 MB archive that is roughly 7 MB.

The low zooms do save 18-26%, but they are a rounding error in the total. Zooms
13 and 14 hold 86% of the bytes, and there the saving is 2.4-2.6%. Those two
were re-measured with random sampling rather than the first rows by rowid, in
case the sample was spatially clustered; the figures were unchanged.

### Why it is so small

At high zoom the bytes are geometry, not attributes. Attribute keys and values
are dictionary-encoded once per tile and referenced by index, so 127 surplus
name variants cost almost nothing when only a handful of features in a z14 tile
carry a name at all — roads and buildings dominate those tiles and carry none.
The `route_1_*` through `route_7_*` block looks alarming as a field list but is
populated on very few features.

Field counts are a bad proxy for bytes. This is the measurement that matters.

### What this means

**Do not do this work for size.** A 2.4% reduction does not widen what a device
can carry in any meaningful way, and it costs a custom build profile plus a
per-deployment language decision that can silently discard data a coalition user
needs.

It may still be worth doing for other reasons — a smaller attribute surface is
easier to reason about, and dropping unread fields removes a class of "why is
this in here" questions. Those are not size arguments and should not be
justified as such.

The real size lever is elsewhere: zoom depth and coverage area. Dropping z14
alone removes 62% of the archive.

## Why this matters

An offline vector archive covering all of Colorado is 0.36 GB against roughly
6 GB for the same coverage as styled raster. Vector is already the affordable
format for broad offline coverage; making it smaller widens the area a device
can carry. See [ATAK import workflows](ATAK_IMPORT_WORKFLOWS.md) for the size
comparison and the offline rendering evidence.
