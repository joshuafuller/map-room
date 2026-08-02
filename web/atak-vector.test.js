import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAtakVectorStyle } from "./atak-vector.js";

const sourceStyle = {
  version: 8,
  name: "Cyberpunk Tactical",
  glyphs: "{fontstack}/{range}.pbf",
  sprite: "/styles/cyberpunk-tactical/sprite",
  sources: {
    osm: { type: "vector", url: "mbtiles://{osm}" },
    "coordinate-grid": { type: "geojson", data: { type: "FeatureCollection", features: [] } }
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#03040b" } },
    { id: "roads", type: "line", source: "osm", "source-layer": "transportation" },
    { id: "coordinate-grid", type: "line", source: "coordinate-grid" },
    { id: "poi-essential", type: "symbol", source: "osm", "source-layer": "poi", layout: { "icon-image": "poi-fuel" } },
    { id: "aeroway-runway", type: "line", source: "osm", "source-layer": "aeroway" }
  ]
};

test("builds a one-source ATAK style with Map Room symbology and reachable assets", () => {
  const style = buildAtakVectorStyle({
    theme: "cyberpunk-tactical",
    baseUrl: "https://maps.example.test/map-room/",
    sourceStyle
  });

  assert.equal(style.version, 8);
  assert.equal(style.name, "Map Room - Cyberpunk Tactical - ATAK Vector");
  assert.deepEqual(style.sources, {
    osm: { type: "vector", url: "https://maps.example.test/map-room/data/florida.json" }
  });
  assert.equal(style.sprite, "https://maps.example.test/map-room/styles/cyberpunk-tactical/sprite");
  assert.equal(style.glyphs, "https://maps.example.test/map-room/fonts/{fontstack}/{range}.pbf");
  assert.deepEqual(style.layers.map(({ id }) => id), [
    "background",
    "roads-motorway", "roads-primary", "roads-secondary", "roads-tertiary", "roads-minor", "roads-path",
    "poi-essential-medical", "poi-essential-fire", "poi-essential-police", "poi-essential-fuel", "poi-essential-port",
    "aeroway-runway"
  ]);
  assert.equal(style.layers.find(({ id }) => id === "poi-essential-fuel").layout["icon-image"], "poi-fuel");
  assert.equal(style.layers.find(({ id }) => id === "background").paint["background-color"], "#03040b");
});

test("collapses a composed runtime style back to the selected ATAK archive", () => {
  const composedStyle = structuredClone(sourceStyle);
  composedStyle.sources = {
    california: { type: "vector", url: "http://localhost/data/california.json" },
    florida: { type: "vector", url: "http://localhost/data/florida.json" }
  };
  composedStyle.layers = [
    sourceStyle.layers[0],
    { ...sourceStyle.layers[1], id: "roads--california", source: "california" },
    { ...sourceStyle.layers[1], id: "roads--florida", source: "florida" },
    { ...sourceStyle.layers[3], id: "poi-essential--florida", source: "florida" }
  ];

  const style = buildAtakVectorStyle({
    theme: "cyberpunk-tactical",
    baseUrl: "http://maps.example.test:8088",
    sourceId: "florida",
    sourceStyle: composedStyle
  });

  assert.equal(style.layers[0].id, "background");
  assert.equal(style.layers.some(({ id }) => id === "roads-motorway"), true);
  assert.equal(style.layers.some(({ id }) => id === "poi-essential-medical"), true);
  assert.equal(style.layers.filter((layer) => layer.source === "osm").length, 11);
  assert.equal(style.layers.some((layer) => layer.source === "california" || layer.source === "florida"), false);
  assert.equal(style.sources.osm.url, "http://maps.example.test:8088/data/florida.json");
});

test("transpiles roads and airports to ATAK's bundled legacy style dialect", () => {
  const modernStyle = structuredClone(sourceStyle);
  modernStyle.layers = [
    sourceStyle.layers[0],
    {
      id: "roads",
      type: "line",
      source: "osm",
      "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["motorway", "primary"]]],
      layout: { "line-cap": "round" },
      paint: {
        "line-color": ["match", ["get", "class"], "motorway", "#ff2aa3", "#00e5ff"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1, 16, 12],
        "line-dasharray": [1, 2]
      }
    },
    {
      id: "poi-airports",
      type: "symbol",
      source: "osm",
      "source-layer": "aeroway",
      filter: ["in", ["get", "class"], ["literal", ["aerodrome", "heliport"]]],
      layout: { "icon-image": "poi-airport", "text-field": ["get", "ref"] },
      paint: { "text-color": "#00e5ff" }
    },
    {
      id: "poi-essential",
      type: "symbol",
      source: "osm",
      "source-layer": "poi",
      filter: ["in", ["get", "class"], ["literal", ["hospital", "clinic", "fuel"]]],
      layout: {
        "icon-image": ["match", ["get", "class"], ["hospital", "clinic"], "poi-medical", "fuel", "poi-fuel", "poi-port"],
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]]
      },
      paint: { "text-color": "#f4f7ff" }
    },
    {
      id: "legacy-primitives",
      type: "symbol",
      source: "osm",
      "source-layer": "poi",
      layout: {
        "text-field": ["literal", "Static"],
        "icon-image": ["get", "icon"],
        "icon-offset": ["literal", [1, 2]]
      }
    }
  ];

  const style = buildAtakVectorStyle({
    theme: "cyberpunk",
    baseUrl: "http://maps.example.test:8088",
    sourceStyle: modernStyle
  });
  const motorway = style.layers.find(({ id }) => id === "roads-motorway");
  const primary = style.layers.find(({ id }) => id === "roads-primary");
  const airports = style.layers.find(({ id }) => id === "poi-airports");
  const medical = style.layers.find(({ id }) => id === "poi-essential-medical");
  const fuel = style.layers.find(({ id }) => id === "poi-essential-fuel");
  const primitives = style.layers.find(({ id }) => id === "legacy-primitives");

  assert.deepEqual(motorway.filter, ["in", "class", "motorway", "trunk"]);
  assert.equal(motorway.paint["line-color"], "#ff2aa3");
  assert.deepEqual(motorway.paint["line-width"], { base: 1, stops: [[7, 1], [16, 12]] });
  assert.deepEqual(motorway.paint["line-dasharray"], [1, 2]);
  assert.deepEqual(primary.filter, ["in", "class", "primary"]);
  assert.equal(primary.paint["line-color"], "#00e5ff");
  assert.equal(airports["source-layer"], "aerodrome_label");
  assert.equal(airports.filter, undefined);
  assert.equal(airports.layout["text-field"], "{name}");
  assert.deepEqual(medical.filter, ["in", "class", "hospital", "clinic"]);
  assert.equal(medical.layout["icon-image"], "poi-medical");
  assert.deepEqual(fuel.filter, ["in", "class", "fuel"]);
  assert.equal(fuel.layout["icon-image"], "poi-fuel");
  assert.equal(primitives.layout["text-field"], "{name}");
  assert.equal(primitives.layout["icon-image"], "{icon}");
  assert.deepEqual(primitives.layout["icon-offset"], [1, 2]);
  assert.doesNotMatch(JSON.stringify(style.layers), /\["(?:get|literal|match|coalesce|interpolate|case|step)"/);
});

test("rejects untrusted origins, unknown themes, and malformed source styles", () => {
  for (const baseUrl of [
    "not a URL",
    "ftp://maps.example.test",
    "https://user:secret@maps.example.test",
    "https://maps.example.test/?deployment=one",
    "https://maps.example.test/#fragment"
  ]) {
    assert.throws(() => buildAtakVectorStyle({ theme: "cyberpunk", baseUrl, sourceStyle }), /ATAK base URL/);
  }
  assert.throws(
    () => buildAtakVectorStyle({ theme: "missing", baseUrl: "https://maps.example.test", sourceStyle }),
    /Unknown ATAK theme/
  );
  assert.throws(
    () => buildAtakVectorStyle({ theme: "cyberpunk", baseUrl: "https://maps.example.test", sourceStyle: null }),
    /Mapbox Style Specification v8/
  );
  assert.throws(
    () => buildAtakVectorStyle({
      theme: "cyberpunk",
      baseUrl: "https://maps.example.test",
      sourceId: "florida",
      sourceStyle: { ...sourceStyle, sources: { california: { type: "vector" } } }
    }),
    /ATAK vector source is unavailable: florida/
  );
});

test("does not mutate the browser style while producing the ATAK document", () => {
  const before = structuredClone(sourceStyle);
  buildAtakVectorStyle({ theme: "cyberpunk-tactical", baseUrl: "http://maps.example.test", sourceStyle });
  assert.deepEqual(sourceStyle, before);
});

test("compiles the complete authored Cyberpunk theme without unsupported expressions", async () => {
  const completeStyle = JSON.parse(await readFile(new URL("../styles/cyberpunk/style.json", import.meta.url), "utf8"));
  const style = buildAtakVectorStyle({
    theme: "cyberpunk",
    baseUrl: "http://maps.example.test:8088",
    sourceStyle: completeStyle
  });
  const ids = new Set(style.layers.map(({ id }) => id));
  assert.equal([...ids].some((id) => id.endsWith("-hud")), false);

  for (const required of [
    "roads-motorway", "roads-primary", "roads-secondary", "roads-tertiary", "roads-minor", "roads-path",
    "runway-glow", "runways", "taxiways", "poi-airports",
    "road-shields-interstate", "road-shields-us", "road-shields-state", "road-shields-county",
    "poi-essential-medical", "poi-essential-fire", "poi-essential-police", "poi-essential-fuel", "poi-essential-port",
    "poi-explore-food", "poi-explore-lodging", "poi-explore-attraction", "poi-explore-shopping", "poi-explore-parking"
  ]) assert.equal(ids.has(required), true, `missing ${required}`);

  assert.equal(style.layers.find(({ id }) => id === "poi-airports")["source-layer"], "aerodrome_label");
  const buildings3d = style.layers.find(({ id }) => id === "buildings-3d");
  assert.equal(buildings3d.layout.visibility, "visible");
  assert.deepEqual(buildings3d.paint["fill-extrusion-height"], {
    property: "render_height", type: "identity", default: 3
  });
  assert.deepEqual(buildings3d.paint["fill-extrusion-base"], {
    property: "render_min_height", type: "identity", default: 0
  });
  assert.doesNotMatch(JSON.stringify(style.layers), /\["(?:get|literal|match|coalesce|interpolate|case|step)"/);
});
