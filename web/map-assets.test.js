import test from "node:test";
import assert from "node:assert/strict";
import { createCachedMapStyleLoader, loadMapStyle, normalizeMapStyleAssets, VECTOR_ASSET_VERSION, versionMapAssetRequest } from "./map-assets.js";

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

  for (const origin of ["http://192.168.50.10:8088/", "http://[fd00::10]:8088/", "https://maps.example.lan/"]) {
    const resolved = normalizeMapStyleAssets({ version: 8, sprite: "/styles/map/sprite" }, origin);
    assert.equal(new URL(resolved.sprite).origin, new URL(origin).origin);
  }
});

test("loads a fresh versioned style before resolving its assets", async () => {
  const calls = [];
  const style = await loadMapStyle("/styles/all-daylight/style.json", {
    baseUrl: "http://10.10.20.24:8088/",
    fetcher: async (url, options) => {
      calls.push([url, options]);
      return new Response(JSON.stringify({
        version: 8,
        sprite: "/styles/all-daylight/sprite",
        sources: {},
        layers: []
      }));
    }
  });
  assert.equal(new URL(calls[0][0]).searchParams.get("map-room-version"), VECTOR_ASSET_VERSION);
  assert.deepEqual(calls[0][1], { cache: "no-store" });
  assert.equal(style.sprite, "http://10.10.20.24:8088/styles/all-daylight/sprite");
});

test("caches parsed styles for fast repeat theme switches without sharing mutations", async () => {
  let requests = 0;
  const load = createCachedMapStyleLoader({
    baseUrl: "http://10.10.20.24:8088/",
    fetcher: async () => {
      requests += 1;
      return new Response(JSON.stringify({
        version: 8,
        sprite: "/styles/all-daylight/sprite",
        sources: {},
        layers: []
      }));
    }
  });
  const first = await load("/styles/all-daylight/style.json");
  first.name = "mutated by MapLibre";
  const second = await load("/styles/all-daylight/style.json");
  assert.equal(requests, 1);
  assert.equal(second.name, undefined);
});
