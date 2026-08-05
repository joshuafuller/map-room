export function buildingLayerIds(style) {
  if (!Array.isArray(style?.layers)) return [];
  return style.layers
    .map(({ id }) => id)
    .filter((id) => id === "buildings-3d" || id.startsWith("buildings-3d--"));
}
