# Primary user persona

## ATAK user creating or hosting a basemap

Map Room's primary user ranges from a first-time ATAK user to an experienced
operator, but the product assumes no prior knowledge of GIS servers, vector
tiles, raster tiles, MBTiles, or MapLibre styles.

The user wants one of two outcomes:

1. **Host maps on a local Map Room server.** ATAK devices can reach that server
   over a trusted LAN and request map tiles while they move around the map.
2. **Prepare a map for completely disconnected use.** The map data must be
   transferred to the ATAK device before departure and remain usable when the
   Map Room server and every network are unavailable.

Both are first-class workflows. Map Room should explain the operational
consequence and let the user choose; it should not assume that hosted streaming
or complete offline transfer is inherently better.

## Knowledge assumptions

The interface may assume that the user can open ATAK's Import Manager and move
a downloaded file to an Android device. It must not assume that the user knows:

- that XML and JSON downloads can be configuration pointers rather than maps;
- the difference between raw `.osm.pbf`, vector tile `.pbf`, and `.mbtiles`;
- that an MBTiles archive can contain raster or vector tiles;
- that area caching covers only the selected bounds and zoom levels;
- that “streaming” requires a reachable server and does not imply live data;
- that vector source and vector style JSON are separate ATAK imports.

## Required information hierarchy

The interface should reveal decisions in this order:

1. **Hosted or completely offline?** State whether Map Room must remain
   reachable during use.
2. **If hosted: vector or raster/TMS?** Recommend vector for its usually smaller
   transfers, sharper rendering, and reusable geometry. Present raster/TMS as
   the simpler, broadly compatible fallback because Map Room does the styling.
   Keep the vector path's ATAK-version sensitivity visible.
3. **If offline: which bounded region?** Show archive size before transfer and
   require an individual publication rather than the composed browser view.
4. **Optional technical detail:** explain file formats, URL templates, styling,
   sprites, glyphs, and cache behavior for users who want it.

Map content should also use automatic progressive disclosure rather than a
panel of detail buttons: essential POIs appear first, Explore POIs at street
level, and addresses and parking only at close neighborhood/building zooms.

## Language rules

- Say what a download contains: “raster source (.xml),” “vector source
  (.json),” “vector style (.json),” or “regional archive (.mbtiles).”
- Never label a pointer file as “all maps” or imply that downloading it copies
  map data.
- Distinguish **cached area** from **complete offline archive**.
- Explain that TMS describes how a client requests individual tiles; it is not
  a single portable map file like MBTiles.
- Use **connected streaming** rather than “real-time maps” unless discussing
  actual data freshness.
- Keep device-validation boundaries visible. Server tests do not prove ATAK
  import, styling, caching, restart, or disconnected behavior.
