# Why getting maps into ATAK is hard, and what would actually fix it

A first-principles reading of ATAK's map support, based on what this session
measured and decompiled. The behaviours are evidence. The explanations of *why*
are inference, labelled as such — they are a working theory that predicts the
behaviour well, not something ATAK's authors have stated.

## The single assumption that explains almost everything

**ATAK assumes a provisioning authority exists.**

Someone else — a geospatial cell, an S-6, a unit tech — decides which basemap
the force uses, prepares the data, images the devices, and is reachable when it
breaks. ATAK is built as the *consumer* end of a supply chain whose other end is
staffed.

Once you assume that, every friction measured this session stops looking like an
oversight and starts looking like a deliberate trade. And every one of them
becomes a defect the moment the authority does not exist.

| Measured behaviour | What it implies about the assumed user |
| --- | --- |
| Any non-terrain `.mbtiles` is claimed by `ImportGRGSort`, which promotes itself above every other resolver | A `.mbtiles` you were handed is presumed to be a **GRG** — an overlay of an objective, building or route — because your **basemap came from the supply chain**. The default is "this goes on top of the issued map", not "this is your map" |
| The resolver prompt appears only on file imports, never on URL imports | A URL was given to you by someone who knew what they were sending. A loose file is the ambiguous case |
| A Data Package silently fails to register map sources | Data Packages carry **mission data** with a mission lifecycle — delete-with-package, sender-declared contents. A basemap is infrastructure, and infrastructure is not supposed to arrive this way |
| Styles are compiled into the app; only in-process code can register another | Appearance is a **fielding decision**. A common operating picture depends on everyone's map looking the same. User-chosen styling is a liability, not a feature |
| ~15 interactions before a map can be imported at all | Device setup is done once, by someone who does it often |
| No progress bar on a 356 MB import; failures are silent | An operator who can read a log, or a tech they can call |
| DTED is the elevation baseline | A military standard, from a supply chain that ships military standards |
| RBT exists as a distinct schema and projection | The bottleneck for coalition data is **release approval**, not technology. RBT is a policy artifact wearing a file format |

None of these are stupid. They are correct for a staffed force. They are wrong
for a volunteer SAR team, a fire district, or — increasingly — a small unit
whose geo support is one overworked person three timezones away.

## The fundamentals: what "getting a map" actually involves

Strip away formats and the job breaks into seven steps. ATAK supports the middle
of this well and the ends barely at all.

| # | Step | State today |
| --- | --- | --- |
| 1 | **Discover** — find a map covering where I am going | Nothing. You must already know a source |
| 2 | **Scope** — choose area, zoom depth, content | Nothing in-app for offline. Decided at build time by whoever made the file, and [not recoverable later](ATAK_IMPORT_WORKFLOWS.md) |
| 3 | **Acquire** — get the bytes to the device | QR/URL import works; large transfers are opaque |
| 4 | **Register** — make ATAK treat it as the right *kind* of thing | The weak point. Same file becomes a basemap or an overlay depending on route |
| 5 | **Verify** — confirm it works *before* leaving comms | Nothing. You find out in the field |
| 6 | **Update** — refresh without redoing everything | Untested, probably nothing |
| 7 | **Share** — device to device, no server | **The gap.** See below |

### The sharpest gap: TAK can share everything except maps

TAK's whole culture is peer sharing, and it has real infrastructure for it —
Data Packages, over a TAK server or by direct transfer. Markers, routes, media,
CoT: all move device to device without a server admin.

**Maps are the one thing that mechanism does not carry.** Verified: a Data
Package containing map definitions extracts and then silently registers nothing,
because the Mission Package extractor files declared contents in a package
sandbox the imagery resolvers never inspect.

So the one workflow a user already understands — "send it to me in a Data
Package" — is precisely the one that fails for maps, and fails without an error.
That is the deepest usability defect found in this session, and it is
structural rather than accidental: mission data and infrastructure data have
different lifecycles, and maps got filed under the wrong one.

## What the community already built, and what it tells us

[ATAK-Maps](https://github.com/joshuafuller/ATAK-Maps) is the clearest evidence
of the missing authority being supplied by hand. It ships a curated collection
of MOBAC `customMapSource` XML pointers — Bing, ESRI, Google, USGS, NAIP,
OpenTopo, national providers — as **a single zip from GitHub Releases**,
imported through ATAK's Import feature, after which "maps populate
automatically".

Three things follow, and they sharpen everything above.

**The plain-zip-of-map-sources pattern is already the proven distribution
method.** This session arrived at it independently by testing, and found that
adding a `MANIFEST` breaks it. ATAK-Maps has been shipping exactly that shape at
scale. That is convergent evidence, not a coincidence: it is the only mechanism
that works.

**Stream-then-cache is already the normal offline workflow, for raster.** From
the project's install guide: choose the source, open Map Manager, *Download*,
draw a region, choose zoom levels, and the tiles persist offline in SQLite.
So the model of "one streaming source, cache the area you need" is not a future
idea — it is what these users do today. It also refines
[#109](https://github.com/joshuafuller/map-room/issues/109): the open question
is narrowly whether that same region download works for a **vector** streaming
source. The 5.7 roadmap entry "Map Manager download" sits under *Vector Tiles*
for exactly that reason.

**And it shows precisely where the remaining pain is.** What ATAK-Maps cannot
solve, because no XML pointer can:

| Gap | Why it persists |
| --- | --- |
| Raster caches are large | Raster is ~17x vector for the same coverage, and does not share styling across looks |
| Depends on third-party online services | Terms of service, rate limits, availability, and nothing works without transit to the public internet |
| No help scoping | The user guesses at region and zoom depth, and cannot add depth later |
| No verification | You learn it did not cache enough when you are already out of comms |
| No peer sharing of the result | The cache is on one device. The person beside you starts from scratch |
| Nothing self-hosted | A unit with its own imagery has no path that looks like this |

That is the actual shape of the problem: the *acquisition* pattern is solved and
popular; **scope, verification, sharing, and self-hosting are not.**

## What a fix has to be

Not "support another format". The formats mostly work. What is missing is the
**provisioning authority itself**, supplied as software.

That reframes the goal. The question is not "which container should we ship" but
**"what would a geospatial cell do for this user, and can that be automated?"**
A cell would: know what coverage exists, cut the area you need at the depth you
need, put it on your device in the right place, tell you it worked, and hand you
a copy to give the person next to you.

Design consequences that follow, each traceable to a measured finding:

1. **Registration must be deterministic, not route-dependent.** The same map
   arriving by any route must become the same kind of thing. Today it does not.
2. **Failure must be loud.** Every silent failure found here — the manifest, the
   URL-imported `.json`, the null-island overlay — is unrecoverable for a user
   without a support tech.
3. **Scope must be a user decision at acquisition time, not a build-time guess.**
   Zoom depth cannot be added later.
4. **Verification must happen before departure**, on the device, offline, as an
   explicit step.
5. **Peer sharing must work for maps**, because that is how this community
   already moves everything else.
6. **No new infrastructure to stand up.** A volunteer organisation will not run
   a server. Whatever this is must work from a laptop and a file.

## Where the leverage is

From the decompilation, the extension points needed for all six already exist
and are public:

- `TileContainerFactory.registerSpi` / `DatasetDescriptorFactory2.register` /
  `GLMapLayerFactory.registerSpi` — new formats and renderers
- `ImportExportMapComponent.addImporterClass` — own the registration decision
  rather than losing it to `ImportGRGSort`
- `vectortiles.b.g(File, name, styleUri)` — supply our own styles, and win,
  because registrations take precedence
- `StreamingTileClient.cache(CacheRequest, …)` — region caching, gated on a
  `downloadable` flag we already set
- `ElevationSourceManager.attach` — terrain

The plugin's shape is still open. Its *job* is not: be the provisioning
authority that DoD users have and everyone else does not.

## What to settle before designing anything

1. Whether region caching can be driven for a streaming vector source
   ([#109](https://github.com/joshuafuller/map-room/issues/109)) — decides
   whether "scope" and "acquire" collapse into one gesture.
2. Whether a plugin can make map sharing work through Data Packages, which is
   the workflow users already have.
3. What non-DoD users hit in practice. ATAK-Maps has an issue tracker, a
   Discord, and download counts — that is real usage data about where people
   get stuck, and it is worth more than further decompilation. The failure modes
   users actually report should drive the priority order above, rather than the
   ones this session happened to trip over.
