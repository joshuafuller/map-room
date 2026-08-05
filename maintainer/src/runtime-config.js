const REGION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateRegistry(registry) {
  if (!registry || !Array.isArray(registry.regions) || registry.regions.length === 0) {
    throw new Error("Region registry must contain at least one region");
  }

  const ids = new Set();
  for (const region of registry.regions) {
    if (!REGION_ID.test(region.id ?? "")) throw new Error(`Invalid region ID: ${region.id ?? "missing"}`);
    if (ids.has(region.id)) throw new Error(`Duplicate region ID: ${region.id}`);
    if (typeof region.name !== "string" || region.name.trim() === "") throw new Error(`Region ${region.id} requires a display name`);
    if (typeof region.archive !== "string" || !REGION_ID.test(region.archive.replace(/\.mbtiles$/, "")) || !region.archive.endsWith(".mbtiles")) {
      throw new Error(`Region ${region.id} requires a safe MBTiles archive name`);
    }
    ids.add(region.id);
  }

  if (!ids.has(registry.defaultRegion)) throw new Error(`Unknown default region: ${registry.defaultRegion}`);
}

function sortedObject(entries) {
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
}

export function buildRuntimeArtifacts({ registry, themes }) {
  validateRegistry(registry);
  if (!themes || Object.keys(themes).length === 0) throw new Error("At least one map theme is required");

  const regions = [...registry.regions].sort((left, right) => left.id.localeCompare(right.id));
  const themeEntries = Object.entries(themes).sort(([left], [right]) => left.localeCompare(right));
  const dataEntries = [];
  const styleConfigEntries = [];
  const generatedStyleEntries = [];

  for (const region of regions) {
    dataEntries.push([region.id, { mbtiles: `/data/archive/${region.archive}` }]);
  }

  for (const [themeId, sourceStyle] of themeEntries) {
    if (sourceStyle?.sources?.osm?.url !== "mbtiles://{osm}") {
      throw new Error(`Theme ${themeId} must contain the canonical osm source`);
    }
    const stylePath = `collections/all/${themeId}.json`;
    const style = structuredClone(sourceStyle);
    const canonicalSource = sourceStyle.sources.osm;
    const staticSources = Object.fromEntries(Object.entries(style.sources).filter(([id]) => id !== "osm"));
    style.name = `${sourceStyle.name} — All installed maps`;
    style.metadata = { ...style.metadata, "map-room:regions": regions.map(({ id }) => id) };
    style.sources = {
      ...staticSources,
      ...Object.fromEntries(regions.map(({ id }) => [id, {
        ...structuredClone(canonicalSource),
        url: `mbtiles://{${id}}`
      }]))
    };
    style.layers = style.layers.flatMap((layer) => layer.source === "osm"
      ? regions.map(({ id }) => ({ ...structuredClone(layer), id: `${layer.id}--${id}`, source: id }))
      : [layer]);
    generatedStyleEntries.push([stylePath, style]);
    const configEntry = { style: stylePath, tilejson: { type: "baselayer" } };
    styleConfigEntries.push([`all-${themeId}`, configEntry], [themeId, structuredClone(configEntry)]);
  }

  const bounds = regions
    .map((region) => region.bounds)
    .filter((value) => Array.isArray(value) && value.length === 4)
    .reduce((combined, value) => combined
      ? [Math.min(combined[0], value[0]), Math.min(combined[1], value[1]), Math.max(combined[2], value[2]), Math.max(combined[3], value[3])]
      : [...value], null);
  const defaultManifest = regions.find(({ id }) => id === registry.defaultRegion);
  const timestamps = regions.map(({ sourceTimestamp }) => sourceTimestamp).filter(Boolean).sort();

  return {
    config: {
      options: { paths: { fonts: "/data/fonts", styles: "/data/styles" } },
      styles: sortedObject(styleConfigEntries),
      data: sortedObject(dataEntries)
    },
    styles: sortedObject(generatedStyleEntries),
    catalog: {
      defaultView: "all",
      defaultRegion: registry.defaultRegion,
      name: "All installed maps",
      bounds,
      center: bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : null,
      displayZoom: 3,
      previewTile: defaultManifest.testTile ?? null,
      sourceTimestamp: timestamps[0] ?? null,
      regions
    }
  };
}
