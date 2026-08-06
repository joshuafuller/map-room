export function poiLayerIds(style, layerId) {
  if (!Array.isArray(style?.layers)) return [];
  return style.layers
    .map(({ id }) => id)
    .filter((id) => id === layerId || id.startsWith(`${layerId}--`));
}

export function poiLayerVisibility({ enabled, hud }) {
  return enabled && hud ? "visible" : "none";
}
