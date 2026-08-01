import test from "node:test";
import assert from "node:assert/strict";
import { JobQueue } from "../src/queue.js";

test("runs one map job at a time and de-duplicates active region jobs", async () => {
  const started = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const queue = new JobQueue({
    worker: async (job) => {
      started.push(job.regionId);
      if (job.regionId === "us/florida") await gate;
    }
  });

  const first = queue.enqueue({ type: "install", regionId: "us/florida" });
  const duplicate = queue.enqueue({ type: "update", regionId: "us/florida" });
  const second = queue.enqueue({ type: "install", regionId: "us/texas" });
  assert.equal(first.id, duplicate.id);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ["us/florida"]);
  release();
  await queue.whenIdle();
  assert.deepEqual(started, ["us/florida", "us/texas"]);
  assert.equal(second.status, "complete");
});
