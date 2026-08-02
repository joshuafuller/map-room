# ADR-0018: Compile installed regions into one runtime tile catalog

Status: Proposed

## Context

The prototype published one `current.mbtiles` symlink as TileServer GL data ID
`osm`. Installing California therefore displaced Florida even though both
archives remained on disk. The browser, raster URL, and ATAK XML had no region
identity, so two installed maps could not remain independently addressable.

Map Room also needs to add future regions and providers without duplicating
application code or hand-editing TileServer configuration for every theme.

## Decision

Each installed map has a stable, URL-safe region ID and a manifest in
`data/regions/<id>.json`. A startup compiler validates all manifests and their
archives, then generates:

- one TileServer data entry per region;
- one multi-source composed style per theme;
- a public `regions.json` catalog for the browser;
- unqualified theme aliases for the same composed styles.

Composed style IDs use `all-<theme>`, producing endpoints such as
`/styles/all-cyberpunk-tactical/...`. The compiler replaces the canonical
`osm` source with every registered regional source and duplicates each
source-bound style layer once per region. Background and non-regional layers
remain singular. This preserves the authored cartographic order while making
Florida and California visible through one rendered layer and one ATAK XML.
The browser's regional view control moves only the camera; it never switches
the underlying map layer.

Generated configuration and styles are runtime artifacts excluded from Git.
The canonical authored styles remain region-neutral and continue to use the
placeholder `mbtiles://{osm}`. The compiler clones each style and replaces only
that source binding, preserving theme-owned glyph and sprite assets.

Startup fails before the tile server is made healthy if a region ID is unsafe,
an ID is duplicated, the default is unknown, or an archive is missing. A
partially valid catalog is not published.

## Consequences

Every installed region stays visible simultaneously and ATAK stores one Map
Room layer per theme. Adding a region is a manifest-and-archive operation rather
than an authored code change. The number of generated styles follows the theme
count; source-bound layers inside each style grow with the region count while
sharing the same MBTiles archives and sprite assets.

The compatibility aliases prevent existing browser bookmarks and tile URLs
from breaking and resolve to the same composed map. New integrations should use
the explicit `all-<theme>` routes.

This decision covers published regional vector archives. A future provider
adapter may introduce a different source type and capability set; it must not
be falsely represented as OpenMapTiles-compatible merely to enter this
registry.

## Alternatives

- Swap `current.mbtiles`: rejected because only one map remains online.
- Run one full stack per region: rejected because it multiplies ports,
  processes, configuration, and operator burden.
- Merge all extracts into one archive: rejected because updates, provenance,
  rollback, and regional lifecycle become coupled.
- Publish one ATAK source per region: rejected because ATAK would expose
  multiple map layers instead of one continuously pannable Map Room layer.

## Links

- Issue #23
- ADR-0015
