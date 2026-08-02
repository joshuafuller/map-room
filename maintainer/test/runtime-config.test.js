import test from "node:test";
import assert from "node:assert/strict";
import { buildRuntimeArtifacts } from "../src/runtime-config.js";

const themes = {
  daylight: {
    version: 8,
    name: "Daylight",
    sources: { osm: { type: "vector", url: "mbtiles://{osm}" } },
    sprite: "/styles/daylight/sprite",
    layers: [
      { id: "background", type: "background" },
      { id: "roads", type: "line", source: "osm", "source-layer": "transportation" }
    ]
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
    "all-cyberpunk-tactical",
    "all-daylight",
    "cyberpunk-tactical",
    "daylight"
  ]);
  assert.equal(config.styles.daylight.style, "collections/all/daylight.json");
  assert.equal(config.styles["all-daylight"].style, "collections/all/daylight.json");
  assert.deepEqual(styles["collections/all/daylight.json"].sources, {
    california: { type: "vector", url: "mbtiles://{california}" },
    florida: { type: "vector", url: "mbtiles://{florida}" }
  });
  assert.equal(styles["collections/all/daylight.json"].sprite, "/styles/daylight/sprite");
  assert.deepEqual(styles["collections/all/daylight.json"].layers.map(({ id, source }) => ({ id, source })), [
    { id: "background", source: undefined },
    { id: "roads--california", source: "california" },
    { id: "roads--florida", source: "florida" }
  ]);
  assert.deepEqual(catalog.regions.map(({ id }) => id), ["california", "florida"]);
  assert.equal(catalog.defaultView, "all");
});

test("does not mutate source themes while producing isolated region variants", () => {
  const before = structuredClone(themes);
  const { styles } = buildRuntimeArtifacts({ registry, themes });

  styles["collections/all/daylight.json"].name = "changed";
  assert.deepEqual(themes, before);
  assert.equal(styles["collections/all/cyberpunk-tactical.json"].name, "Cyberpunk Tactical — All installed maps");
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
