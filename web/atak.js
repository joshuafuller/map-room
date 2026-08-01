const atakThemes = {
  daylight: { name: "Daylight", color: "#f4f1ea" },
  midnight: { name: "Midnight", color: "#101820" }
};

export function buildAtakXml(id, baseUrl) {
  const theme = atakThemes[id];
  if (!theme) throw new Error(`Unknown ATAK theme: ${id}`);
  const base = baseUrl.replace(/\/$/, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<customMapSource>
  <name>Map Room - ${theme.name}</name>
  <minZoom>0</minZoom>
  <maxZoom>14</maxZoom>
  <tileType>png</tileType>
  <tileUpdate>None</tileUpdate>
  <url>${base}/styles/${id}/{$z}/{$x}/{$y}.png</url>
  <backgroundColor>${theme.color}</backgroundColor>
</customMapSource>
`;
}
