import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import sharp from "sharp";

const execute = promisify(execFile);
const themeIds = ["daylight", "midnight", "dark-blue", "dark-red", "dark-green", "cyberpunk", "cyberpunk-tactical"];

async function countPixels(image, predicate) {
  const { data } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (predicate(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) count += 1;
  }
  return count;
}

function evaluateStyleExpression(expression, properties) {
  if (!Array.isArray(expression)) return expression;
  const [operator, ...operands] = expression;
  const evaluate = (value) => evaluateStyleExpression(value, properties);
  if (operator === "get") return properties[operands[0]];
  if (operator === "coalesce") return operands.map(evaluate).find((value) => value !== null && value !== undefined);
  if (operator === "to-string") return String(evaluate(operands[0]));
  if (operator === "length") return evaluate(operands[0]).length;
  if (operator === "slice") return evaluate(operands[0]).slice(evaluate(operands[1]), operands[2] === undefined ? undefined : evaluate(operands[2]));
  if (operator === "index-of") return evaluate(operands[1]).indexOf(evaluate(operands[0]));
  if (operator === "==") return evaluate(operands[0]) === evaluate(operands[1]);
  if (operator === ">=") return evaluate(operands[0]) >= evaluate(operands[1]);
  if (operator === "any") return operands.some(evaluate);
  if (operator === "case") return evaluate(operands[0]) ? evaluate(operands[1]) : evaluate(operands[2]);
  if (operator === "match") {
    const input = evaluate(operands[0]);
    for (let index = 1; index < operands.length - 1; index += 2) {
      const labels = Array.isArray(operands[index]) ? operands[index] : [operands[index]];
      if (labels.includes(input)) return evaluate(operands[index + 1]);
    }
    return evaluate(operands.at(-1));
  }
  throw new Error(`Unsupported test expression: ${operator}`);
}

test("renders unmistakable high-contrast browser road shields", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const style = JSON.parse(await readFile("styles/daylight/style.json", "utf8"));
  const sprite = await sharp(await readFile("styles/daylight/sprite.png"));
  const interstate = sprite.clone().extract({ left: 0, top: 0, width: 128, height: 128 });
  const usRoute = sprite.clone().extract({ left: 128, top: 0, width: 128, height: 128 });

  assert.ok(await countPixels(interstate.clone(), (r, g, b, a) => a > 220 && b > 80 && b > r * 1.25 && b > g * 1.1) > 1800,
    "Interstate shields need a substantial blue field, not a hairline outline");
  assert.ok(await countPixels(interstate.clone(), (r, g, b, a) => a > 220 && r > 145 && r > g * 1.45 && r > b * 1.25) > 400,
    "Interstate shields need a visible red crown");
  assert.ok(await countPixels(usRoute.clone(), (r, g, b, a) => a > 220 && r > 230 && g > 230 && b > 230) > 2500,
    "US route shields need a substantial white field");
  assert.ok(await countPixels(usRoute.clone(), (r, g, b, a) => a > 220 && r < 55 && g < 55 && b < 65) > 550,
    "US route shields need a substantial dark border");

  const shield = style.layers.find(({ id }) => id === "road-shields");
  assert.deepEqual(shield.layout["icon-size"], [
    "interpolate", ["linear"], ["zoom"], 6, 1, 9, 1.08, 13, 1.2
  ]);
  assert.match(JSON.stringify(shield.paint["text-color"]), /#ffffff/,
    "Interstate route numbers need white text on the blue field");
});

test("builds local game-inspired shields and truthful POI categories", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const style = JSON.parse(await readFile("styles/cyberpunk-tactical/style.json", "utf8"));
  const sprite = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite.json", "utf8"));
  const designs = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite-design.json", "utf8"));
  const png = await readFile("styles/cyberpunk-tactical/sprite.png");
  const retinaSprite = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite@2x.json", "utf8"));
  const retinaPng = await readFile("styles/cyberpunk-tactical/sprite@2x.png");
  const atakSprite = JSON.parse(await readFile("styles/cyberpunk-tactical/atak-sprite.json", "utf8"));
  const atakPng = await readFile("styles/cyberpunk-tactical/atak-sprite.png");
  const html = await readFile("web/index.html", "utf8");
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const notices = await readFile("THIRD_PARTY_NOTICES.md", "utf8");

  assert.equal(style.sprite, "{styleJsonFolder}/sprite");
  const layers = Object.fromEntries(style.layers.map((layer) => [layer.id, layer]));
  assert.equal(layers["road-shields"].type, "symbol");
  assert.deepEqual(layers["road-shields"].layout["icon-size"], [
    "interpolate", ["linear"], ["zoom"], 6, 1, 9, 1.08, 13, 1.2
  ]);
  assert.equal(layers["road-shields"].layout["symbol-spacing"], 340);
  assert.equal(layers["road-shields"].layout["icon-text-fit"], undefined,
    "browser shields must never warp their standard silhouette around the route number");
  assert.equal(layers["road-shields"].layout["icon-text-fit-padding"], undefined);
  const routeLength = ["length", ["to-string", ["coalesce", ["get", "route_1_ref"], ["get", "ref"], ""]]];
  const iconImage = JSON.stringify(layers["road-shields"].layout["icon-image"]);
  for (const id of ["shield-interstate-wide", "shield-us-wide", "shield-state-wide"]) {
    assert.match(iconImage, new RegExp(id), `${id} must be selected for three-digit references`);
  }
  assert.match(iconImage, /route_1_ref/, "shield proportions must be selected from the normalized route reference");
  const selectShield = (route_1_network, route_1_ref, network) => evaluateStyleExpression(
    layers["road-shields"].layout["icon-image"], { route_1_network, route_1_ref, network });
  assert.equal(selectShield("US:I", "10", "us-interstate"), "shield-interstate");
  assert.equal(selectShield("US:I", "35E", "us-interstate"), "shield-interstate-wide",
    "alphanumeric Interstate references such as I-35E must use the fixed wide marker");
  assert.equal(selectShield("US:I:Express", "25", "road"), "shield-interstate");
  assert.equal(selectShield("US:US", "98", "us-highway"), "shield-us");
  assert.equal(selectShield("US:US:Alternate", "90", "road"), "shield-us");
  assert.equal(selectShield("US:US", "290", "us-highway"), "shield-us-wide");
  assert.equal(selectShield("US:TX", "71", "us-state"), "shield-state");
  assert.equal(selectShield("US:CO", "83", "us-state"), "shield-state");
  assert.equal(selectShield("US:CA", "1", "us-state"), "shield-state");
  assert.equal(selectShield("US:TX:Loop", "360", "road"), "shield-state-wide");
  assert.equal(selectShield("US:FL:CR", "12", "road"), "shield-county");
  assert.equal(selectShield("US:WA:CR", "507", "us-county"), "shield-county");
  assert.deepEqual(layers["road-shields"].layout["text-size"], [
    "interpolate", ["linear"], ["zoom"],
    6, ["step", routeLength, 13, 3, 12, 5, 11],
    10, ["step", routeLength, 15, 3, 14, 5, 12.5],
    14, ["step", routeLength, 17, 3, 15, 5, 13.5]
  ]);
  assert.ok(Array.isArray(layers["road-shields"].paint["text-halo-color"]));
  assert.match(JSON.stringify(layers["road-shields"].paint["text-halo-color"]), /#174a7e/);
  assert.match(JSON.stringify(layers["road-shields"].paint["text-halo-color"]), /#ffffff/);
  assert.ok(Array.isArray(layers["road-shields"].paint["text-halo-width"]));
  assert.deepEqual(layers["road-shields"].paint["text-halo-width"].slice(-2), [0.45, 0.35]);
  assert.match(JSON.stringify(layers["road-shields"]), /route_1_ref/);
  assert.match(JSON.stringify(layers["road-shields"]), /us-state/);
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
    "shield-interstate", "shield-interstate-wide", "shield-us", "shield-us-wide",
    "shield-state", "shield-state-wide", "shield-county",
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
  const fhwaSource = "https://mutcd.fhwa.dot.gov/kno-shs_2024-release-status/pdf/2024_SHS_Release_5-Guide_Signs.pdf";
  assert.deepEqual(designs["shield-interstate"], { standard: "FHWA M1-1", source: fhwaSource });
  assert.deepEqual(designs["shield-us"], { standard: "FHWA M1-4 guide-sign use", source: fhwaSource });
  assert.deepEqual(designs["shield-state"], { standard: "FHWA M1-5 guide-sign use", source: fhwaSource });
  assert.deepEqual(designs["shield-county"], { standard: "FHWA M1-6", source: fhwaSource });
  for (const id of ["poi-fire", "poi-police", "poi-airport", "poi-food", "poi-attraction"]) {
    assert.ok(designs[id].silhouette.length >= 2, `${id} must use a recognizable multi-part silhouette`);
  }
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(sprite["poi-fuel"].width, 128);
  assert.equal(sprite["poi-fuel"].height, 128);
  assert.equal(sprite["poi-fuel"].pixelRatio, 4);
  for (const shieldId of ["shield-interstate", "shield-us", "shield-state", "shield-county"]) {
    assert.equal(sprite[shieldId].width, sprite[shieldId].height, `${shieldId} must use a fixed square marker`);
    assert.equal(sprite[shieldId].content, undefined, `${shieldId} must not publish an elastic browser text-content box`);
    assert.equal(sprite[shieldId].stretchX, undefined, `${shieldId} must not publish a browser stretch region`);
  }
  for (const shieldId of ["shield-interstate-wide", "shield-us-wide", "shield-state-wide"]) {
    assert.equal(sprite[shieldId].width / sprite[shieldId].height, 30 / 24,
      `${shieldId} must use the MUTCD three-digit 30:24 proportion`);
    assert.equal(sprite[shieldId].content, undefined);
    assert.equal(sprite[shieldId].stretchX, undefined);
  }
  const shieldAlphaDigests = new Set();
  for (let index = 0; index < 4; index += 1) {
    const alpha = await sharp(png).extract({ left: index * 128, top: 0, width: 128, height: 128 }).ensureAlpha().extractChannel("alpha").raw().toBuffer();
    shieldAlphaDigests.add(createHash("sha256").update(alpha).digest("hex"));
  }
  assert.equal(shieldAlphaDigests.size, 4, "browser road classes must use four distinct shield silhouettes");
  const county = sprite["shield-county"];
  const countyImage = sharp(png).extract({ left: county.x, top: county.y, width: county.width, height: county.height });
  assert.ok(await countPixels(countyImage.clone(), (r, g, b, a) => a > 220 && b > 90 && b > r * 1.25) > 2200,
    "FHWA M1-6 county markers need a substantial blue field");
  assert.ok(await countPixels(countyImage.clone(), (r, g, b, a) => a > 220 && r > 210 && g > 150 && b < 90) > 500,
    "FHWA M1-6 county markers need a visible yellow border");
  const state = sprite["shield-state"];
  const stateAlpha = await sharp(png).extract({ left: state.x, top: state.y, width: state.width, height: state.height })
    .ensureAlpha().extractChannel("alpha").raw().toBuffer();
  assert.ok(stateAlpha[4 * state.width + Math.floor(state.width / 2)] > 220,
    "FHWA M1-5 state markers need the circle to reach the top center");
  assert.ok(stateAlpha[4 * state.width + 4] < 30,
    "FHWA M1-5 state markers need transparent corners instead of a rounded rectangle");
  assert.equal(atakSprite["shield-interstate"].width, 32);
  assert.equal(atakSprite["shield-interstate"].height, 32);
  assert.equal(atakSprite["shield-interstate"].pixelRatio, 1);
  assert.equal(atakSprite["shield-interstate-wide"], undefined,
    "browser-only fixed variants must not change ATAK sprite compatibility");
  const shieldContent = new Set();
  for (const id of ["shield-interstate", "shield-us", "shield-state", "shield-county"]) {
    assert.equal(atakSprite[id].pixelRatio, 1);
    assert.equal(atakSprite[id].content.length, 4, `${id} must define its safe text area`);
    assert.ok(atakSprite[id].stretchX.length > 0, `${id} must stretch around long route references`);
    assert.ok(atakSprite[id].content[0] < atakSprite[id].content[2]);
    shieldContent.add(JSON.stringify(atakSprite[id].content));
  }
  assert.equal(shieldContent.size, 4, "each shield shape must define its own safe text area");
  assert.equal(atakPng.readUInt32BE(16), 128);
  assert.equal(atakPng.readUInt32BE(20), 128);
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
    const atakSprite = JSON.parse(await readFile(`styles/${id}/atak-sprite.json`, "utf8"));
    const retinaSprite = JSON.parse(await readFile(`styles/${id}/sprite@2x.json`, "utf8"));
    const png = await readFile(`styles/${id}/sprite.png`);
    const atakPng = await readFile(`styles/${id}/atak-sprite.png`);
    const retinaPng = await readFile(`styles/${id}/sprite@2x.png`);

    assert.equal(style.sprite, "{styleJsonFolder}/sprite");
    assert.equal(atakSprite["shield-interstate"].pixelRatio, 1, `${id} must publish ATAK-normalized shields`);
    assert.equal(atakPng.readUInt32BE(16), 128, `${id} must publish a 128 px ATAK atlas`);
    for (const layerId of ["road-shields", "poi-essential", "poi-explore", "poi-parking", "poi-airports", "airports", "runways", "taxiways"]) {
      assert.ok(layers[layerId], `${id} is missing ${layerId}`);
    }
    assert.equal(layers["road-shields"].minzoom, 6, `${id} must show the available major route shields in browser overviews`);
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
