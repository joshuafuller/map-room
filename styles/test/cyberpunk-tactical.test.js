import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
const classicDigest = "2dfea4a0ade55a78823d71483725196ae2201b0be2b15ceec83b52af87afd882";

test("generates an additive Cyberpunk Tactical style without changing Classic", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);

  const classic = await readFile("styles/cyberpunk/style.json");
  const tactical = JSON.parse(await readFile("styles/cyberpunk-tactical/style.json", "utf8"));
  const config = JSON.parse(await readFile("config.json", "utf8"));
  const html = await readFile("web/index.html", "utf8");
  const css = await readFile("web/app.css", "utf8");

  assert.equal(createHash("sha256").update(classic).digest("hex"), classicDigest);
  assert.equal(tactical.name, "Cyberpunk Tactical");
  assert.equal(tactical.metadata["map-room:theme"], "cyberpunk-tactical");
  assert.equal(tactical.metadata["map-room:style-version"], "1.0.0");
  assert.deepEqual(config.styles["cyberpunk-tactical"], {
    style: "cyberpunk-tactical/style.json",
    tilejson: { type: "baselayer" }
  });
  assert.match(html, /data-theme="cyberpunk-tactical"/);
  assert.match(html, /id="grid-toggle"/);
  assert.match(css, /prefers-reduced-motion: reduce/);

  const layers = Object.fromEntries(tactical.layers.map((layer) => [layer.id, layer]));
  assert.equal(new Set(Object.keys(layers)).size, tactical.layers.length);
  assert.equal(layers["coordinate-grid"].minzoom, 14);
  assert.equal(layers["coordinate-grid"].layout.visibility, "none");
  assert.ok(layers["urban-glow"]);
  assert.ok(layers["coastline-glow"]);
  assert.ok(layers["airports"]);
  assert.equal(layers["airports"].type, "fill");
  assert.ok(layers["operational-landmarks"]);
  assert.deepEqual(layers["roads-glow"].filter[2][1], ["motorway", "trunk", "primary"]);
  assert.ok(layers["roads-glow"].paint["line-opacity"] <= 0.4);
  assert.equal(layers["place-labels"].paint["text-halo-color"], "#03040b");
  assert.doesNotMatch(JSON.stringify(tactical), /https?:\/\//);
});
