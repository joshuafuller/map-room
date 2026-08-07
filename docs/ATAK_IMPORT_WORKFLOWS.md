# ATAK import workflows: measured, not assumed

Every step here was executed against a real ATAK build on an emulator and
recorded. Where something has not been tested yet, it says so. Nothing in this
document is inferred from documentation alone.

## Test environment

| | |
| --- | --- |
| ATAK | 5.8.0.1 (9698988) `civ` release, package `com.atakmap.app.civ` |
| Android | 14 (API 34), `google_apis` x86_64 system image |
| Emulator | headless, KVM, 2400x1080 landscape, AVD `maproom_atak` |
| Map Room | served on the host, reached from the emulator at `10.0.2.2:8088` |
| Source | `tak.gov/atak-civ-client` |

### Two environment traps

**The `aosp_atd` system image cannot be used.** It is an Automated Test Device
build with no SysUI. `uiautomator` still reports a full view tree, so a script
can "find" and "tap" buttons and log success while the framebuffer stays black
and nothing advances. Screenshots come back as ~12 KB of solid black. Any
evidence gathered on that image is fiction. Use a full `google_apis` image.

**A control being present does not mean it can be tapped.** ATAK's Permission
Rationale dialog renders its buttons with `clickable="true"` but
`enabled="false"` until the body text is scrolled to the end. An early version
of the harness reported 25 successful taps on a disabled button. The driver in
`scripts/atak/ui.py` now refuses to report a tap unless `enabled="true"`.

## One-time device setup

These run once per device, before any map work. They are real user steps but
they are not part of the map workflow being optimised, so they are counted
separately.

| Step | Control | Notes |
| --- | --- | --- |
| 1 | `I agree.` | EULA |
| 2 | `I understand` | Permission Rationale — disabled until scrolled to the end |
| 3-9 | `While using the app` x3, `Allow` x4 | Runtime permissions |
| 10 | `Allow all` | Media access |
| 11 | Location settings page | A full Settings screen, not a dialog: select, then Back |
| 12 | `I understand` | File System Access Changes — all-files access |
| 13 | `Done` | TAK Device Setup — server configuration can be skipped |
| 14-15 | `OK`, `Allow` | Battery optimisation hints |

Roughly 15 interactions before a user can import anything.

For automation, two of these were set through adb rather than the UI, and are
therefore **not** measured user steps: 44 runtime permissions via `pm grant`,
and `MANAGE_EXTERNAL_STORAGE` via
`appops set com.atakmap.app.civ MANAGE_EXTERNAL_STORAGE allow`. The latter is a
special app-op that `pm grant` cannot set.

## How ATAK accepts an import by URL

From `ImportExportMapComponent.java` in the ATAK source:

- The receiver acts only when `uri.getHost() + uri.getPath()` equals exactly
  **`com.atakmap.app/import`**. A `tak://com.atakmap.app.civ/import?...` URI
  resolves the activity but is then ignored — the package suffix must not be
  used in the URI.
- The handler's own documentation gives a `.zip` as an example target:
  `tak://com.atakmap.app/import?url=http%3A%2F%2Fwebaddress.com%2Ffile%2Ffile.zip`
- On confirmation, `beginImport()` builds a `RemoteResource` of type
  `INTERNAL_TRANSIENT` and calls `_downloader.download(rr, true)`. ATAK
  downloads the URL itself and passes the result to its import resolvers.
- The intent is delivered to a running instance: ATAK does not need restarting.

## The semantic model: what ATAK does with what you hand it

Understanding this is what lets us design the workflow rather than guess at it.

### ATAK does not "install a map". It sorts a file.

An import is not a map-specific operation. ATAK receives a *file*, then asks its
**import resolvers** which one claims it. A resolver knows an extension, a
destination directory, and a display name. So the question "can ATAK import our
map?" is really "does a resolver claim this file, and does the resolver's
destination make it visible?"

That is why the raster import above works the way it does: the XML is claimed by
the imagery resolver, copied to `/sdcard/atak/imagery/`, and *only then* becomes
selectable. Landing on disk and being usable are the same event here, but they
are two different ideas, and for other file types they can diverge.

### A map source is a pointer, not the map

`daylight.xml` is a `customMapSource` definition: a name, a zoom range, a tile
type, and a URL template. It carries no tiles. ATAK renders by expanding that
template per tile and fetching over the network. Consequences that matter:

- The import succeeds even if the server is unreachable — failure appears later,
  as an empty layer, not as an import error.
- The embedded URL is absolute. It must be an address the *device* can resolve,
  which is why the origin the QR encodes is load-bearing.
- Deleting the map in Map Room does not remove the layer in ATAK; it makes it
  render nothing.

### Two kinds of zip, decided by one rule

From `MissionPackageExtractorFactory.GetExtractor()`:

```
if (HasManifest(zip)) return new MissionPackageExtractor();
else                  return new PlainZipExtractor();
```

`HasManifest` looks for **`MANIFEST/manifest.xml`** inside the zip
(`MissionPackageBuilder.MANIFEST_PATH`). So:

- **Data Package** — a zip *with* `MANIFEST/manifest.xml`. Contents are
  declared, named, and extracted as a described set.
- **Plain zip** — anything else. Extracted and sorted by the same resolvers,
  without declared contents.

Both are importable by URL. The manifest is what turns a bag of files into a
package with an identity ATAK can reason about — which is the mechanism a
"cap pack" of map plus stylesheets would rely on.

### What "streamlined" means, precisely

The user's cost is not downloads; it is **decisions and confirmations**. A single
artifact that ATAK can claim in one confirmation is streamlined even if it is
large. Several small files, each needing its own confirmation and its own
selection, is not. This is the axis to optimise, and it is why bundling is
worth proving rather than assuming.

## Verified: hosted raster map, one style

Deep link used (percent-encoded, host segment exactly `com.atakmap.app`):

```
tak://com.atakmap.app/import?url=http%3A%2F%2F10.0.2.2%3A8088%2Fapi%2Fatak%2Fraster%2Fdaylight.xml
```

| # | Action | Screen | One-time |
| --- | --- | --- | --- |
| 1 | Open the deep link (QR scan is equivalent) | — | |
| 2 | `Yes` | "Import http://10.0.2.2:8088/api/atak/raster/daylight.xml" | |
| 3 | Tap the folded-map icon | Map toolbar | |
| 4 | `OK` | Mobile Imagery hint | yes |
| 5 | `Map Room - Daylight` | Map Source list | |
| 6 | Back | — | |

**Six interactions, two of them one-time.**

Evidence:

- The definition lands at `/sdcard/atak/imagery/daylight.xml`.
- It appears in ATAK's Mobile Imagery list as `Map Room - Daylight`.
- After selection, Map Room served **1,373** tile requests with
  `User-Agent: TAK`, all HTTP 200 — for example
  `GET /styles/all-daylight-raster/3/2/0@2x.png`.
- ![Map Room raster rendering in ATAK](atak-evidence/rendered.png)

### Origin-aware URLs matter here

The generated XML embeds the tile URL from the requesting origin. Requested as
`localhost`, it embeds `http://localhost:8088/...`, which inside ATAK means the
*device itself* and yields a dead layer. Requested through the address the
device will actually use, it correctly embeds `http://10.0.2.2:8088/...`.
Whatever address the QR encodes must be the address the device can reach.

## Verified: many styles in one file — and the counter-intuitive result

**A Data Package does not register map sources. A plain zip does.** This is the
opposite of what the "cap pack" instinct suggests, and it was established by
running both.

### Attempt 1 — Data Package with `MANIFEST/manifest.xml`: fails

A zip containing three `customMapSource` definitions plus a v2 manifest
declaring each `<Content zipEntry="maps/*.xml">` with
`contentType="Imagery"`, imported via
`tak://com.atakmap.app/import?url=…%2Fmaproom-styles.zip`.

The import is accepted and extracted — the files land at
`/sdcard/atak/tools/datapackage/files/maproom-styles-0001/maps/` — but they are
never sorted into imagery:

```
DirectoryWatcher: (CLOSE_WRITE) filtered by type on .../maps/midnight.xml
DirectoryWatcher: (CLOSE_WRITE) filtered by type on .../maps/daylight.xml
DirectoryWatcher: (CLOSE_WRITE) filtered by type on .../maps/dark-blue.xml
```

The Mobile Imagery list afterwards contained only the previously,
directly-imported `Map Room - Daylight`. **Nothing from the package appeared.**

Note the failure mode: the user sees a successful import and gets no map. There
is no error to act on.

### Attempt 2 — plain zip, no manifest: works

The same two definitions zipped at the archive root with **no** `MANIFEST`
directory, imported the same way. `MissionPackageExtractorFactory.GetExtractor()`
routes a manifest-less zip to `PlainZipExtractor`, which runs the contents
through the normal import resolvers. Both files landed in
`/sdcard/atak/imagery/`, and all three styles then appeared in Mobile Imagery:

```
Map Room - Dark Blue
Map Room - Daylight
Map Room - Midnight
```

### Cost

| Delivery | User cost for *n* styles |
| --- | --- |
| One definition per deep link | 2n interactions, n imports |
| Data Package (`MANIFEST/manifest.xml`) | fails — extracted but never registered |
| **Plain zip of definitions** | **2 interactions, 1 import**, then 1 tap to switch style |

So the streamlined artifact for hosted styles is a plain zip. The manifest —
the thing that makes a zip a "Data Package" — is precisely what breaks it for
this content type.

### Why

`ImportLayersSort` claims imagery by **content sniffing**
(`ImageryFileType.getFileType`), not by extension, and it is reached through the
resolver chain that `PlainZipExtractor` feeds. The Mission Package extractor
places declared contents in its own package directory instead, where the
directory watcher filters them by type and no imagery resolver ever sees them.

## Verified: offline `.mbtiles` becomes a GRG overlay, not a base map

Importing Map Room's 356 MB Colorado vector archive by URL:

```
tak://com.atakmap.app/import?url=http%3A%2F%2F10.0.2.2%3A8088%2Fatak%2Fvector%2Fcolorado.mbtiles
```

The import succeeds. The file streams to `/sdcard/atak/tmp/` and is then sorted
to **`/sdcard/atak/grg/colorado.mbtiles`**:

```
ImportResolver: onFileSorted ... contentMime: Pair{External GRG Data application/octet-stream}
ImportFileTask: Sorting to /storage/emulated/0/atak/grg
ExternalLayerDataImporter: import: .../grg/colorado.mbtiles in 70ms
GRGMapOverlayListItem: files for colorado.mbtiles
```

It does **not** appear in Mobile Imagery. It appears under Overlay Manager ->
Image Overlay as `colorado.mbtiles` (`visible: on`, `outlines: on`) — an
overlay drawn on top of a base map, not a base map you select.

### Root cause

`ImportGRGSort.match()` claims any MBTiles that is not terrain:

```java
if (type.getID() == ImageryFileType.MBTILES) {
    MBTilesInfo mbTilesInfo = MBTilesInfo.get(file.getPath(), null);
    if (mbTilesInfo != null)
        return !Objects.equals(mbTilesInfo.content, "terrain");
}
```

and then promotes itself ahead of every other resolver:

```java
@Override
public void filterFoundResolvers(List<ImportResolver> importResolvers, File file) {
    // increase the priority of this sorter vs all of the others
    if (importResolvers.remove(this)) importResolvers.add(0, this);
}
```

So in ATAK 5.8 **every non-terrain `.mbtiles` delivered as a bare file becomes a
GRG overlay**, whatever it contains. There is no naming trick that avoids it:
the `.ovr.mbtiles` / `.ovr.sqlite` suffix checked earlier in the same method
forces overlay treatment *more* explicitly, it does not opt out of it.

### What this does not mean

ATAK 5.8 is not blind to vector tiles. `MBTilesInfo` maps `format = "pbf"` to
`content = "vector"`, `GLVectorTiles` renders content marked vector, and
`LayersManager` has a `case "vector"` branch. The capability exists; the bare
file import route simply does not reach it.

### Verified: it does not render, because georeferencing is lost

Tested by selecting the imported overlay and using **ATAK's own zoom-to action**
on it. The map moved to **0°, 0°** — the readout shows `31N AA 66021 00000`, the
UTM zone at the prime meridian, and the radial menu opened at the centre of the
globe off West Africa. ATAK believes the data lives at null island.

The archive's metadata is correct and complete:

```
bounds  = -109.0631,36.56774,-100.4637,41.00403     (Colorado)
center  = -104.7634,38.78589,6
format  = pbf
type    = baselayer
```

So the bounds are present and right. ATAK simply never reads them on this path.
The log is explicit — a 356 MB file "imported" in **70 ms**:

```
ExternalLayerDataImporter: import: /storage/emulated/0/atak/grg/colorado.mbtiles in 70ms
FileContentResolver: External GRG Data: Added handler for colorado.mbtiles
```

It registered a GRG handler without opening the tileset. Nothing is drawn over
Colorado because ATAK does not know the data belongs there.

**Conclusion: delivering a vector `.mbtiles` as a bare file to ATAK 5.8 does not
work.** It is not a size problem, not a metadata problem on our side, and not a
missing-style problem. The file is captured by the GRG sorter, which promotes
itself above every other resolver, and that path does not georeference a pbf
tileset. The user gets a successful import, a visible overlay entry, and no map.

The remaining question is not whether the bare-file route can be improved but
**which route reaches `GLVectorTiles` at all** — the renderer exists and
`LayersManager` has a `case "vector"`, so the capability is there and unused by
this path.

## Cost of the current multi-style workflow

Each theme is published as its own XML definition, so each one is a separate
deep link, a separate `Yes`, and a separate entry to select. For *n* styles the
user pays roughly **2 + 2n** interactions and performs *n* separate imports.
This is the cost the Data Package work is meant to remove.

## Not yet verified

Listed explicitly so nothing here reads as settled:

- Importing a second style and confirming the measured 2 + 2n cost.
- Whether one Data Package (`.zip`) can carry a map definition plus multiple
  stylesheets and register them all from a single confirmation, or whether ATAK
  prompts per contained file.
- Whether a vector source plus its style can be delivered together, and whether
  the style's sprite and glyph URLs resolve on the device.
- Offline `.mbtiles` delivery by Data Package, and the practical size ceiling.
  The 20 MB figure in #63 is a Mission Package *send* warning threshold in the
  source; no import limit has been established either way.

## Reproducing

```sh
# Full system image; the ATD image cannot render.
sdkmanager --install "system-images;android-34;google_apis;x86_64"
avdmanager create avd -n maproom_atak -k "system-images;android-34;google_apis;x86_64" -d pixel_6 --sdcard 4096M
emulator -avd maproom_atak -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 4096 -partition-size 8192

adb install -r ATAK-5.8.0.1-9698988-civ-release.apk   # full civ build ships x86_64; civSmall is arm64-only
python3 scripts/atak/first-run.py                      # walks setup, logs every screen and tap
```
