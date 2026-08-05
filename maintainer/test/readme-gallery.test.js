import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "../..");
const states = ["queued", "downloading", "building", "failed", "complete"];

test("README uses the architecture flow and references a bounded real-UI state gallery", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  const lines = readme.trimEnd().split("\n");

  assert.ok(lines.length <= 220, `README should stay focused (found ${lines.length} lines)`);
  assert.match(readme, /^## Choose how ATAK uses the map$/m);
  assert.match(readme, /^## Quick start$/m);
  assert.match(readme, /```mermaid\s+flowchart LR/);

  const localTargets = [...readme.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => !/^(?:https?:|#)/.test(target));
  for (const target of localTargets) {
    await assert.doesNotReject(
      stat(path.join(root, target)),
      `README local target should exist: ${target}`,
    );
  }

  for (const state of states) {
    const relative = `docs/screenshots/map-manager-${state}.jpg`;
    assert.match(readme, new RegExp(relative.replaceAll("/", "\\/")));
    const image = path.join(root, relative);
    const [{ size }, metadata] = await Promise.all([stat(image), sharp(image).metadata()]);
    assert.ok(size <= 200 * 1024, `${relative} should be at most 200 KB`);
    assert.ok(metadata.width >= 500 && metadata.width <= 900, `${relative} should be a readable close-up`);
    assert.ok(metadata.height >= 90 && metadata.height <= 260, `${relative} should crop to one manager card`);
  }
});
