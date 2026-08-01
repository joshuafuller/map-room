# ADR-0008: Use one renderer with a versioned multi-theme style system

Status: Proposed

## Context

Multiple independent render stacks multiply schema, font, label, cache, and
upgrade differences. The desired visual variety can be achieved by rendering
compatible vector artifacts through distinct carefully designed styles.

## Decision

Use one pinned raster-capable tile service for version 1 and generate MapLibre
styles from centralized layers plus theme tokens. Release Daylight, Midnight,
Tactical Canvas, and High Contrast only for declared compatible schemas.

## Consequences

Renderer failure affects all rendered themes, so health and upgrade regression
testing are critical. Sources without a compatible vector schema remain usable
through their native capabilities but do not automatically gain these themes.

## Alternatives

- Separate renderer per theme: rejected as operationally redundant.
- Color-filter one base raster: rejected because good dark/high-contrast maps
  require cartographic decisions.
- Pretend all vector schemas are compatible: rejected.

## Links

- Issue #1
- MR-STYLE-001 through MR-STYLE-005
