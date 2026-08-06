export const realBuildingHeight = ["coalesce", ["get", "render_height"], 3];
export const realBuildingBase = ["coalesce", ["get", "render_min_height"], 0];

export function withRealBuildingExtrusion(paint = {}) {
  return {
    ...paint,
    "fill-extrusion-height": structuredClone(realBuildingHeight),
    "fill-extrusion-base": structuredClone(realBuildingBase),
    "fill-extrusion-vertical-gradient": true
  };
}
