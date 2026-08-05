export function poiLayerIds(style, layerId) {
  if (!Array.isArray(style?.layers)) return [];
  return style.layers
    .map(({ id }) => id)
    .filter((id) => id === layerId || id.startsWith(`${layerId}--`));
}

export function poiLayerVisibility({ enabled, buildings3dEnabled, hud }) {
  return enabled && buildings3dEnabled === hud ? "visible" : "none";
}
