import test from "node:test";
import assert from "node:assert/strict";
import { planReconciliation } from "../src/reconcile.js";

test("queues every selected missing map once", () => {
  const jobs = planReconciliation({
    selections: [
      { regionId: "us/florida", enabled: true, autoUpdate: true },
      { regionId: "us/texas", enabled: true, autoUpdate: false },
      { regionId: "us/florida", enabled: true, autoUpdate: true },
      { regionId: "us/alabama", enabled: false, autoUpdate: true }
    ],
    installed: []
  });

  assert.deepEqual(jobs, [
    { type: "install", regionId: "us/florida", reason: "missing" },
    { type: "install", regionId: "us/texas", reason: "missing" }
  ]);
});

test("only updates stale maps whose automatic updates are enabled", () => {
  const jobs = planReconciliation({
    selections: [
      { regionId: "us/florida", enabled: true, autoUpdate: true },
      { regionId: "us/texas", enabled: true, autoUpdate: false }
    ],
    installed: [
      { regionId: "us/florida", sourceTimestamp: "2026-07-30T00:00:00Z", availableTimestamp: "2026-07-31T00:00:00Z" },
      { regionId: "us/texas", sourceTimestamp: "2026-07-30T00:00:00Z", availableTimestamp: "2026-07-31T00:00:00Z" }
    ]
  });

  assert.deepEqual(jobs, [{ type: "update", regionId: "us/florida", reason: "source-newer" }]);
});
