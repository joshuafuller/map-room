import test from "node:test";
import assert from "node:assert/strict";
import { validateRemoteSourceUrl } from "../src/source-policy.js";

test("accepts only allow-listed credential-free HTTPS PBF sources", () => {
  assert.equal(validateRemoteSourceUrl("https://download.geofabrik.de/north-america/us/florida-latest.osm.pbf#ignored"), "https://download.geofabrik.de/north-america/us/florida-latest.osm.pbf");
  for (const value of [
    "http://download.geofabrik.de/florida.osm.pbf",
    "https://user:secret@download.geofabrik.de/florida.osm.pbf",
    "https://download.geofabrik.de/florida.zip",
    "not a URL"
  ]) assert.throws(() => validateRemoteSourceUrl(value), /HTTPS.*osm\.pbf/);
  assert.throws(() => validateRemoteSourceUrl("https://example.test/florida.osm.pbf"), /not allowed/);
  assert.equal(validateRemoteSourceUrl("https://example.test/florida.osm.pbf", ["example.test"]), "https://example.test/florida.osm.pbf");
});
