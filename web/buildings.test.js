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

test("enables 3D buildings by default in the UI and every authored theme", async () => {
  const [app, html] = await Promise.all([
    readFile(new URL("./app.js", import.meta.url), "utf8"),
    readFile(new URL("./index.html", import.meta.url), "utf8")
  ]);
  assert.match(app, /let buildings3dEnabled = true;/);
  assert.match(html, /id="buildings-toggle"[^>]*aria-pressed="true"/);

  for (const theme of ["daylight", "midnight", "dark-blue", "dark-red", "dark-green", "cyberpunk", "cyberpunk-tactical"]) {
    const style = JSON.parse(await readFile(new URL(`../styles/${theme}/style.json`, import.meta.url), "utf8"));
    const buildings = style.layers.find(({ id }) => id === "buildings-3d");
    assert.equal(buildings?.layout?.visibility, "visible", `${theme} must start with 3D buildings enabled`);
  }
});
