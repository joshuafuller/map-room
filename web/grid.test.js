import test from "node:test";
import assert from "node:assert/strict";
import { buildCoordinateGrid } from "./grid.js";

test("builds labeled longitude and latitude lines around the visible bounds", () => {
  const grid = buildCoordinateGrid({ west: -80.25, south: 25.7, east: -80.1, north: 25.85 });

  assert.equal(grid.type, "FeatureCollection");
  assert.ok(grid.features.length >= 6);
  assert.ok(grid.features.some(({ properties }) => properties.axis === "longitude"));
  assert.ok(grid.features.some(({ properties }) => properties.axis === "latitude"));
  assert.ok(grid.features.every(({ properties }) => /^-?\d+\.\d{2}°$/.test(properties.label)));
  assert.ok(grid.features.every(({ geometry }) => geometry.type === "LineString"));
});

test("rejects invalid or excessively large view bounds", () => {
  assert.deepEqual(buildCoordinateGrid({ west: 1, south: 1, east: 1, north: 2 }).features, []);
  assert.deepEqual(buildCoordinateGrid({ west: -180, south: -90, east: 180, north: 90 }).features, []);
});
