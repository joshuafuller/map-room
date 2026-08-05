import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
const themeIds = ["daylight", "midnight", "dark-blue", "dark-red", "dark-green", "cyberpunk", "cyberpunk-tactical"];

test("builds local game-inspired shields and truthful POI categories", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const style = JSON.parse(await readFile("styles/cyberpunk-tactical/style.json", "utf8"));
  const sprite = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite.json", "utf8"));
  const designs = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite-design.json", "utf8"));
  const png = await readFile("styles/cyberpunk-tactical/sprite.png");
  const retinaSprite = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite@2x.json", "utf8"));
  const retinaPng = await readFile("styles/cyberpunk-tactical/sprite@2x.png");
  const html = await readFile("web/index.html", "utf8");
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const notices = await readFile("THIRD_PARTY_NOTICES.md", "utf8");

  assert.equal(style.sprite, "/styles/cyberpunk-tactical/sprite");
  const layers = Object.fromEntries(style.layers.map((layer) => [layer.id, layer]));
  assert.equal(layers["road-shields"].type, "symbol");
  assert.ok(layers["road-shields"].layout["icon-size"] >= 0.8);
  assert.deepEqual(layers["road-shields"].layout["text-size"], [
    "step",
    ["length", ["to-string", ["coalesce", ["get", "route_1_ref"], ["get", "ref"], ""]]],
    17,
    3, 15,
    5, 13.5
  ]);
  assert.ok(Array.isArray(layers["road-shields"].paint["text-halo-color"]));
  assert.match(JSON.stringify(layers["road-shields"].paint["text-halo-color"]), /#f6f8ff/);
  assert.match(JSON.stringify(layers["road-shields"].paint["text-halo-color"]), /#03040b/);
  assert.ok(Array.isArray(layers["road-shields"].paint["text-halo-width"]));
  assert.deepEqual(layers["road-shields"].paint["text-halo-width"].slice(-2), [0.4, 1.25]);
  assert.match(JSON.stringify(layers["road-shields"]), /route_1_ref/);
  assert.match(JSON.stringify(layers["road-shields"]), /US:FL:CR/);
  assert.equal(layers["poi-essential"].layout.visibility, "visible");
  assert.equal(layers["poi-essential"].minzoom, 14);
  assert.ok(layers["poi-essential"].layout["icon-size"] >= 1.05);
  assert.ok(layers["poi-explore"].layout["icon-size"] >= 1);
  assert.ok(layers["poi-airports"].layout["icon-size"] >= 1.05);
  assert.ok(layers["poi-airports"].maxzoom <= 12);
  assert.equal(layers["runway-glow"].type, "line");
  assert.equal(layers.runways.type, "line");
  assert.equal(layers.taxiways.type, "line");
  assert.ok(layers.taxiways.minzoom > layers.runways.minzoom);
  assert.match(JSON.stringify(layers.runways.filter), /runway/);
  assert.match(JSON.stringify(layers.taxiways.filter), /taxiway/);
  assert.equal(layers["poi-explore"].layout.visibility, "visible");
  assert.equal(layers["poi-explore"].minzoom, 17);
  assert.equal(layers["poi-parking"].layout.visibility, "visible");
  assert.equal(layers["poi-parking"].minzoom, 18);
  assert.doesNotMatch(JSON.stringify(layers["poi-explore"].filter), /parking/);
  assert.equal(layers["house-numbers"].layout.visibility, "visible");
  assert.equal(layers["house-numbers"].minzoom, 18);
  assert.match(JSON.stringify(layers["poi-essential"]), /hospital/);
  assert.match(JSON.stringify(layers["poi-essential"]), /fire_station/);
  assert.match(JSON.stringify(layers["poi-essential"]), /fuel/);
  assert.deepEqual(layers["poi-essential"].layout["text-field"].slice(0, 4), ["step", ["zoom"], "", 15]);
  assert.match(JSON.stringify(layers["poi-explore"]), /restaurant/);
  assert.match(JSON.stringify(layers["poi-explore"]), /lodging/);

  const requiredSprites = [
    "shield-interstate", "shield-us", "shield-state", "shield-county",
    "poi-medical", "poi-fire", "poi-police", "poi-fuel", "poi-airport", "poi-port",
    "poi-food", "poi-lodging", "poi-attraction", "poi-shopping", "poi-parking"
  ];
  assert.deepEqual(Object.keys(sprite).sort(), requiredSprites.sort());
  assert.deepEqual(retinaSprite, sprite);
  assert.deepEqual(retinaPng, png);
  assert.deepEqual(designs["poi-fuel"], {
    label: "Fuel",
    silhouette: ["pump-body", "display-window", "hose", "nozzle"],
    accent: "#f2dc58",
    rendering: "lucide-svg"
  });
  for (const id of ["poi-fire", "poi-police", "poi-airport", "poi-food", "poi-attraction"]) {
    assert.ok(designs[id].silhouette.length >= 2, `${id} must use a recognizable multi-part silhouette`);
  }
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(sprite["poi-fuel"].width, 128);
  assert.equal(sprite["poi-fuel"].height, 128);
  assert.equal(sprite["poi-fuel"].pixelRatio, 4);
  assert.equal(packageJson.devDependencies["lucide-static"], "1.28.0");
  assert.equal(packageJson.devDependencies.sharp, "0.35.3");
  assert.match(notices, /Lucide.*ISC/is);
  assert.match(notices, /Sharp.*Apache-2\.0/is);
  assert.equal(layers.taxiways.paint["line-color"], "#00eaff");
  assert.doesNotMatch(html, /data-poi-preset=/);
  assert.match(html, /detail appears automatically/i);
});

test("builds the same information contract with distinct sprites for every theme", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const spriteDigests = new Set();
  let canonicalSemantics;

  for (const id of themeIds) {
    const style = JSON.parse(await readFile(`styles/${id}/style.json`, "utf8"));
    const layers = Object.fromEntries(style.layers.map((layer) => [layer.id, layer]));
    const sprite = JSON.parse(await readFile(`styles/${id}/sprite.json`, "utf8"));
    const retinaSprite = JSON.parse(await readFile(`styles/${id}/sprite@2x.json`, "utf8"));
    const png = await readFile(`styles/${id}/sprite.png`);
    const retinaPng = await readFile(`styles/${id}/sprite@2x.png`);

    assert.equal(style.sprite, `/styles/${id}/sprite`);
    for (const layerId of ["road-shields", "poi-essential", "poi-explore", "poi-parking", "poi-airports", "airports", "runways", "taxiways"]) {
      assert.ok(layers[layerId], `${id} is missing ${layerId}`);
    }
    assert.equal(layers["buildings-3d"].type, "fill-extrusion", `${id} must support 3D buildings`);
    assert.equal(layers["buildings-3d"].layout.visibility, "none");
    for (const layerId of ["poi-essential-hud", "poi-explore-hud", "poi-parking-hud", "poi-airports-hud"]) {
      assert.ok(layers[layerId], `${id} is missing ${layerId}`);
    }
    assert.equal(layers["poi-essential"].layout.visibility, "visible");
    assert.equal(layers["poi-explore"].layout.visibility, "visible");
    assert.equal(layers["poi-explore"].minzoom, 17);
    assert.equal(layers["poi-parking"].layout.visibility, "visible");
    assert.equal(layers["poi-parking"].minzoom, 18);
    assert.equal(layers["house-numbers"].layout.visibility, "visible");
    assert.equal(layers["house-numbers"].minzoom, 18);
    assert.deepEqual(retinaSprite, sprite);
    assert.deepEqual(retinaPng, png);
    spriteDigests.add(createHash("sha256").update(png).digest("hex"));

    const semantics = {
      shields: layers["road-shields"].filter,
      essential: layers["poi-essential"].filter,
      explore: layers["poi-explore"].filter,
      parking: layers["poi-parking"].filter,
      airports: layers["poi-airports"].filter,
      runways: layers.runways.filter,
      taxiways: layers.taxiways.filter
    };
    canonicalSemantics ??= semantics;
    assert.deepEqual(semantics, canonicalSemantics);
  }

  assert.equal(spriteDigests.size, themeIds.length);
});

test("uses a light-specific neutral extrusion palette for Daylight", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const style = JSON.parse(await readFile("styles/daylight/style.json", "utf8"));
  const buildings = style.layers.find(({ id }) => id === "buildings-3d");
  assert.deepEqual(buildings.paint["fill-extrusion-color"], [
    "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 3],
    0, "#d8d0c6", 30, "#ddd5ca", 100, "#e5d8c5", 220, "#edd3aa"
  ]);
  assert.equal(style.light.color, "#fff8ea");
});
