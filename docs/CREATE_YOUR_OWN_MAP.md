# Create your own ATAK map

Map Room can turn an OpenStreetMap extract into a self-hosted map that is
viewable in a browser and publishable to ATAK. The result stays on your own
computer or server; the build does not upload your map to a third party.

This guide has two separate finish lines:

1. **Build and serve:** Map Room creates an MBTiles archive, browser styles,
   raster endpoints, and ATAK download files.
2. **Validate on your device:** you import the generated file into the ATAK
   version and Android device you actually use, cache a small area, disconnect,
   and confirm it still works.

Map Room automates the first. Only a real ATAK device test can establish the
second.

## Before you begin

Install:

- Docker with the Compose plugin;
- Node.js 24 or later and npm;
- Python 3;
- `curl` and `unzip`.

Map generation can be resource-intensive. Planetiler recommends free SSD space
of roughly 5–10 times the `.osm.pbf` input size and RAM of at least half the
input size. Start with Rhode Island to learn the workflow before choosing a
larger state or country.

You are responsible for checking the source's license and redistribution
terms. OpenStreetMap-derived maps must retain OpenStreetMap attribution. Do not
bulk-download tiles from a public raster tile server; Map Room builds from data
extracts instead.

## 1. Build a small practice map

From the repository root:

```sh
./scripts/create-map.sh --area "rhode island" --id rhode-island --name "Rhode Island"
```

The command downloads source data, builds `data/rhode-island.mbtiles`, writes
`data/regions/rhode-island.json`, and prepares the local browser assets.
Generated data is ignored by Git.

For a larger Geofabrik area, use its Planetiler area path and increase memory
when needed:

```sh
./scripts/create-map.sh \
  --area texas \
  --id texas \
  --name Texas \
  --memory 8g
```

Run `./scripts/create-map.sh --help` for all options. The tool refuses to
replace an existing map unless you explicitly pass `--force`.

## 2. Build from a file or download URL

Use a local extract when you downloaded or clipped the source yourself:

```sh
./scripts/create-map.sh \
  --pbf /path/to/my-area.osm.pbf \
  --id my-area \
  --name "My Area"
```

Or let Map Room download a direct HTTPS `.osm.pbf` URL:

```sh
./scripts/create-map.sh \
  --url https://download.geofabrik.de/north-america/canada/alberta-latest.osm.pbf \
  --id alberta \
  --name Alberta
```

Use a stable ID. It becomes part of URLs and filenames, so changing it creates
a different publication rather than updating the old one.

Geofabrik publishes browsable extract catalogs for the
[United States and Canada](https://download.geofabrik.de/north-america.html),
[the United Kingdom](https://download.geofabrik.de/europe/united-kingdom.html),
and [Australia and New Zealand](https://download.geofabrik.de/australia-oceania.html).
Choose a state, province, territory, or other bounded sub-region when possible;
country-wide inputs can require much more time, RAM, and temporary storage.

## 3. Start Map Room on your network

Find the server computer's LAN IP address, then allow that address explicitly:

```sh
MAP_ROOM_DEFAULT_REGION=rhode-island \
MAP_ROOM_ALLOWED_HOSTS=192.0.2.10 \
docker compose up -d --wait --force-recreate
```

Replace `192.0.2.10` with the real LAN address. Open
`http://SERVER-LAN-IP:8088` in another device's browser. Do not use `localhost`
from the ATAK device: there it means the Android device itself.

If you use a DNS name, put that name in `MAP_ROOM_ALLOWED_HOSTS`. Keep Map Room
on a trusted network until the project has an authenticated deployment mode;
the current prototype is not an internet-facing service.

`--force-recreate` is intentional. Map Room regenerates TileServer's regional
configuration when a map is added or replaced, and an already-running tile
container must restart before it can load that configuration.

## 4. Choose the ATAK path

Open Map Room in the ATAK device's browser and expand **Map controls**.
Before choosing, read [ATAK map delivery and file types](ATAK_MAP_TYPES.md) for
the difference between hosted streaming, ATAK area caching, and a complete
regional MBTiles archive.

### Streaming vector map — preferred

For one installed region, download its vector source JSON and the currently
selected style JSON. Import the source, open the new layer's options, select
**Set Layer Style**, choose **Import File**, and import the style. Vector is the
preferred hosted path because it usually transfers and caches less data while
keeping labels and geometry sharp. It has a narrower, version-sensitive ATAK
compatibility surface, so validate the exact ATAK release.

### Raster/TMS-style map source — compatibility option

Download one of the themed ATAK map-source XML files. Import it with ATAK's
Import Manager, select the new map in the map layer controls, and verify tiles
at several zoom levels. Map Room renders the PNG images, which is simpler for
the client to display but usually transfers more data. The XML points to the
tile service; it does not contain a portable map.

The full regional MBTiles archive is also available as an optional download.
Large archives may be inconvenient to transfer and store on Android.

## 5. Perform the device/offline check

Record the ATAK version, Android version, device model, Map Room commit, region,
and theme. Then verify:

- the import is accepted without renaming the file;
- roads, labels, water, POIs, and attribution render;
- zooming and panning request the expected area;
- ATAK's area-download/cache operation completes for a small bounded area;
- the same area remains usable after Wi-Fi and mobile data are disabled;
- uncached areas fail clearly rather than showing misleading old coverage;
- reconnecting resumes normal service.

Passing Map Room's automated tests proves server behavior. It does not replace
this ATAK test.

## 6. Update or remove a map

Re-run the creation command with the same ID and `--force` to build from current
source data. The tool builds into a temporary file before replacing the
archive, but this prototype does not yet implement production rollback or
retention. Back up a working archive before replacing it.

To stop the service:

```sh
docker compose down
```

Map data lives under `data/`. It is intentionally not committed to Git.

## Troubleshooting

- **Build is killed:** increase `--memory` and confirm Docker has enough RAM and
  swap. Larger regions also need substantially more temporary disk space.
- **ATAK imports a `.txt` file:** download through the Map Room page. Its map
  files are served with the content types and filenames expected by ATAK.
- **Map imports but remains blank:** confirm the URL uses the server's LAN IP or
  DNS name, not `localhost`, and that TCP port 8088 is reachable.
- **Some details are absent:** the OpenMapTiles build profile filters features
  by zoom. Raster zooms above the archive's native maximum stay sharp but
  cannot recreate omitted source features.
- **An existing map blocks the command:** use another stable ID, or back up the
  existing archive and intentionally pass `--force`.

For exact tested limits, see [TEST_RESULTS.md](../TEST_RESULTS.md).
