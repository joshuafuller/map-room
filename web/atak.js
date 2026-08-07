export const atakThemes = {
  daylight: { name: "Daylight", color: "#f4f1ea" },
  midnight: { name: "Midnight", color: "#101820" },
  "dark-blue": { name: "Dark Blue", color: "#07111f" },
  "dark-red": { name: "Dark Red", color: "#160909" },
  "dark-green": { name: "Dark Green", color: "#07120d" },
  cyberpunk: { name: "Cyberpunk", color: "#060711" },
  "cyberpunk-tactical": { name: "Cyberpunk Tactical", color: "#03040b" }
};

export const RASTER_MAX_ZOOM = 20;
export const RASTER_PIXEL_RATIO = "@2x";
const WEB_MERCATOR_LIMIT = 20037508.342789244;
const WEB_MERCATOR_MAX_LATITUDE = 85.0511287798066;

function normalizeBaseUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("ATAK base URL must be an absolute HTTP or HTTPS URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("ATAK base URL must be an absolute HTTP or HTTPS URL without credentials, query, or fragment");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

function projectBounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)) {
    throw new Error("ATAK vector publication requires finite WGS84 bounds");
  }
  const [west, south, east, north] = bounds;
  if (west < -180 || east > 180 || south < -WEB_MERCATOR_MAX_LATITUDE || north > WEB_MERCATOR_MAX_LATITUDE || west >= east || south >= north) {
    throw new Error("ATAK vector publication bounds must be an ordered Web Mercator-compatible WGS84 extent");
  }
  const x = (longitude) => longitude * WEB_MERCATOR_LIMIT / 180;
  const y = (latitude) => Math.log(Math.tan((90 + latitude) * Math.PI / 360)) * WEB_MERCATOR_LIMIT / Math.PI;
  return { minX: x(west), minY: y(south), maxX: x(east), maxY: y(north) };
}

export function buildAtakVectorDescriptor({ publication, baseUrl, tileJson }) {
  if (!publication || typeof publication.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publication.id)) {
    throw new Error("ATAK vector publication ID must be a safe lowercase slug");
  }
  if (typeof publication.name !== "string" || publication.name.trim() === "") {
    throw new Error("ATAK vector publication name is required");
  }
  if (!tileJson || tileJson.format !== "pbf") {
    throw new Error("ATAK vector publication requires PBF TileJSON");
  }
  if (tileJson.id && tileJson.id !== publication.id) {
    throw new Error("ATAK vector publication ID must match its TileJSON ID");
  }
  if (tileJson.minzoom !== 0) {
    throw new Error("ATAK implicit vector quadtrees must begin at zoom zero");
  }
  if (!Number.isInteger(tileJson.maxzoom) || tileJson.maxzoom < 0 || tileJson.maxzoom > 30) {
    throw new Error("ATAK vector publication has an invalid zoom range");
  }
  if (!Array.isArray(tileJson.vector_layers) || tileJson.vector_layers.length === 0) {
    throw new Error("ATAK vector publication requires vector layer metadata");
  }
  if (typeof tileJson.attribution !== "string" || tileJson.attribution.trim() === "") {
    throw new Error("ATAK vector publication attribution is required");
  }

  const base = normalizeBaseUrl(baseUrl);
  return {
    schema: "4.0.0",
    title: `Map Room - ${publication.name.trim()}`,
    url: `${base}/data/${publication.id}/{$z}/{$x}/{$y}.pbf`,
    attribution: tileJson.attribution,
    downloadable: true,
    overlay: false,
    srs: "EPSG:3857",
    bounds: projectBounds(tileJson.bounds),
    isQuadtree: true,
    numLevels: tileJson.maxzoom + 1,
    content: "vector",
    mimeType: "application/vnd.mapbox-vector-tile",
    metadata: { styleSchema: "omt" }
  };
}

export function buildAtakXml({ theme: themeId, baseUrl }) {
  const theme = atakThemes[themeId];
  if (!theme) throw new Error(`Unknown ATAK theme: ${themeId}`);
  const base = normalizeBaseUrl(baseUrl);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<customMapSource>
  <name>Map Room - ${theme.name}</name>
  <minZoom>0</minZoom>
  <maxZoom>${RASTER_MAX_ZOOM}</maxZoom>
  <tileType>png</tileType>
  <tileUpdate>IfNoneMatch</tileUpdate>
  <url>${base}/styles/all-${themeId === "daylight" ? "daylight-raster" : themeId}/{$z}/{$x}/{$y}${RASTER_PIXEL_RATIO}.png</url>
  <backgroundColor>${theme.color}</backgroundColor>
  <ignoreErrors>false</ignoreErrors>
  <serverParts></serverParts>
</customMapSource>
`;
}
