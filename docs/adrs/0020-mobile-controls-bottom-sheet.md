# ADR-0020: Collapse map controls into a mobile bottom sheet

Status: Proposed

## Context

The desktop control panel was repositioned at the bottom on narrow screens but
remained fully expanded. On a typical mobile Chrome viewport it measured 546
CSS pixels tall and obscured most of the map, preventing the map itself from
being the primary interface.

## Decision

At widths of 680 CSS pixels or less, the controls become a bottom sheet that
starts collapsed. Its 62-pixel handle identifies “Map controls,” exposes state
through `aria-expanded`, and expands or collapses with one tap. Expanded content
scrolls inside the available viewport instead of growing beyond it.

Desktop controls remain expanded and the toggle is hidden. Crossing the mobile
breakpoint resets the panel to the appropriate default. Motion is disabled when
the user requests reduced motion.

## Consequences

Mobile users retain nearly the entire viewport for map gestures and can still
reach every control. Expanding the sheet intentionally covers part of the map,
but it can be dismissed immediately and never becomes taller than the available
viewport.

The initial mobile state favors map visibility over immediate exposure of all
style and export choices. The persistent labeled handle keeps those choices
discoverable.

## Alternatives

- Keep the full panel open: rejected because it obscures the product's primary
  content.
- Remove controls on mobile: rejected because mobile users still need theme,
  raster, POI, and ATAK actions.
- Use a separate mobile page: rejected because it duplicates behavior and
  creates inconsistent map state.

## Links

- Issue #26
