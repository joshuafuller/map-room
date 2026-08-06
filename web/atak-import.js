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

export function normalizeAtakServerUrl(value) {
  const trimmed = typeof value === "string" ? value.trim() : value;
  const defaultScheme = "http:";
  const candidate = typeof trimmed === "string" && !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? `${defaultScheme}//${trimmed}`
    : trimmed;
  const parsed = parseHttpUrl(candidate);
  if (parsed.search || parsed.hash) throw new Error("Map Room address must not contain a query or fragment");
  if (isLoopbackMapRoomUrl(parsed.href)) throw new Error("Enter a device-reachable Map Room address, not localhost");
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}
