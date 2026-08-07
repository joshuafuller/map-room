# Get a Map Room map into ATAK

Three steps. Scan, confirm, pick a style.

The engineering evidence behind every claim here is in
[ATAK import workflows](ATAK_IMPORT_WORKFLOWS.md).

## Before you start

ATAK asks for a lot on first launch — a licence agreement, a permissions
explanation you must scroll to the end before its button works, roughly a dozen
Android permission prompts, all-files access, and a device setup screen you can
skip. That is about fifteen taps, once per device, before any map will import.

Do it before you need the map.

## The three steps

1. **Scan the QR code** from Map Room. ATAK opens with a prompt naming the file
   it is about to fetch.
2. **Tap `Yes`.** ATAK downloads the archive and files everything inside it.
   A large archive takes a while and shows no progress bar; wait for it.
3. **Tap the folded-map icon** in the top toolbar and choose a style —
   `Map Room - Daylight`, `Map Room - Midnight`, or `Map Room - Dark Blue`.

The map draws. Switching style later is one tap in the same list.

## What you just installed

One archive carries two different things, and they behave differently:

**The offline map** works with no network at all. Aeroplane mode, no signal,
nothing — the tiles are on the device.

**The styles** are instructions for drawing tiles fetched from Map Room. They
need to reach the server. Away from it, a style you select will draw nothing.

So: the offline map is what you rely on in the field, and the styles are for
when you are on the same network as Map Room.

## Two things that look broken and are not

**Your offline map is not in the map list.** An archive that arrived by QR is
filed under `Overlay Manager -> Image Overlay`, not with the map sources. Look
for `<region>.mbtiles` there, not under the folded-map icon. It still draws, and
it still works with no network — it is simply filed as an overlay.

If you copy the `.mbtiles` onto the device yourself, into `atak/imagery/`, it
appears in the map list instead and can be chosen as the base map. That is the
only way to get it there; ATAK always files an *imported* archive as an
overlay.

**It says it is off the coast of Africa.** The overlay's list entry shows a
location of `31N AA 66021 00000` and its zoom-to button jumps to 0 deg, 0 deg.
The map data itself is in the right place — pan to your area and it is there.
Only the list entry is wrong.

Both are ATAK behaviours. Nothing Map Room does changes them.

## When the map does not appear

| Symptom | Cause | Fix |
| --- | --- | --- |
| Import prompt never appears | The QR encodes an address the device cannot reach | Check the device is on the same network as Map Room |
| Import succeeds, style draws nothing | The style needs the server and cannot reach it | Use the offline map, or get back on the network |
| Import succeeds, nothing registers at all | The archive was built with a `MANIFEST` directory | Rebuild it as a plain zip |
| Cannot find the offline map | It is filed under Image Overlay | See above |

## For whoever builds the archive

A plain zip, files at the root, no `MANIFEST` directory:

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

The host segment is exactly `com.atakmap.app` — not `com.atakmap.app.civ`, even
though the installed package is `com.atakmap.app.civ`. ATAK compares it
literally and silently ignores anything else.

Generate the style definitions through the address the device will use. They
embed their tile URL absolutely, so a definition generated against `localhost`
hands the device a map that fetches from itself and draws nothing.
