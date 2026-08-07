import { clientError } from "./request-error.js";

export function validateRemoteSourceUrl(value, allowedHosts = ["download.geofabrik.de"]) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw clientError("Source URL must be a valid HTTPS .osm.pbf URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.pathname.endsWith(".osm.pbf")) {
    throw clientError("Source URL must be a valid HTTPS .osm.pbf URL");
  }
  if (!allowedHosts.includes(url.hostname)) throw clientError(`Source host is not allowed: ${url.hostname}`);
  url.hash = "";
  return url.href;
}
