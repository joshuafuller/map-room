import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCatalog } from "../src/catalog.js";

test("normalizes searchable Geofabrik PBF regions and excludes non-download entries", () => {
  const catalog = normalizeCatalog({
    features: [
      { properties: { id: "us/florida", parent: "north-america", name: "us/florida", "iso3166-2": ["US-FL"], urls: { pbf: "https://download.geofabrik.de/north-america/us/florida-latest.osm.pbf", updates: "https://download.geofabrik.de/north-america/us/florida-updates" } } },
      { properties: { id: "europe/germany", parent: null, name: "Germany", urls: { pbf: "https://download.geofabrik.de/europe/germany-latest.osm.pbf" } } },
      { properties: { id: "no-download", name: "No download", urls: { shp: "https://example.test/file.zip" } } }
    ]
  });

  assert.deepEqual(catalog.map(({ id, name, group, isoCode }) => ({ id, name, group, isoCode })), [
    { id: "europe/germany", name: "Germany", group: "Europe", isoCode: null },
    { id: "us/florida", name: "Florida", group: "North America / US", isoCode: "US-FL" }
  ]);
  assert.equal(catalog[1].pbfUrl.endsWith("florida-latest.osm.pbf"), true);
  assert.equal(catalog[1].updatesUrl.endsWith("florida-updates"), true);
  assert.match(catalog[1].searchText, /florida us-fl/i);
});
