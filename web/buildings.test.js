import test from "node:test";
import assert from "node:assert/strict";
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
