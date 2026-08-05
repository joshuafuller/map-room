# ADR-0017: Render HiDPI raster tiles through zoom 20

Status: Proposed

## Context

Map Room's OpenMapTiles archives retain native vector tiles through zoom 14.
TileServer GL can overzoom those vectors and render a fresh raster image for a
closer requested zoom, but the browser raster source and ATAK XML were capped at
zoom 18. Beyond that point clients enlarged the last z18 bitmap, producing blur
even though the server could render sharper tiles.

The Google and Bing sources currently cataloged in `joshuafuller/ATAK-Maps`
declare zoom 0–20. Local probes confirmed that TileServer GL returns distinct,
valid 512×512 `@2x` PNG tiles for Map Room at zooms 19 and 20.

## Decision

Map Room will advertise and request server-rendered raster tiles through zoom
20 for every theme. The browser raster source and generated ATAK XML share one
maximum-zoom constant. Automated HTTP tests request actual z20 descendants and
verify their PNG dimensions so a client-side stretch of z18 cannot satisfy the
contract.

Zoom 20 is a deliberate delivery ceiling. Map Room will not advertise
unbounded overzoom or imply that rendered zoom equals native source zoom.

## Consequences

Close-in roads, buildings, labels, shields, and POIs remain rasterized at the
requested scale instead of being enlarged from a lower-resolution bitmap. ATAK
can request a range comparable to the cataloged Google and Bing sources.

The rendered z15–20 tiles still derive from z14 vector content. They cannot
recover features filtered during archive generation, imagery detail, indoor
mapping, or proprietary provider content. High zoom also increases the number
of cacheable tiles and can increase CPU, storage, and offline-download costs.

## Alternatives

- Keep z18: rejected because it causes avoidable client-side bitmap scaling.
- Advertise z22: rejected because Google/Bing parity only requires z20 and an
  unnecessarily high ceiling increases operational cost.
- Generate native OpenMapTiles through z20: rejected because the current
  Planetiler OpenMapTiles profile is designed around lower native maximum zooms
  and the storage explosion would not guarantee new source semantics.
- Claim Google/Bing-equivalent content: rejected because only the usable zoom
  range is comparable.

## Links

- Issue #22
- Issue #19
- ADR-0015
