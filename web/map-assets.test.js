import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMapStyleAssets, VECTOR_ASSET_VERSION, versionMapAssetRequest } from "./map-assets.js";

test("cache-busts browser vector styles and sprites without changing tile URLs", () => {
  for (const type of ["Style", "SpriteImage", "SpriteJSON"]) {
    const request = versionMapAssetRequest("/styles/all-daylight/sprite@2x.png", type);
    assert.equal(new URL(request.url).searchParams.get("map-room-version"), VECTOR_ASSET_VERSION);
  }
  assert.deepEqual(
    versionMapAssetRequest("http://maps.test/data/us-south/11/527/837.pbf", "Tile"),
    { url: "http://maps.test/data/us-south/11/527/837.pbf" }
  );
});

test("resolves LAN style assets against the browser origin", () => {
  const style = normalizeMapStyleAssets({
    version: 8,
    sprite: "/styles/all-daylight/sprite",
    glyphs: "/fonts/{fontstack}/{range}.pbf",
    sources: {},
    layers: []
  }, "http://10.10.20.24:8088/");

  assert.equal(style.sprite, "http://10.10.20.24:8088/styles/all-daylight/sprite");
  assert.equal(style.glyphs, "http://10.10.20.24:8088/fonts/{fontstack}/{range}.pbf");
});
