import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStateStore } from "../src/store.js";

test("persists multiple selections and update settings across restarts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-store-"));
  const path = join(directory, "state.json");
  const store = new JsonStateStore(path);
  await store.save({
    selections: [
      { regionId: "us/florida", enabled: true, autoUpdate: true },
      { regionId: "us/texas", enabled: true, autoUpdate: false }
    ],
    settings: { autoUpdate: true, checkIntervalHours: 24 }
  });

  const reloaded = await new JsonStateStore(path).load();
  assert.equal(reloaded.selections.length, 2);
  assert.equal(reloaded.settings.checkIntervalHours, 24);
  const raw = await readFile(path, "utf8");
  assert.doesNotThrow(() => JSON.parse(raw));
});
