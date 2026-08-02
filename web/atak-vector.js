const themeNames = {
  daylight: "Daylight",
  midnight: "Midnight",
  cyberpunk: "Cyberpunk Classic",
  "cyberpunk-tactical": "Cyberpunk Tactical"
};

function normalizeBaseUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("ATAK base URL must be an absolute HTTP or HTTPS URL");
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("ATAK base URL must be an absolute HTTP or HTTPS URL without credentials, query, or fragment");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function buildAtakVectorStyle({ theme, baseUrl, sourceId = "florida", sourceStyle }) {
  const themeName = themeNames[theme];
  if (!themeName) throw new Error(`Unknown ATAK theme: ${theme}`);
  if (!sourceStyle || sourceStyle.version !== 8 || !sourceStyle.sources || !Array.isArray(sourceStyle.layers)) {
    throw new Error("ATAK vector styling requires a Mapbox Style Specification v8 document");
  }

  const base = normalizeBaseUrl(baseUrl);
  const style = structuredClone(sourceStyle);
  const authoredSource = sourceStyle.sources.osm?.type === "vector" ? "osm" : sourceId;
  if (sourceStyle.sources[authoredSource]?.type !== "vector") {
    throw new Error(`ATAK vector source is unavailable: ${sourceId}`);
  }
  const layerSuffix = `--${authoredSource}`;
  style.name = `Map Room - ${themeName} - ATAK Vector`;
  style.sprite = `${base}/styles/${theme}/sprite`;
  style.glyphs = `${base}/fonts/{fontstack}/{range}.pbf`;
  style.sources = { osm: { type: "vector", url: `${base}/data/${sourceId}.json` } };
  style.layers = style.layers
    .filter((layer) => !layer.source || layer.source === authoredSource)
    .map((layer) => {
      if (!layer.source) return layer;
      layer.source = "osm";
      if (layer.id.endsWith(layerSuffix)) layer.id = layer.id.slice(0, -layerSuffix.length);
      return layer;
    });
  return style;
}
