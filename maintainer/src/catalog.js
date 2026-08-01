const CATALOG_URL = "https://download.geofabrik.de/index-v1-nogeom.json";

const title = (value) => value
  .split(/[-_]/)
  .filter(Boolean)
  .map((part) => part.length <= 2 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

function displayName(properties) {
  const raw = properties.name?.includes("/")
    ? properties.id?.split("/").at(-1)
    : properties.name ?? properties.id?.split("/").at(-1);
  return title(raw ?? "Unknown");
}

function groupName(pbfUrl) {
  const segments = new URL(pbfUrl).pathname.split("/").filter(Boolean).slice(0, -1);
  return segments.map(title).join(" / ");
}

export function normalizeCatalog(index) {
  return (index.features ?? [])
    .map((feature) => feature.properties ?? {})
    .filter((properties) => properties.id && properties.urls?.pbf)
    .map((properties) => {
      const name = displayName(properties);
      const group = groupName(properties.urls.pbf);
      const isoCode = properties["iso3166-2"]?.[0] ?? properties["iso3166-1:alpha2"]?.[0] ?? null;
      return {
        id: properties.id,
        name,
        group,
        isoCode,
        pbfUrl: properties.urls.pbf,
        updatesUrl: properties.urls.updates ?? null,
        parent: properties.parent ?? null,
        searchText: [name, isoCode, properties.id, group].filter(Boolean).join(" ").toLowerCase()
      };
    })
    .sort((left, right) => left.group.localeCompare(right.group) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export async function fetchCatalog(fetchImpl = fetch) {
  const response = await fetchImpl(CATALOG_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Geofabrik catalog returned HTTP ${response.status}`);
  return normalizeCatalog(await response.json());
}

export { CATALOG_URL };
