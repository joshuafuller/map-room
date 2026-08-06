import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildingLayerIds } from "./buildings.js";

test("finds every 3D building layer in a composed multi-region style", () => {
  assert.deepEqual(buildingLayerIds({ layers: [
    { id: "background" },
    { id: "buildings-3d--california" },
    { id: "buildings-3d--florida" },
    { id: "buildings--florida" }
  ] }), ["buildings-3d--california", "buildings-3d--florida"]);
});

test("supports a single-publication style and an unavailable style", () => {
  assert.deepEqual(buildingLayerIds({ layers: [{ id: "buildings-3d" }] }), ["buildings-3d"]);
  assert.deepEqual(buildingLayerIds(null), []);
});

test("keeps 3D buildings always on without a redundant UI toggle", async () => {
  const [app, html] = await Promise.all([
    readFile(new URL("./app.js", import.meta.url), "utf8"),
    readFile(new URL("./index.html", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(app, /buildings3dEnabled|#buildings-toggle/);
  assert.doesNotMatch(html, /id="buildings-toggle"/);
  assert.match(app, /map\.setStyle\(style, \{ diff: false \}\)/,
    "structurally different themes must use MapLibre's faster full replacement path");

  for (const theme of ["daylight", "midnight", "dark-blue", "dark-red", "dark-green", "cyberpunk", "cyberpunk-tactical"]) {
    const style = JSON.parse(await readFile(new URL(`../styles/${theme}/style.json`, import.meta.url), "utf8"));
    const buildings = style.layers.find(({ id }) => id === "buildings-3d");
    assert.equal(buildings?.layout?.visibility, "visible", `${theme} must start with 3D buildings enabled`);
    assert.deepEqual(buildings?.paint?.["fill-extrusion-height"], ["coalesce", ["get", "render_height"], 3],
      `${theme} must use the tileset's real building height`);
    assert.deepEqual(buildings?.paint?.["fill-extrusion-base"], ["coalesce", ["get", "render_min_height"], 0],
      `${theme} must preserve elevated building parts instead of clipping them to the ground`);
  }
});
