#!/usr/bin/env python3
"""Measure what stripping unread attributes actually saves.

Both arms are decoded and re-encoded through the same codec, so the difference
is attributable to attributes rather than to encoder behaviour. Sizes are
gzipped, matching how tiles are stored.
"""
import gzip, sqlite3, sys
from collections import defaultdict
import mapbox_vector_tile as mvt

ATAK = {
 "water": {"brunnel", "class", "intermittent"},
 "waterway": {"brunnel", "intermittent", "class"},
 "landcover": {"class", "subclass"},
 "landuse": {"class"},
 "mountain_peak": {"rank", "ele", "ele_ft", "class"},
 "park": {"rank", "class"},
 "boundary": {"admin_level", "disputed_name", "disputed", "maritime", "claimed_by"},
 "aeroway": {"ref", "class"},
 "transportation": {"layer", "bicycle", "service", "level", "brunnel", "indoor",
                    "ramp", "horse", "subclass", "surface", "oneway", "foot",
                    "mtb_scale", "class"},
 "building": {"render_min_height", "hide_3d", "colour", "render_height"},
 "water_name": {"intermittent", "class"},
 "transportation_name": {"layer", "subclass", "indoor", "network", "ref", "level",
                         "ref_length", "class"},
 "place": {"rank", "capital", "iso_a2", "class"},
 "housenumber": {"housenumber"},
 "poi": {"layer", "rank", "subclass", "indoor", "level", "class", "agg_stop"},
 "aerodrome_label": {"ele", "iata", "ele_ft", "icao", "class"},
}
KEEP_NAMES = {"name", "name:en", "name:latin", "name_en", "name_int"}

def layers_from(decoded, strip):
    out = []
    for name, layer in decoded.items():
        allowed = ATAK.get(name, set())
        features = []
        for feature in layer["features"]:
            props = feature["properties"]
            if strip:
                props = {k: v for k, v in props.items()
                         if ((k in KEEP_NAMES) if k.startswith("name")
                             else (k in allowed))}
            features.append({"geometry": feature["geometry"], "properties": props})
        out.append({"name": name, "features": features,
                    "extent": layer.get("extent", 4096)})
    return out

def encoded_size(decoded, strip):
    blob = mvt.encode(layers_from(decoded, strip),
                      default_options={"extents": 4096, "y_coord_down": True})
    return len(gzip.compress(blob, 6))

archive = sys.argv[1]
per_zoom = int(sys.argv[2]) if len(sys.argv) > 2 else 120
db = sqlite3.connect(archive)
zooms = [int(z) for z in (sys.argv[3].split(",") if len(sys.argv) > 3 else [str(z) for (z,) in db.execute("SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level")])]

totals = defaultdict(lambda: [0, 0, 0])   # zoom -> [stored, reencoded, stripped]
for z in zooms:
    rows = db.execute(
        "SELECT tile_data FROM tiles WHERE zoom_level=? ORDER BY random() LIMIT ?", (z, per_zoom)).fetchall()
    for (blob,) in rows:
        raw = gzip.decompress(blob) if blob[:2] == b"\x1f\x8b" else blob
        try:
            decoded = mvt.decode(raw)
        except Exception:
            continue
        totals[z][0] += len(blob)
        totals[z][1] += encoded_size(decoded, False)
        totals[z][2] += encoded_size(decoded, True)
    stored, base, diet = totals[z]
    if base:
        print(f"z{z:<3} n={len(rows):<4} stored {stored/1e6:7.2f} MB   "
              f"re-encoded {base/1e6:7.2f} MB   stripped {diet/1e6:7.2f} MB   "
              f"saving {100*(base-diet)/base:5.1f}%", flush=True)

stored = sum(v[0] for v in totals.values())
base = sum(v[1] for v in totals.values())
diet = sum(v[2] for v in totals.values())
print()
print(f"sampled {sum(1 for _ in totals)} zoom levels")
print(f"stored      {stored/1e6:8.2f} MB")
print(f"re-encoded  {base/1e6:8.2f} MB   (baseline: same codec, all attributes)")
print(f"stripped    {diet/1e6:8.2f} MB")
print(f"SAVING      {100*(base-diet)/base:8.1f}%  of tile bytes")
