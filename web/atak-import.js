function parseHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("ATAK definition URL must be an absolute HTTP or HTTPS URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("ATAK definition URL must use HTTP or HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw new Error("ATAK definition URL must not contain credentials");
  }
  return parsed;
}

export function buildAtakImportUri(definitionUrl) {
  const parsed = parseHttpUrl(definitionUrl);
  return `tak://com.atakmap.app/import?url=${encodeURIComponent(parsed.href)}`;
}

export function isLoopbackMapRoomUrl(value) {
  const { hostname } = parseHttpUrl(value);
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "::1" || normalized === "localhost" || normalized.endsWith(".localhost") || /^127(?:\.|$)/.test(normalized);
}
