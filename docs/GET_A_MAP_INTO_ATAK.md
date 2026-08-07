# Get a Map Room map into ATAK

Every step below was performed on ATAK 5.8.0.1, and the button labels are what
you will actually see on screen. Engineering detail and evidence are in
[ATAK import workflows](ATAK_IMPORT_WORKFLOWS.md).

## First, decide what you need

| You want | Use |
| --- | --- |
| A map that works with **no network** | [Load an offline map](#load-an-offline-map) |
| Map Room's **styles**, on a network that reaches the server | [Scan the QR code](#scan-the-qr-code) |
| Both | Scan the QR code, then load the offline map as well |

The difference matters. A **style** tells ATAK how to draw tiles it fetches from
Map Room, so it needs the server. An **offline map** carries the tiles on the
device and works with nothing at all.

## Before you start

ATAK's first launch asks for a lot: a licence agreement, a permissions
explanation whose button stays greyed out until you scroll to the end of the
text, about a dozen Android permission prompts, all-files access, and a device
setup screen you can skip with `Done`.

Roughly fifteen taps, once per device, before any map will import. Do it before
you need the map.

## Scan the QR code

The fastest route, and the right one for styles.

1. **Scan the QR code** from Map Room. ATAK opens with a prompt naming the file.
2. **Tap `Yes`.** ATAK downloads and files everything inside. A large file takes
   a while and shows no progress bar — wait for it.
3. **Tap the folded-map icon** in the top toolbar and pick a style:
   `Map Room - Daylight`, `Map Room - Midnight`, or `Map Room - Dark Blue`.

Switching style later is one tap in that same list.

**If the archive also held an offline `.mbtiles`,** this route files it as an
*overlay* rather than a map. It works and it renders offline, but it appears
under `Overlay Manager -> Image Overlay` instead of the map list.

This is not something a better QR code can fix. ATAK never offers the choice on
a downloaded file — only on a file already sitting on the device. If you want
the offline map in the map list, use the next section.

## Load an offline map

Use this when you want the offline map in the map list, selectable as your base
map. Two ways; both give the same result.

### Through ATAK, from a file on the device

Put the `.mbtiles` anywhere on the device first — `Download` is fine.

1. Open the **menu** (three bars, top right) and choose **`Tools`**.
2. Scroll to and tap **`Import`**.
3. Choose **`Local SD`**.
4. Browse to the file, tick it, tap **`OK`**.
5. At **Suggested Import Strategy**, choose **`Copy`**.
   `Move` deletes the original; `Use In Place` leaves the file where it is.
6. At **Select Desired Import Method**, choose **`Imagery`**.

**Step 6 is the one that matters.** The other option, `Image Overlay File`,
files it as an overlay. `Imagery` makes it a map.

It then appears under the folded-map icon in the map list, showing its size and
the word `local`.

### By copying the file yourself

Same result, no ATAK steps. Connect the device by USB or use a file manager, and
put the file here:

```
Internal storage / atak / imagery / <region>.mbtiles
```

Style files live in the same folder:

```
Internal storage / atak / imagery / <style>.xml
```

Restart ATAK if something you copied in does not show up.

## How much map to take

An offline archive's size is decided by how far in you need to zoom, and the
detail is not recoverable later — a shallow archive cannot be zoomed into a
detailed one, because the detail was never in it.

| Depth | Colorado-sized region | What you get |
| --- | --- | --- |
| To zoom 12 | ~47 MB | Regional context; main roads, no street grid |
| To zoom 13 | ~118 MB | Intermediate |
| To zoom 14 | ~309 MB | Full street detail |

Decide before departure. Take the deeper archive if you will need street-level
detail, because you cannot add it in the field.

## Where things end up

| What | Where to find it |
| --- | --- |
| Styles | Folded-map icon -> map list |
| Offline map imported as `Imagery` | Folded-map icon -> map list, marked `local` |
| Offline map imported by QR, or as `Image Overlay File` | Menu -> `Overlay Manager` -> `Image Overlay` |

## Things that look broken and are not

**An offline map filed as an overlay says it is off the coast of Africa.** Its
entry shows a location of `31N AA 66021 00000`, and the entry's zoom-to button
jumps to 0°, 0°. The map data is in the right place — pan to your area and it is
there. Only the list entry is wrong. Importing as `Imagery` avoids this.

**A style draws nothing.** Styles fetch their tiles from Map Room. With no route
to the server there is nothing to draw. Use the offline map instead.

**A large import looks frozen.** There is no progress bar. A few hundred
megabytes takes a while. Leave it alone.

## When the map does not appear

| Symptom | Cause | Fix |
| --- | --- | --- |
| No import prompt after scanning | The QR points at an address this device cannot reach | Get on the same network as Map Room |
| Imported fine, style draws nothing | The style needs the server | Use the offline map, or reconnect |
| Imported fine, nothing appears anywhere | The archive was built with a `MANIFEST` folder inside | Rebuild it as a plain zip |
| Offline map missing from the map list | It was filed as an overlay | Re-import via `Tools -> Import -> Local SD` and choose `Imagery` |
| Copied a file in, still missing | The folder scan has not run | Restart ATAK |

## For whoever builds the archive

A plain zip, files at the root, **no `MANIFEST` folder**:

```
colorado.mbtiles
daylight.xml
midnight.xml
dark-blue.xml
```

The QR encodes:

```
tak://com.atakmap.app/import?url=<percent-encoded url to the zip>
```

Three rules that will silently break it if ignored:

- The host segment is exactly `com.atakmap.app` — **not** `com.atakmap.app.civ`,
  even though the installed package is `com.atakmap.app.civ`. ATAK compares it
  literally and ignores anything else.
- A `MANIFEST/manifest.xml` inside the zip stops the styles registering
  entirely. Leave it out.
- Generate the style definitions through the address the device will use. They
  embed their tile URL absolutely, so one generated against `localhost` hands the
  device a map that fetches from itself and draws nothing.
