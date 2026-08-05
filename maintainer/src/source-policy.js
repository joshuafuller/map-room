export function validateRemoteSourceUrl(value, allowedHosts = ["download.geofabrik.de"]) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Source URL must be a valid HTTPS .osm.pbf URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.pathname.endsWith(".osm.pbf")) {
    throw new Error("Source URL must be a valid HTTPS .osm.pbf URL");
  }
  if (!allowedHosts.includes(url.hostname)) throw new Error(`Source host is not allowed: ${url.hostname}`);
  url.hash = "";
  return url.href;
}
