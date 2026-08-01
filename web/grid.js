const emptyGrid = () => ({ type: "FeatureCollection", features: [] });

export function buildCoordinateGrid({ west, south, east, north }) {
  const values = [west, south, east, north];
  if (!values.every(Number.isFinite) || west >= east || south >= north || east - west > 2 || north - south > 2) {
    return emptyGrid();
  }

  const step = 0.05;
  const precision = 2;
  const features = [];
  const firstLongitude = Math.ceil(west / step) * step;
  const firstLatitude = Math.ceil(south / step) * step;

  for (let longitude = firstLongitude; longitude <= east; longitude += step) {
    const value = Number(longitude.toFixed(precision));
    features.push({
      type: "Feature",
      properties: { axis: "longitude", label: `${value.toFixed(precision)}°` },
      geometry: { type: "LineString", coordinates: [[value, south], [value, north]] }
    });
  }
  for (let latitude = firstLatitude; latitude <= north; latitude += step) {
    const value = Number(latitude.toFixed(precision));
    features.push({
      type: "Feature",
      properties: { axis: "latitude", label: `${value.toFixed(precision)}°` },
      geometry: { type: "LineString", coordinates: [[west, value], [east, value]] }
    });
  }

  return { type: "FeatureCollection", features };
}
