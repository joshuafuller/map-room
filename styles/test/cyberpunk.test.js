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
  assert.deepEqual(buildings3d.paint["fill-extrusion-color"], [
    "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 3],
    0, "#211d3e", 30, "#2d3469", 100, "#6438a5", 220, "#ff2aa3"
  ]);
  assert.equal(buildings3d.paint["fill-extrusion-opacity"], 0.82);
  assert.ok(layerIds.indexOf("roads") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("rail") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("road-labels") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("road-shields") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("buildings-3d") < layerIds.indexOf("house-numbers"));
  assert.ok(layerIds.indexOf("poi-essential") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("poi-explore") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("poi-airports") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("water-labels") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("buildings-3d") < layerIds.indexOf("place-labels"));
  assert.deepEqual(layerIds.slice(layerIds.indexOf("buildings-3d") + 1), [
    "house-numbers", "place-labels", "poi-essential-hud", "poi-explore-hud", "poi-airports-hud"
  ]);
  for (const id of ["poi-essential-hud", "poi-explore-hud", "poi-airports-hud"]) {
    const hud = style.layers.find((layer) => layer.id === id);
    const base = style.layers.find((layer) => layer.id === id.replace("-hud", ""));
    assert.equal(hud.type, "symbol");
    assert.equal(hud.layout.visibility, "none");
    assert.deepEqual(hud.layout["text-field"], base.layout["text-field"]);
    assert.deepEqual(hud.paint, base.paint);
  }
  assert.deepEqual(style.light, {
    anchor: "viewport", color: "#d8ccff", intensity: 0.72, position: [1.15, 210, 35]
  });
  assert.equal(labels.paint["text-color"], "#f4f7ff");
  assert.doesNotMatch(JSON.stringify(style), /https?:\/\//);
});
