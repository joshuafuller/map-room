import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);

test("generates a schema-compatible Cyberpunk style with restrained neon glow", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const style = JSON.parse(await readFile("styles/cyberpunk/style.json", "utf8"));
  const config = JSON.parse(await readFile("config.json", "utf8"));
  const html = await readFile("web/index.html", "utf8");

  assert.equal(style.name, "Cyberpunk");
  assert.equal(style.metadata["map-room:theme"], "cyberpunk");
  assert.equal(style.metadata["map-room:tileset-schema"], "openmaptiles-3.16");
  assert.equal(style.metadata["map-room:style-version"], "1.0.0");
  assert.equal(style.sources.osm.url, "mbtiles://{osm}");
  assert.deepEqual(config.styles.cyberpunk, {
    style: "cyberpunk/style.json",
    tilejson: { type: "baselayer" }
  });
  assert.match(html, /data-theme="cyberpunk"/);

  const layerIds = style.layers.map(({ id }) => id);
  assert.equal(new Set(layerIds).size, layerIds.length);
  assert.ok(layerIds.includes("waterway-glow"));
  assert.ok(layerIds.includes("roads-glow"));
  assert.ok(layerIds.includes("rail-glow"));

  const background = style.layers.find(({ id }) => id === "background");
  const roadsGlow = style.layers.find(({ id }) => id === "roads-glow");
  const buildings3d = style.layers.find(({ id }) => id === "buildings-3d");
  const labels = style.layers.find(({ id }) => id === "place-labels");
  assert.equal(background.paint["background-color"], "#060711");
  assert.equal(roadsGlow.paint["line-blur"], 3);
  assert.ok(roadsGlow.paint["line-opacity"] <= 0.5);
  assert.equal(buildings3d.type, "fill-extrusion");
  assert.equal(buildings3d.layout.visibility, "none");
  assert.deepEqual(buildings3d.paint["fill-extrusion-height"], ["coalesce", ["get", "render_height"], 3]);
  assert.deepEqual(buildings3d.paint["fill-extrusion-base"], ["coalesce", ["get", "render_min_height"], 0]);
  assert.equal(buildings3d.paint["fill-extrusion-color"], "#17152d");
  assert.equal(buildings3d.paint["fill-extrusion-opacity"], 0.94);
  assert.equal(labels.paint["text-color"], "#f4f7ff");
  assert.doesNotMatch(JSON.stringify(style), /https?:\/\//);
});
