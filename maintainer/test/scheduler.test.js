import test from "node:test";
import assert from "node:assert/strict";
import { shouldCheckForUpdates } from "../src/scheduler.js";

test("checks immediately on first startup and again after the configured interval", () => {
  const now = Date.parse("2026-08-01T12:00:00Z");
  assert.equal(shouldCheckForUpdates({ lastCheckedAt: null, intervalHours: 24, now }), true);
  assert.equal(shouldCheckForUpdates({ lastCheckedAt: "2026-08-01T00:00:01Z", intervalHours: 24, now }), false);
  assert.equal(shouldCheckForUpdates({ lastCheckedAt: "2026-07-31T11:59:59Z", intervalHours: 24, now }), true);
});
