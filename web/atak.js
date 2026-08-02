const atakThemes = {
  daylight: { name: "Daylight", color: "#f4f1ea" },
  midnight: { name: "Midnight", color: "#101820" },
  cyberpunk: { name: "Cyberpunk", color: "#060711" },
  "cyberpunk-tactical": { name: "Cyberpunk Tactical", color: "#03040b" }
};

export const RASTER_MAX_ZOOM = 18;
export const RASTER_PIXEL_RATIO = "@2x";

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

export function buildAtakXml(id, baseUrl) {
  const theme = atakThemes[id];
  if (!theme) throw new Error(`Unknown ATAK theme: ${id}`);
  const base = normalizeBaseUrl(baseUrl);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<customMapSource>
  <name>Map Room - ${theme.name}</name>
  <minZoom>0</minZoom>
  <maxZoom>${RASTER_MAX_ZOOM}</maxZoom>
  <tileType>png</tileType>
  <tileUpdate>IfNoneMatch</tileUpdate>
  <url>${base}/styles/${id}/{$z}/{$x}/{$y}${RASTER_PIXEL_RATIO}.png</url>
  <backgroundColor>${theme.color}</backgroundColor>
  <ignoreErrors>false</ignoreErrors>
  <serverParts></serverParts>
</customMapSource>
`;
}
