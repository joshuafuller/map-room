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
