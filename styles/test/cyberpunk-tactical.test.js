import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
test("generates Cyberpunk Tactical without changing the Classic core treatment", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);

  const classic = JSON.parse(await readFile("styles/cyberpunk/style.json", "utf8"));
  const tactical = JSON.parse(await readFile("styles/cyberpunk-tactical/style.json", "utf8"));
  const config = JSON.parse(await readFile("config.json", "utf8"));
  const html = await readFile("web/index.html", "utf8");
  const css = await readFile("web/app.css", "utf8");

  const classicLayers = Object.fromEntries(classic.layers.map((layer) => [layer.id, layer]));
  assert.equal(classicLayers.background.paint["background-color"], "#060711");
  assert.equal(classicLayers["roads-glow"].paint["line-blur"], 3);
  assert.equal(classicLayers["place-labels"].paint["text-color"], "#f4f7ff");
  assert.equal(tactical.name, "Cyberpunk Tactical");
  assert.equal(tactical.metadata["map-room:theme"], "cyberpunk-tactical");
  assert.equal(tactical.metadata["map-room:style-version"], "1.0.0");
  assert.deepEqual(config.styles["cyberpunk-tactical"], {
    style: "cyberpunk-tactical/style.json",
    tilejson: { type: "baselayer" }
  });
  assert.match(html, /data-theme="cyberpunk-tactical"/);
  assert.doesNotMatch(html, /id="grid-toggle"/);
  assert.match(css, /prefers-reduced-motion: reduce/);

  const layers = Object.fromEntries(tactical.layers.map((layer) => [layer.id, layer]));
  assert.equal(new Set(Object.keys(layers)).size, tactical.layers.length);
  assert.ok(layers["urban-glow"]);
  assert.ok(layers["coastline-glow"]);
  assert.ok(layers["airports"]);
  assert.equal(layers["airports"].type, "fill");
  assert.ok(layers["operational-landmarks"]);
  assert.equal(layers["buildings-3d"].type, "fill-extrusion");
  assert.equal(layers["buildings-3d"].layout.visibility, "visible");
  assert.deepEqual(layers["buildings-3d"].paint["fill-extrusion-height"], ["coalesce", ["get", "render_height"], 3]);
  assert.deepEqual(layers["buildings-3d"].paint["fill-extrusion-base"], ["coalesce", ["get", "render_min_height"], 0]);
  assert.equal(layers["buildings-3d"].paint["fill-extrusion-opacity"], 0.82);
  assert.deepEqual(layers["buildings-3d"].paint["fill-extrusion-color"], [
    "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 3],
    0, "#151a35", 30, "#193454", 100, "#176278", 220, "#00dff7"
  ]);
  assert.deepEqual(tactical.light, {
    anchor: "viewport", color: "#8feeff", intensity: 0.72, position: [1.15, 210, 35]
  });
  const layerIds = tactical.layers.map(({ id }) => id);
  assert.ok(layerIds.indexOf("roads") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("road-labels") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("road-shields") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("buildings-3d") < layerIds.indexOf("house-numbers"));
  assert.ok(layerIds.indexOf("poi-essential") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("poi-explore") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("poi-airports") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("water-labels") < layerIds.indexOf("buildings-3d"));
  assert.ok(layerIds.indexOf("buildings-3d") < layerIds.indexOf("place-labels"));
  assert.deepEqual(layerIds.slice(layerIds.indexOf("buildings-3d") + 1), [
    "house-numbers", "place-labels", "poi-essential-hud", "poi-explore-hud", "poi-parking-hud", "poi-airports-hud"
  ]);
  for (const id of ["poi-essential-hud", "poi-explore-hud", "poi-parking-hud", "poi-airports-hud"]) {
    const base = layers[id.replace("-hud", "")];
    assert.equal(layers[id].type, "symbol");
    assert.equal(layers[id].layout.visibility, "none");
    assert.deepEqual(layers[id].layout["text-field"], base.layout["text-field"]);
    assert.deepEqual(layers[id].paint, base.paint);
  }
  assert.deepEqual(layers["roads-glow"].filter[2][1], ["motorway", "trunk", "primary"]);
  assert.ok(layers["roads-glow"].paint["line-opacity"] <= 0.4);
  assert.equal(layers["place-labels"].paint["text-halo-color"], "#03040b");
  assert.doesNotMatch(JSON.stringify(tactical), /https?:\/\//);
});
