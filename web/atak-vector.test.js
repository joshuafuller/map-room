import test from "node:test";
import assert from "node:assert/strict";
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
  assert.deepEqual(style.sources, { osm: { type: "vector" } });
  assert.equal(style.sprite, "https://maps.example.test/map-room/styles/cyberpunk-tactical/sprite");
  assert.equal(style.glyphs, "https://maps.example.test/map-room/fonts/{fontstack}/{range}.pbf");
  assert.deepEqual(style.layers.map(({ id }) => id), ["background", "roads", "poi-essential", "aeroway-runway"]);
  assert.equal(style.layers.find(({ id }) => id === "poi-essential").layout["icon-image"], "poi-fuel");
  assert.equal(style.layers.find(({ id }) => id === "background").paint["background-color"], "#03040b");
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
});

test("does not mutate the browser style while producing the ATAK document", () => {
  const before = structuredClone(sourceStyle);
  buildAtakVectorStyle({ theme: "cyberpunk-tactical", baseUrl: "http://maps.example.test", sourceStyle });
  assert.deepEqual(sourceStyle, before);
});
