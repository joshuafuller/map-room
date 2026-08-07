#!/usr/bin/env python3
"""Bake a styled raster .mbtiles from Map Room's rendered tiles.

Proves whether a raster archive — a style with its rendering already applied —
imports into ATAK and draws offline.
"""
import math, sqlite3, sys, urllib.request

STYLE = sys.argv[1] if len(sys.argv) > 1 else "all-daylight-raster"
OUT = sys.argv[2] if len(sys.argv) > 2 else "daylight-cos.mbtiles"
MINZ, MAXZ = 6, 12
# Colorado Springs area
WEST, SOUTH, EAST, NORTH = -105.3, 38.6, -104.4, 39.1
BASE = "http://localhost:8088/styles"

def deg2tile(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(rad)) / math.pi) / 2.0 * n)
    return x, y

db = sqlite3.connect(OUT)
db.execute("CREATE TABLE metadata (name text, value text)")
db.execute("CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)")
db.execute("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)")

for key, value in [
    ("name", f"Map Room {STYLE}"),
    ("description", "Map Room styled raster archive"),
    ("version", "1"),
    ("type", "baselayer"),
    ("format", "png"),
    ("bounds", f"{WEST},{SOUTH},{EAST},{NORTH}"),
    ("center", f"{(WEST+EAST)/2},{(SOUTH+NORTH)/2},{MINZ}"),
    ("minzoom", str(MINZ)),
    ("maxzoom", str(MAXZ)),
]:
    db.execute("INSERT INTO metadata VALUES (?,?)", (key, value))

total = 0
for z in range(MINZ, MAXZ + 1):
    x0, y0 = deg2tile(WEST, NORTH, z)
    x1, y1 = deg2tile(EAST, SOUTH, z)
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            url = f"{BASE}/{STYLE}/{z}/{x}/{y}@2x.png"
            try:
                with urllib.request.urlopen(url, timeout=60) as response:
                    data = response.read()
            except Exception as error:
                print("skip", url, error)
                continue
            # MBTiles rows are TMS: flipped Y
            db.execute("INSERT OR REPLACE INTO tiles VALUES (?,?,?,?)",
                       (z, x, (2 ** z - 1) - y, sqlite3.Binary(data)))
            total += 1
    db.commit()
    print(f"z{z}: {total} tiles so far", flush=True)

db.commit()
db.close()
print(f"wrote {OUT} with {total} tiles")
