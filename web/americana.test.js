import test from "node:test";
import assert from "node:assert/strict";
import { applyAmericanaShields } from "./americana-style.js";

test("replaces every composed fixed shield layer with the Americana runtime layer", async () => {
  const sourceStyle = {
    version: 8,
    layers: [
      { id: "background", type: "background" },
      { id: "road-shields--colorado", type: "symbol", source: "colorado", layout: { "icon-image": "shield-interstate" } },
      { id: "road-shields--us-south", type: "symbol", source: "us-south", layout: { "icon-image": "shield-state" } }
    ]
  };
  const template = {
    id: "road-shields",
    type: "symbol",
    source: "osm",
    "source-layer": "transportation_name",
    layout: { "text-field": ["format", ["image", ["concat", "shield", "\n", ["get", "route_1_network"]]]] }
  };
  const result = await applyAmericanaShields(sourceStyle, { template });

  assert.equal(sourceStyle.layers[1].layout["icon-image"], "shield-interstate", "source style must not be mutated");
  assert.deepEqual(result.layers.map(({ id, source }) => [id, source]), [
    ["background", undefined],
    ["road-shields--colorado", "colorado"],
    ["road-shields--us-south", "us-south"]
  ]);
  for (const layer of result.layers.slice(1)) {
    assert.match(JSON.stringify(layer), /"shield","\\n"/);
    assert.doesNotMatch(JSON.stringify(layer), /shield-(?:interstate|state)/);
  }
});
