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

test("runs work enqueued after the active batch started even when that job fails", async () => {
  let signalStarted;
  let release;
  const started = new Promise((resolve) => { signalStarted = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const visits = [];
  const queue = new JobQueue({
    worker: async (job, update) => {
      visits.push(job.regionId);
      if (job.regionId === "first") {
        update({ phase: "building" });
        signalStarted();
        await gate;
        throw new Error("first failed");
      }
    }
  });

  const first = queue.enqueue({ type: "create", regionId: "first" });
  await started;
  const second = queue.enqueue({ type: "create", regionId: "second" });
  release();
  await queue.whenIdle();

  assert.equal(first.status, "failed");
  assert.equal(first.lastPhase, "building");
  assert.equal(second.status, "complete");
  assert.deepEqual(visits, ["first", "second"]);
});
