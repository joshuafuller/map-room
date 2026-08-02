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
    { id: "florida", name: "Florida", archive: "florida.mbtiles", testTile: "14/4588/6912", bounds: [-87.7, 24.3, -79.8, 31.1], sourceTimestamp: "2026-07-30T00:00:00Z" },
    { id: "california", name: "California", archive: "california.mbtiles", testTile: "14/2730/6362", bounds: [-125, 32, -114, 42], sourceTimestamp: "2026-07-31T00:00:00Z" }
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
  assert.deepEqual(catalog.bounds, [-125, 24.3, -79.8, 42]);
  assert.deepEqual(catalog.center, [-102.4, 33.15]);
  assert.equal(catalog.sourceTimestamp, "2026-07-30T00:00:00Z");
});

test("does not mutate source themes while producing the composed map", () => {
  const before = structuredClone(themes);
  const { styles } = buildRuntimeArtifacts({ registry, themes });

  styles["collections/all/daylight.json"].name = "changed";
  assert.deepEqual(themes, before);
  assert.equal(styles["collections/all/cyberpunk-tactical.json"].name, "Cyberpunk Tactical — All installed maps");
});

test("rejects unsafe and duplicate region IDs, unknown defaults, and incomplete archives", () => {
  const invalidRegistries = [
    null,
    {},
    { defaultRegion: "florida", regions: [] },
    { defaultRegion: "florida", regions: [{ name: "Florida", archive: "florida.mbtiles" }] },
    { defaultRegion: "florida", regions: [{ id: "../florida", name: "Florida", archive: "florida.mbtiles" }] },
    { defaultRegion: "florida", regions: [{ id: "florida", name: "Florida", archive: "florida.mbtiles" }, { id: "florida", name: "Florida 2", archive: "florida-2.mbtiles" }] },
    { defaultRegion: "missing", regions: registry.regions },
    { defaultRegion: "florida", regions: [{ id: "florida", name: "", archive: "florida.mbtiles" }] },
    { defaultRegion: "florida", regions: [{ id: "florida", archive: "florida.mbtiles" }] },
    { defaultRegion: "florida", regions: [{ id: "florida", name: "Florida" }] },
    { defaultRegion: "florida", regions: [{ id: "florida", name: "Florida", archive: "../florida.mbtiles" }] },
    { defaultRegion: "florida", regions: [{ id: "florida", name: "Florida", archive: "florida.sqlite" }] }
  ];

  for (const value of invalidRegistries) {
    assert.throws(() => buildRuntimeArtifacts({ registry: value, themes }), /region|archive|default/i);
  }
});

test("rejects an empty theme set or a theme without the canonical source", () => {
  assert.throws(() => buildRuntimeArtifacts({ registry, themes: null }), /theme/i);
  assert.throws(() => buildRuntimeArtifacts({ registry, themes: {} }), /theme/i);
  assert.throws(() => buildRuntimeArtifacts({ registry, themes: { broken: {} } }), /canonical osm source/i);
});

test("allows manifests without optional bounds, timestamps, or preview tiles", () => {
  const minimal = { defaultRegion: "florida", regions: [{ id: "florida", name: "Florida", archive: "florida.mbtiles" }] };
  const { catalog } = buildRuntimeArtifacts({ registry: minimal, themes });

  assert.equal(catalog.bounds, null);
  assert.equal(catalog.center, null);
  assert.equal(catalog.previewTile, null);
  assert.equal(catalog.sourceTimestamp, null);
});
