# ADR-0014: Use canonical, locally owned game-inspired map symbology

Status: Proposed

## Context

Map Room needs recognizable road shields and points of interest across browser,
offline, raster, and future provider integrations. Provider taxonomies differ,
and decorative symbols can imply facts that the source data does not contain.
Third-party game artwork would also introduce copyright and runtime dependency
risks.

## Decision

Map Room will map provider fields into documented canonical road and POI
categories. Styles may only render symbols backed by actual source features and
attributes. The project will generate and own a versioned local sprite atlas
using original geometric artwork and built-in tooling.

Cyberpunk Tactical will use a restrained strategy-game visual language:
luminous framed markers, compact route shields, zoom/rank decluttering, and
conservative defaults. Essential POIs are enabled by default; exploratory POIs
are opt-in. Browser vector and server-rendered raster modes share the same style
layers so ATAK PNG tiles receive the same default semantics.

Provider adapters may map different source fields into the canonical categories
but must not fabricate missing classifications, names, references, importance,
or operational status. Unknown classes degrade to no symbol rather than a
misleading generic marker.

## Consequences

The local atlas works without a CDN and its provenance is unambiguous. Adding a
provider requires an explicit mapping table and fixtures. Symbol collision,
visual density, accessibility, raster cost, and source-schema compatibility
become release-gated behavior. Explore visibility is a browser preference; the
default ATAK raster style remains the conservative Essential preset.

## Alternatives

- Use a third-party game icon pack: rejected because its identity, license, and
  visual language may not fit Map Room.
- Render every POI: rejected because it obscures geography and reduces trust.
- Infer missing POI categories: rejected because appearance would overstate the
  source evidence.
- Maintain separate vector and raster symbol definitions: rejected because they
  would drift.

## Links

- Issue #18
- ADR-0003
- ADR-0008
- ADR-0012
- ADR-0013
- MR-STYLE-001 through MR-STYLE-005
