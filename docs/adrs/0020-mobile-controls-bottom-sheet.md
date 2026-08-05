# ADR-0020: Collapse map controls behind a floating control

Status: Proposed

## Context

The desktop control panel was repositioned at the bottom on narrow screens but
remained fully expanded. On a typical mobile Chrome viewport it measured 546
CSS pixels tall and obscured most of the map, preventing the map itself from
being the primary interface.

## Decision

At every viewport size, the controls start completely hidden behind a 54-pixel
floating controls button. The button has an explicit accessible label, exposes
state through `aria-expanded`, and expands or collapses the panel with one tap.
On mobile, expanded content scrolls inside the available viewport instead of
growing beyond it.

Desktop and mobile use the same closed-by-default interaction. Motion is
disabled when the user requests reduced motion.

## Consequences

Users retain nearly the entire viewport for map gestures and can still reach
every control. Expanding the panel intentionally covers part of the map, but it
can be dismissed immediately; on mobile it never becomes taller than the
available viewport.

The initial mobile state favors map visibility over immediate exposure of all
style and export choices. The persistent floating control keeps those choices
discoverable without leaving a full-width bar across the map.

## Alternatives

- Keep the full panel open: rejected because it obscures the product's primary
  content.
- Remove controls on mobile: rejected because mobile users still need theme,
  raster, POI, and ATAK actions.
- Use a separate mobile page: rejected because it duplicates behavior and
  creates inconsistent map state.

## Links

- Issue #26
