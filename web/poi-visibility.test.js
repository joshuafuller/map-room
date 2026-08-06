import test from "node:test";
import assert from "node:assert/strict";
import { poiLayerIds, poiLayerVisibility } from "./poi-visibility.js";

test("finds each POI layer in a composed multi-region style", () => {
  const style = { layers: [
    { id: "poi-essential--california" },
    { id: "poi-essential--florida" },
    { id: "poi-essential-hud--california" },
    { id: "poi-essential-hud--florida" },
    { id: "poi-explore-hud--florida" }
  ] };

  assert.deepEqual(poiLayerIds(style, "poi-essential"), [
    "poi-essential--california",
    "poi-essential--florida"
  ]);
  assert.deepEqual(poiLayerIds(style, "poi-essential-hud"), [
    "poi-essential-hud--california",
    "poi-essential-hud--florida"
  ]);
});

test("supports a single-publication POI style and an unavailable style", () => {
  assert.deepEqual(poiLayerIds({ layers: [{ id: "poi-airports-hud" }] }, "poi-airports-hud"), ["poi-airports-hud"]);
  assert.deepEqual(poiLayerIds(null, "poi-essential"), []);
});

test("uses HUD POIs because 3D buildings are always enabled", () => {
  assert.equal(poiLayerVisibility({ enabled: true, hud: false }), "none");
  assert.equal(poiLayerVisibility({ enabled: false, hud: false }), "none");
  assert.equal(poiLayerVisibility({ enabled: true, hud: true }), "visible");
  assert.equal(poiLayerVisibility({ enabled: false, hud: true }), "none");
});
