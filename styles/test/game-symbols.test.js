import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);

test("builds local game-inspired shields and truthful POI categories", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const style = JSON.parse(await readFile("styles/cyberpunk-tactical/style.json", "utf8"));
  const sprite = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite.json", "utf8"));
  const png = await readFile("styles/cyberpunk-tactical/sprite.png");
  const html = await readFile("web/index.html", "utf8");

  assert.equal(style.sprite, "/styles/cyberpunk-tactical/sprite");
  const layers = Object.fromEntries(style.layers.map((layer) => [layer.id, layer]));
  assert.equal(layers["road-shields"].type, "symbol");
  assert.ok(layers["road-shields"].layout["icon-size"] >= 0.8);
  assert.ok(layers["road-shields"].layout["text-size"] >= 11);
  assert.ok(Array.isArray(layers["road-shields"].paint["text-halo-color"]));
  assert.match(JSON.stringify(layers["road-shields"].paint["text-halo-color"]), /#f6f8ff/);
  assert.match(JSON.stringify(layers["road-shields"].paint["text-halo-color"]), /#03040b/);
  assert.ok(Array.isArray(layers["road-shields"].paint["text-halo-width"]));
  assert.match(JSON.stringify(layers["road-shields"]), /route_1_ref/);
  assert.match(JSON.stringify(layers["road-shields"]), /US:FL:CR/);
  assert.equal(layers["poi-essential"].layout.visibility, "visible");
  assert.ok(layers["poi-essential"].layout["icon-size"] >= 0.65);
  assert.equal(layers["poi-explore"].layout.visibility, "none");
  assert.match(JSON.stringify(layers["poi-essential"]), /hospital/);
  assert.match(JSON.stringify(layers["poi-essential"]), /fire_station/);
  assert.match(JSON.stringify(layers["poi-essential"]), /fuel/);
  assert.match(JSON.stringify(layers["poi-explore"]), /restaurant/);
  assert.match(JSON.stringify(layers["poi-explore"]), /lodging/);

  const requiredSprites = [
    "shield-interstate", "shield-us", "shield-state", "shield-county",
    "poi-medical", "poi-fire", "poi-police", "poi-fuel", "poi-airport", "poi-port",
    "poi-food", "poi-lodging", "poi-attraction", "poi-shopping", "poi-parking"
  ];
  assert.deepEqual(Object.keys(sprite).sort(), requiredSprites.sort());
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(html, /data-poi-preset="essential"/);
  assert.match(html, /data-poi-preset="explore"/);
});
