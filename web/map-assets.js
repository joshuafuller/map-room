export const VECTOR_ASSET_VERSION = "americana-all-themes-v2";

const versionedResourceTypes = new Set(["Style", "SpriteImage", "SpriteJSON"]);

export function versionMapAssetRequest(url, resourceType) {
  if (!versionedResourceTypes.has(resourceType)) return { url };
  const versioned = new URL(url, globalThis.location?.href ?? "http://localhost/");
  versioned.searchParams.set("map-room-version", VECTOR_ASSET_VERSION);
  return { url: versioned.href };
}

export function normalizeMapStyleAssets(style, baseUrl) {
  const normalized = structuredClone(style);
  for (const field of ["sprite", "glyphs"]) {
    if (typeof normalized[field] === "string") {
      normalized[field] = new URL(normalized[field], baseUrl).href
        .replaceAll("%7B", "{")
        .replaceAll("%7D", "}");
    }
  }
  return normalized;
}

export async function loadMapStyle(url, {
  baseUrl = globalThis.location?.href ?? "http://localhost/",
  fetcher = globalThis.fetch
} = {}) {
  const request = versionMapAssetRequest(new URL(url, baseUrl).href, "Style");
  const response = await fetcher(request.url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Map style request failed (${response.status})`);
  return normalizeMapStyleAssets(await response.json(), baseUrl);
}

export function createCachedMapStyleLoader(options = {}) {
  const styles = new Map();

  return async (url) => {
    if (!styles.has(url)) {
      const pendingStyle = loadMapStyle(url, options).catch((error) => {
        styles.delete(url);
        throw error;
      });
      styles.set(url, pendingStyle);
    }

    return structuredClone(await styles.get(url));
  };
}
