import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { buildAtakXml } from "../../web/atak.js";
import { applyAmericanaShields } from "../../web/americana-style.js";

const execute = promisify(execFile);
const upstream = "https://github.com/osm-americana/openstreetmap-americana";
const upstreamCommit = "6098606aae8119de34a5de08e7bedc1ffdd712a8";

test("replaces Daylight with the credited, self-hosted upstream Americana style", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);

  const style = JSON.parse(await readFile("styles/daylight/style.json", "utf8"));
  const rasterStyle = JSON.parse(await readFile("styles/daylight-raster/style.json", "utf8"));
  const sprite = JSON.parse(await readFile("styles/daylight/sprite.json", "utf8"));
  const config = JSON.parse(await readFile("config.json", "utf8"));
  const html = await readFile("web/index.html", "utf8");
  const app = await readFile("web/app.js", "utf8");
  const vector = await readFile("web/atak-vector.js", "utf8");
  const shieldRuntime = await readFile("web/americana.js", "utf8");
  const notices = await readFile("THIRD_PARTY_NOTICES.md", "utf8");

  assert.equal(style.name, "Americana");
  assert.equal(style.metadata["map-room:theme"], "daylight");
  assert.equal(style.metadata["map-room:upstream"], upstream);
  assert.equal(style.metadata["map-room:upstream-commit"], upstreamCommit);
  assert.equal(style.sources.osm.url, "mbtiles://{osm}");
  assert.doesNotMatch(JSON.stringify(style), /tiles\.openstreetmap\.us|americanamap\.org|s3\.amazonaws\.com/,
    "Americana must not call upstream hosted tiles, glyphs, sprites, or terrain at runtime");
  assert.deepEqual(config.styles.daylight, {
    style: "daylight/style.json",
    tilejson: { type: "baselayer" }
  });
  assert.deepEqual(config.styles["daylight-raster"], {
    style: "daylight-raster/style.json",
    tilejson: { type: "baselayer" }
  });

  const layers = Object.fromEntries(style.layers.map((layer) => [layer.id, layer]));
  assert.ok(style.layers.length >= 350, "Map Room must use the real upstream layer hierarchy, not a lookalike palette");
  assert.equal(layers["highway-shield"].type, "symbol");
  assert.ok(JSON.stringify(layers["highway-shield"].layout).includes('"shield","\\n"'),
    "the upstream dynamic shield image expression must remain intact");
  assert.ok(style.layers.some((layer) => /place_star/.test(JSON.stringify(layer.layout?.["icon-image"]))),
    "the upstream capital-star treatment must remain intact");
  assert.equal(layers["buildings-3d"].type, "fill-extrusion");
  assert.equal(layers["buildings-3d"].layout.visibility, "visible");
  assert.ok(Object.keys(sprite).length >= 280, "the complete upstream sprite atlas must be packaged locally");
  for (const id of ["place_star", "place_star_in_circle", "poi_hospital", "poi_fire_station", "poi_police_shield", "poi_fuel", "poi_plane", "poi_restaurant", "poi_hotel", "poi_museum", "poi_supermarket", "poi_p"]) {
    assert.ok(sprite[id], `${id} must come from the locally packaged upstream atlas`);
  }
  const rasterShields = rasterStyle.layers.find(({ id }) => id === "highway-shield");
  assert.equal(rasterStyle.metadata["map-room:renderer"], "tileserver-gl");
  assert.doesNotMatch(JSON.stringify(rasterShields), /\["image"/,
    "server-rendered shields cannot depend on MapLibre's styleimagemissing hook");
  assert.match(JSON.stringify(rasterShields.layout["icon-image"]), /shield_us_interstate_2/);
  assert.match(JSON.stringify(rasterShields.layout["icon-image"]), /shield_badge_3/);
  assert.match(JSON.stringify(rasterShields.layout["text-field"]), /route_1_ref/);
  const poiFilter = JSON.stringify(layers.poi.filter);
  assert.match(poiFilter, /"bus_stop"\],17/,
    "dense transit stops must wait until explore zooms");
  assert.match(poiFilter, /"parking"\],18/,
    "parking must wait until the highest detail zooms");

  assert.doesNotMatch(html, /data-theme="americana"/);
  assert.match(html, /data-theme="daylight"[\s\S]*OpenStreetMap Americana · CC0/);
  assert.match(app, /daylight:\s*\{\s*name:\s*"Daylight"/);
  assert.match(vector, /daylight:\s*"Daylight"/);
  assert.match(shieldRuntime, /URLShieldRenderer/);
  assert.match(shieldRuntime, /\/vendor\/americana-shields\.json/);
  assert.match(notices, /OpenStreetMap Americana[\s\S]*6098606[\s\S]*CC0-1\.0/);

  const xml = buildAtakXml({ theme: "daylight", baseUrl: "http://maps.example.test:8088" });
  assert.match(xml, /<name>Map Room - Daylight<\/name>/);
  assert.match(xml, /<backgroundColor>#f4f1ea<\/backgroundColor>/);
  assert.match(xml, /\/styles\/all-daylight-raster\/\{\$z\}\/\{\$x\}\/\{\$y\}@2x\.png/);
});

test("uses Americana dynamic shields in every browser theme", async () => {
  await execute(process.execPath, ["styles/build-styles.mjs"]);
  const template = JSON.parse(await readFile("web/vendor/americana-shield-layer.json", "utf8"));

  for (const theme of ["daylight", "midnight", "dark-blue", "dark-red", "dark-green", "cyberpunk", "cyberpunk-tactical"]) {
    const authoredStyle = JSON.parse(await readFile(`styles/${theme}/style.json`, "utf8"));
    const style = await applyAmericanaShields(authoredStyle, { template });
    const shield = style.layers.find(({ id }) => id === "highway-shield" || id === "road-shields");
    const serialized = JSON.stringify(shield);
    assert.equal(shield?.type, "symbol", `${theme} must publish a shield layer`);
    assert.match(serialized, /"shield","\\n"/, `${theme} must request Americana runtime shields`);
    assert.match(serialized, /route_8_network/, `${theme} must support concurrent route shields`);
    assert.doesNotMatch(serialized, /shield-(?:interstate|us|state|county)/,
      `${theme} must not use Map Room's retired fixed shield sprites`);
  }
});
