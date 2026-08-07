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

## What is not yet known

**The actual size saving has not been measured.** The list above is derived from
the schema and our tile metadata; it says what is unused, not what it weighs.
Attribute keys and values are dictionary-encoded per tile, so the saving depends
on cardinality rather than field count, and cannot be inferred from the table.

To measure it: rebuild one region with the fields dropped, compare archive size,
then import both into ATAK and confirm the rendering is identical. Until that is
done, no percentage should be quoted.

Also unverified: whether Planetiler's OMT profile can drop these fields through
configuration alone, or whether it needs a custom profile.

## Why this matters

An offline vector archive covering all of Colorado is 0.36 GB against roughly
6 GB for the same coverage as styled raster. Vector is already the affordable
format for broad offline coverage; making it smaller widens the area a device
can carry. See [ATAK import workflows](ATAK_IMPORT_WORKFLOWS.md) for the size
comparison and the offline rendering evidence.
