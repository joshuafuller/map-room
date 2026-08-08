# Verifying ATAK behaviour against the shipped APK, not the SDK source

## Why this document exists

The ATAK source in `tak.gov/atak-civ` is **5.7.0.FF**. The APK under test —
and the one users run — is **5.8.0.1 (9698988)**. Conclusions drawn from the
source therefore describe a version that is not the one shipping, and
`ATAK_Supported_Map_Types.md` in that tree is stale in **both** directions:
it lists shipped features as planned, and at least one supported format has no
trace in the binary.

Anything load-bearing must be checked against the APK.

## Method

No decompiler needed for most questions:

```sh
unzip -q ATAK-5.8.0.1-9698988-civ-release.apk 'classes*.dex' 'lib/x86_64/*'
strings -a classes*.dex | grep -i <marker>
strings -a lib/x86_64/*.so | grep -i <marker>
dexdump -d classes2.dex > dex.txt      # Android build-tools
```

Format support leaves fingerprints: MIME types, asset paths, config-option
names, class descriptors. Absence of every plausible marker is strong evidence
of absence; presence needs a second look, because a string may be vestigial.

## Findings against 5.8.0.1

| Format / feature | 5.7 doc says | 5.8 binary shows | Verdict |
| --- | --- | --- | --- |
| **PMTiles** | not mentioned | **0 strings**, dex and native | Genuinely unsupported — remains a plugin candidate |
| **COMTiles** | not mentioned | **0 strings** | Unsupported |
| **Shortbread** | Planned 5.8+ | **0 strings** | Still absent — remains a candidate |
| **Cesium Quantized Mesh** | Planned 5.8+ | **194 strings** in `libtakengine.so`, 10 in dex | **Shipped.** Do not build |
| **ESRI TPKX / VTPK** | In development 5.7 | `application/vnd.esri.tpkx`, `application/vnd.esri.vtpk` | **Shipped.** Do not build |
| **Terrarium** | Supported | **0 strings** | Unclear — may be handled as generic RGB terrain, or absent |
| **`vector-tiles.dark-default`** | present in 5.7 source | **absent from every native lib** | **Removed.** No dark switch in 5.8 |
| Style assets referenced | `bright`, `dark`, `overlay` (5.7 native) | dex references **`bright` and `overlay` only** | The bundled `omt/dark/style.json` appears unreferenced |
| Custom stylesheet import | Planned 5.7+ | no obvious marker, but see below | Unresolved |

### The dark-switch question, answered

Earlier testing set `mapengine.vector-tiles.dark-default=1` via
`devopts.properties` and saw no change, cause unknown. The binary explains it:
**neither `vector-tiles` nor `dark-default` appears anywhere in the 5.8 native
libraries**, and the dex references only the `bright` and `overlay` style
assets. The option does not exist in this version. Nothing was misconfigured.

### A new mechanism in 5.8 worth pursuing

Style selection moved out of the native `jglvectortiles.cpp` search loop that
5.7 used. The 5.8 `GLVectorTiles` class carries fields absent from the 5.7
source:

```
styleDocUpdater : Lcom/atakmap/map/layer/feature/vectortiles/GLVectorTiles$h;
style           : Ljava/lang/String;
tilesUrl        : Ljava/lang/String;
renderedContent : Z
```

and registers that updater as a listener against a style registry:

```
invoke-direct  GLVectorTiles$h.<init>(GLVectorTiles)
invoke-static  vectortiles/b.a(vectortiles/b$c)
```

A style *document updater* subscribing to a registry implies styles can change
at runtime, which is what "custom style sheet import" would require. The class
is obfuscated to single letters, so establishing whether an **external** style
document can be supplied needs a proper decompiler — jadx first, Ghidra for the
native side.

### Resolved by decompilation: two routes exist, one of them usable

Decompiled `classes2.dex` with jadx. `com.atakmap.map.layer.feature.vectortiles.b`
is a **public static style registry**:

```java
public static void g(File tileset, String name, String styleUri)   // register for one tileset
static void h(String name, String styleUri, predicate)             // register by schema/role
public static Collection<Map.Entry<String,String>> f(TileMatrix, boolean overlay)
public interface c { void onStyleRegistered(File, String, String); ... }
```

ATAK registers its own built-ins through exactly this API:

```java
b.h("TAK Maps (Overlay)", "asset:/style/omt/overlay/style.json", <omt, Overlay>);
b.h("TAK Maps",           "asset:/style/omt/bright/style.json",  <omt, Basemap>);
```

An entry is **(display name, style document URI)**. Both `g` and `h` use
`addFirst`, so a later registration takes precedence.

`GLVectorTiles.getStylePath()` resolves in two steps:

```java
Map.Entry entry = first(b.f(this.tileMatrix, this.isOverlay));
if (entry != null) return entry.getValue();          // 1. registered style
arj md = TileMatrix.a.c(this.tileMatrix, arj.class); // 2. tileset metadata
return md.a().get("styleUrl");
```

**Route 1 — register a style. Works, needs in-process code.** A plugin can call
`b.g(file, "Map Room Daylight", "http://…/style.json")` and win, because
registrations go to the front.

**Route 2 — `styleUrl` in tileset metadata. Exists but is unreachable for us.**
The streaming descriptor's `metadata` object is passed through wholesale as
tile-matrix metadata (`vu.s`, populated from `optJSONObject("metadata")` at
schema >= 2.1, surfaced by `StreamingTileClient.a()`), so `styleUrl` does reach
`getStylePath()`. **But it is only consulted when no registered style matched**,
and ATAK's built-in `"TAK Maps"` matches any OMT basemap. Tested: a descriptor
carrying
`"metadata": {"styleUrl": "http://10.0.2.2:8088/styles/daylight/style.json"}`
registered and streamed correctly — tiles were served — but Map Room's access
log shows ATAK **never requested the style document**. The key exists for
schemas ATAK does not recognise, which is why the VTPK reader sets it.

**Conclusion: supplying a Map Room style to ATAK's vector renderer requires a
plugin.** The API is public and stable-looking, so the plugin work is small —
but there is no no-plugin route for an OMT tileset.

### Also established: streaming vector registers, and supports caching

Placing the `StreamingTiles` descriptor in `atak/imagery/mobile/mapsources/`
registers it as a selectable map source (`Map Room - Colorado`), and selecting
it streams tiles — verified by access log, `User-Agent: TAK`. Importing the same
`.json` by URL does nothing at all: no resolver claims it, another silent
failure.

`StreamingTileClient.cache(CacheRequest, listener)` is implemented, gated on the
descriptor's `downloadable` flag:

```java
if (!this.e.f) { listener.onRequestError(…, "Source is not downloadable", true); return; }
```

`vu.f` is `downloadable` from the descriptor JSON, defaulting true. So the
engine supports region caching of a streaming vector source — which is what
[#109](https://github.com/joshuafuller/map-room/issues/109) asks. What remains
untested is whether any stock UI drives it for vector.

## Consequences for earlier conclusions

Findings from **runtime testing** on the 5.8 emulator stand — the import
routes, the GRG behaviour, the plain-zip result, offline rendering, the
measured sizes. Those were measured against the real app.

Findings from **reading 5.7 source** need re-checking before they are relied
on. In particular, [ADR-0024](adrs/0024-atak-delivery-hosted-by-link-offline-by-file.md)
cites `jglvectortiles.cpp` for the claim that a style document cannot be
supplied. That claim is correct for 5.7 and **unverified for 5.8**, where the
mechanism has visibly changed.
