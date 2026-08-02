import test from "node:test";
import assert from "node:assert/strict";
import { buildRuntimeArtifacts } from "../src/runtime-config.js";

const themes = {
  daylight: {
    version: 8,
    name: "Daylight",
    sources: { osm: { type: "vector", url: "mbtiles://{osm}" } },
    sprite: "/styles/daylight/sprite",
    layers: []
  },
  "cyberpunk-tactical": {
    version: 8,
    name: "Cyberpunk Tactical",
    sources: { osm: { type: "vector", url: "mbtiles://{osm}" } },
    sprite: "/styles/cyberpunk-tactical/sprite",
    layers: []
  }
};

const registry = {
  defaultRegion: "california",
  regions: [
    { id: "florida", name: "Florida", archive: "florida.mbtiles", testTile: "14/4588/6912" },
    { id: "california", name: "California", archive: "california.mbtiles", testTile: "14/2730/6362" }
  ]
};

test("builds deterministic TileServer data and style entries for every region and theme", () => {
  const { config, styles, catalog } = buildRuntimeArtifacts({ registry, themes });

  assert.deepEqual(Object.keys(config.data), ["california", "florida"]);
  assert.equal(config.data.california.mbtiles, "/data/archive/california.mbtiles");
  assert.equal(config.data.florida.mbtiles, "/data/archive/florida.mbtiles");
  assert.deepEqual(Object.keys(config.styles), [
    "california-cyberpunk-tactical",
    "california-daylight",
    "cyberpunk-tactical",
    "daylight",
    "florida-cyberpunk-tactical",
    "florida-daylight"
  ]);
  assert.equal(config.styles.daylight.style, "regions/california/daylight.json");
  assert.equal(config.styles["florida-daylight"].style, "regions/florida/daylight.json");
  assert.equal(styles["regions/florida/daylight.json"].sources.osm.url, "mbtiles://{florida}");
  assert.equal(styles["regions/florida/daylight.json"].sprite, "/styles/daylight/sprite");
  assert.deepEqual(catalog.regions.map(({ id }) => id), ["california", "florida"]);
  assert.equal(catalog.defaultRegion, "california");
});

test("does not mutate source themes while producing isolated region variants", () => {
  const before = structuredClone(themes);
  const { styles } = buildRuntimeArtifacts({ registry, themes });

  styles["regions/florida/daylight.json"].name = "changed";
  assert.deepEqual(themes, before);
  assert.equal(styles["regions/california/daylight.json"].name, "Daylight — California");
});

test("rejects unsafe and duplicate region IDs, unknown defaults, and incomplete archives", () => {
  const invalidRegistries = [
    { defaultRegion: "florida", regions: [{ id: "../florida", name: "Florida", archive: "florida.mbtiles" }] },
    { defaultRegion: "florida", regions: [{ id: "florida", name: "Florida", archive: "florida.mbtiles" }, { id: "florida", name: "Florida 2", archive: "florida-2.mbtiles" }] },
    { defaultRegion: "missing", regions: registry.regions },
    { defaultRegion: "florida", regions: [{ id: "florida", name: "Florida" }] }
  ];

  for (const value of invalidRegistries) {
    assert.throws(() => buildRuntimeArtifacts({ registry: value, themes }), /region|archive|default/i);
  }
});
