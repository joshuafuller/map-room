# ADR-0016: Share map intelligence across every theme

Status: Proposed

## Context

Cyberpunk Tactical introduced road shields, recognizable POIs, airport
geometry, semantic visibility presets, and a premium local sprite pipeline.
Those features are map information rather than properties of one aesthetic.
Keeping them Tactical-only made Daylight, Midnight, and Cyberpunk Classic less
useful and forced users to choose between familiar cartography and richer map
content.

The original Tactical work also protected Cyberpunk Classic with an exact file
digest. That was appropriate while Tactical was an additive experiment, but an
exact digest prevents intentional shared capabilities from reaching Classic.

## Decision

All map themes will implement one canonical map-intelligence contract:

- route shields backed by actual route references and networks;
- Essential emergency, service, fuel, and port POIs;
- opt-in Explore food, lodging, attraction, shopping, and parking POIs; and
- airport markers, airport areas, runways, and taxiways.

The style builder owns one set of filters, zoom rules, icon mappings, and
visibility defaults. Each theme supplies only visual tokens. The sprite builder
uses the same Lucide-backed silhouettes to generate theme-owned standard and
HiDPI atlases with suitable foreground, frame, fill, and semantic accent
colors.

Essential remains visible and Explore remains hidden by default everywhere.
The web controls and optional 3D building extrusions work for every vector
theme. Urban glow, coastline glow, and the restricted road-glow hierarchy
remain Tactical-only. The experimental coordinate grid was removed because its
layer ordering did not provide a dependable usable overlay.

The exact Cyberpunk Classic style-file digest is superseded by semantic
regression checks for its core background, road palette, glow strategy, and
label treatment. Additive shared information layers are now permitted.

## Consequences

Users receive consistent information when changing appearance or moving from
browser vector rendering to ATAK raster delivery. Source categories cannot
silently drift between themes, and a new theme must define a contrast palette
and satisfy the same semantic tests.

Theme sprite files add modest generated repository and runtime size. Visual
review is required because structural tests cannot establish recognition,
collision density, or perceptual contrast. Changes to shared filters affect all
themes and therefore require representative vector and raster evidence.

## Alternatives

- Keep rich information Tactical-only: rejected because map capability should
  not depend on aesthetic choice.
- Reuse the Tactical sprite unchanged: rejected because its dark neon frames
  do not provide appropriate contrast or identity in every theme.
- Copy the layer definitions four times: rejected because semantic filters and
  zoom behavior would drift.
- Keep the exact Classic digest: rejected because it forbids the explicitly
  requested additive information contract.

## Links

- Issue #21
- ADR-0014
