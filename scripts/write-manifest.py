#!/usr/bin/env python3
import json
import math
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


archive = Path(sys.argv[1])
output = Path(sys.argv[2])
region = sys.argv[3] if len(sys.argv) > 3 else archive.stem.replace("-", " ").title()
with sqlite3.connect(archive) as connection:
    metadata = dict(connection.execute("SELECT name, value FROM metadata"))

center = [float(value) for value in metadata["center"].split(",")]
display_overrides = {
    "Florida": {"center": [-82.2, 27.8], "zoom": 6.2},
    "Monaco": {"center": [7.4246, 43.7384], "zoom": 13.2},
}
display = display_overrides.get(region, {"center": center[:2], "zoom": center[2]})
test_zoom = 14
longitude, latitude = display["center"]
tiles_at_zoom = 2**test_zoom
test_x = math.floor((longitude + 180) / 360 * tiles_at_zoom)
test_y = math.floor((1 - math.asinh(math.tan(math.radians(latitude))) / math.pi) / 2 * tiles_at_zoom)

manifest = {
    "region": region,
    "archive": archive.name,
    "archiveBytes": archive.stat().st_size,
    "bounds": [float(value) for value in metadata["bounds"].split(",")],
    "center": center,
    "displayCenter": display["center"],
    "displayZoom": display["zoom"],
    "testTile": f"{test_zoom}/{test_x}/{test_y}",
    "minZoom": int(metadata["minzoom"]),
    "maxZoom": int(metadata["maxzoom"]),
    "sourceTimestamp": metadata.get("planetiler:osm:osmosisreplicationtime"),
    "planetilerVersion": metadata.get("planetiler:version"),
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "themes": ["daylight", "midnight", "cyberpunk", "cyberpunk-tactical"],
}
output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
