import test from "node:test";
import assert from "node:assert/strict";
import { ProgressTracker } from "../src/progress.js";

test("calculates bytes, percent, transfer rate, and ETA", () => {
  const progress = new ProgressTracker({ startedAt: 1_000 });
  progress.update({ completedBytes: 10_000_000, totalBytes: 100_000_000, now: 2_000 });
  const snapshot = progress.update({ completedBytes: 30_000_000, totalBytes: 100_000_000, now: 4_000 });

  assert.equal(snapshot.percent, 30);
  assert.equal(snapshot.bytesPerSecond, 10_000_000);
  assert.equal(snapshot.etaSeconds, 7);
});

test("reports indeterminate progress when content length is unavailable", () => {
  const progress = new ProgressTracker({ startedAt: 1_000 });
  const snapshot = progress.update({ completedBytes: 4_000, totalBytes: null, now: 2_000 });
  assert.equal(snapshot.percent, null);
  assert.equal(snapshot.etaSeconds, null);
  assert.equal(snapshot.bytesPerSecond, 4_000);
});
