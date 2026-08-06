import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { applyAmericanaShields } from "../../web/americana-style.js";

const execute = promisify(execFile);
const themeIds = ["daylight", "midnight", "dark-blue", "dark-red", "dark-green", "cyberpunk", "cyberpunk-tactical"];

test("uses Americana's dynamic nationwide shield system for Daylight", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const style = JSON.parse(await readFile("styles/daylight/style.json", "utf8"));
  const shield = style.layers.find(({ id }) => id === "highway-shield");
  const shieldLayout = JSON.stringify(shield.layout);
  assert.equal(shield.type, "symbol");
  assert.ok(shieldLayout.includes('"shield","\\n"'));
  assert.match(shieldLayout, /route_1_network/);
  assert.match(shieldLayout, /route_8_network/);
  assert.match(await readFile("web/vendor/americana-shields.json", "utf8"), /US:I/,
    "the packaged Americana renderer must include nationwide network definitions");
});

test("uses Americana browser shields with truthful colored-theme POI categories", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const authoredStyle = JSON.parse(await readFile("styles/cyberpunk-tactical/style.json", "utf8"));
  const template = JSON.parse(await readFile("web/vendor/americana-shield-layer.json", "utf8"));
  const style = await applyAmericanaShields(authoredStyle, { template });
  const sprite = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite.json", "utf8"));
  const designs = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite-design.json", "utf8"));
  const png = await readFile("styles/cyberpunk-tactical/sprite.png");
  const retinaSprite = JSON.parse(await readFile("styles/cyberpunk-tactical/sprite@2x.json", "utf8"));
  const daylightSprite = JSON.parse(await readFile("styles/daylight/sprite.json", "utf8"));
  const daylightPng = await readFile("styles/daylight/sprite.png");
  const atakSprite = JSON.parse(await readFile("styles/cyberpunk-tactical/atak-sprite.json", "utf8"));
  const atakPng = await readFile("styles/cyberpunk-tactical/atak-sprite.png");
  const html = await readFile("web/index.html", "utf8");
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const notices = await readFile("THIRD_PARTY_NOTICES.md", "utf8");

  assert.equal(style.sprite, "{styleJsonFolder}/sprite");
  const layers = Object.fromEntries(style.layers.map((layer) => [layer.id, layer]));
  assert.equal(layers["road-shields"].type, "symbol");
  const shieldLayer = JSON.stringify(layers["road-shields"]);
  assert.match(shieldLayer, /"shield","\\n"/);
  assert.match(shieldLayer, /route_8_network/);
  assert.doesNotMatch(shieldLayer, /shield-(?:interstate|us|state|county)/);
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

  assert.deepEqual(sprite, daylightSprite, "colored themes must publish only Americana's browser/raster atlas");
  assert.deepEqual(png, daylightPng, "colored themes must publish Americana's exact sprite pixels");
  assert.deepEqual(Object.keys(retinaSprite).sort(), Object.keys(sprite).sort());
  for (const id of [
    "poi_hospital", "poi_fire_station", "poi_police_shield", "poi_fuel", "poi_plane",
    "poi_restaurant", "poi_hotel", "poi_museum", "poi_supermarket", "poi_p", "place_star"
  ]) {
    assert.ok(sprite[id], `${id} must come from Americana`);
    assert.equal(retinaSprite[id].pixelRatio, 2);
  }
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

test("uses Americana shields across Daylight and every colored theme", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const spriteDigests = new Set();
  let canonicalSemantics;
  const template = JSON.parse(await readFile("web/vendor/americana-shield-layer.json", "utf8"));

  for (const id of themeIds) {
    const authoredStyle = JSON.parse(await readFile(`styles/${id}/style.json`, "utf8"));
    const style = await applyAmericanaShields(authoredStyle, { template });
    const layers = Object.fromEntries(style.layers.map((layer) => [layer.id, layer]));
    const sprite = JSON.parse(await readFile(`styles/${id}/sprite.json`, "utf8"));
    const atakSprite = JSON.parse(await readFile(`styles/${id}/atak-sprite.json`, "utf8"));
    const retinaSprite = JSON.parse(await readFile(`styles/${id}/sprite@2x.json`, "utf8"));
    const png = await readFile(`styles/${id}/sprite.png`);
    const atakPng = await readFile(`styles/${id}/atak-sprite.png`);

    assert.equal(style.sprite, "{styleJsonFolder}/sprite");
    if (id === "daylight") {
      assert.equal(style.metadata["map-room:upstream"], "https://github.com/osm-americana/openstreetmap-americana");
      assert.equal(layers["highway-shield"].type, "symbol");
      assert.equal(layers["buildings-3d"].type, "fill-extrusion");
      assert.equal(layers["buildings-3d"].layout.visibility, "visible");
      assert.ok(sprite.place_star);
      assert.ok(sprite.poi_hospital);
      continue;
    }
    assert.equal(atakSprite["shield-interstate"].pixelRatio, 1, `${id} must publish ATAK-normalized shields`);
    assert.equal(atakPng.readUInt32BE(16), 128, `${id} must publish a 128 px ATAK atlas`);
    for (const layerId of ["road-shields", "poi-essential", "poi-explore", "poi-parking", "poi-airports", "airports", "runways", "taxiways"]) {
      assert.ok(layers[layerId], `${id} is missing ${layerId}`);
    }
    assert.match(JSON.stringify(layers["road-shields"]), /"shield","\\n"/,
      `${id} must use Americana runtime shields`);
    assert.equal(layers["buildings-3d"].type, "fill-extrusion", `${id} must support 3D buildings`);
    assert.equal(layers["buildings-3d"].layout.visibility, "visible");
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
    assert.deepEqual(Object.keys(retinaSprite).sort(), Object.keys(sprite).sort());
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

  assert.equal(spriteDigests.size, 1, "every colored theme must use the same pinned Americana sprite pixels");
});

test("preserves Americana's neutral building treatment for Daylight", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const style = JSON.parse(await readFile("styles/daylight/style.json", "utf8"));
  const buildings = style.layers.find(({ id }) => id === "buildings-3d");
  assert.deepEqual(buildings.paint["fill-extrusion-color"], [
    "interpolate", ["linear"], ["zoom"], 13, "hsl(0, 0%, 87%)", 16, "hsl(0, 0%, 80%)"
  ]);
  assert.equal(buildings.layout.visibility, "visible");
});
