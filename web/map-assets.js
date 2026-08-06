export const VECTOR_ASSET_VERSION = "shields-v2";

const versionedResourceTypes = new Set(["Style", "SpriteImage", "SpriteJSON"]);

export function versionMapAssetRequest(url, resourceType) {
  if (!versionedResourceTypes.has(resourceType)) return { url };
  const versioned = new URL(url, globalThis.location?.href ?? "http://localhost/");
  versioned.searchParams.set("map-room-version", VECTOR_ASSET_VERSION);
  return { url: versioned.href };
}
