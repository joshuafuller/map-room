import test from "node:test";
import assert from "node:assert/strict";
import { poiLayerVisibility } from "./poi-visibility.js";

test("keeps base POIs tied to their preset and HUD POIs tied to 3D mode", () => {
  assert.equal(poiLayerVisibility({ enabled: true, buildings3dEnabled: false, hud: false }), "visible");
  assert.equal(poiLayerVisibility({ enabled: false, buildings3dEnabled: true, hud: false }), "none");
  assert.equal(poiLayerVisibility({ enabled: true, buildings3dEnabled: true, hud: true }), "visible");
  assert.equal(poiLayerVisibility({ enabled: true, buildings3dEnabled: false, hud: true }), "none");
  assert.equal(poiLayerVisibility({ enabled: false, buildings3dEnabled: true, hud: true }), "none");
});
