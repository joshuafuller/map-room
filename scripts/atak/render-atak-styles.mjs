import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";

const BASE = "http://localhost:8088";
const SERVE = "http://localhost:8099/atakstyles-serve";
const ROOT = "/tmp/claude-1000/-home-user-development-map-room/a5576f6f-4690-41e5-838b-e12ba87d76b5/scratchpad";

// Point ATAK's bundled styles at Map Room's own tiles, sprites and glyphs.
// Font stacks are substituted because Map Room serves Open Sans, not Noto Sans;
// the geometry, colours and layer rules are ATAK's own.
const FONTS = { "Noto Sans Regular": "Open Sans Regular", "Noto Sans Bold": "Open Sans Bold", "Noto Sans Italic": "Open Sans Italic" };

const variants = ["bright", "dark", "overlay"];
mkdirSync(`${ROOT}/atakstyles-serve`, { recursive: true });
// MapLibre must be same-origin: Map Room serves /vendor without CORS headers.
cpSync("/home/user/development/map-room/web/vendor", `${ROOT}/atakstyles-serve/vendor`, { recursive: true });

for (const variant of variants) {
  const src = `${ROOT}/atakstyles/assets/style/omt/${variant}`;
  const dst = `${ROOT}/atakstyles-serve/${variant}`;
  cpSync(src, dst, { recursive: true });
  const style = JSON.parse(readFileSync(`${src}/style.json`, "utf8"));
  style.sources = { openmaptiles: { type: "vector", url: `${BASE}/data/colorado.json` } };
  style.glyphs = `${BASE}/fonts/{fontstack}/{range}.pbf`;
  if (style.sprite) style.sprite = `${SERVE}/${variant}/${style.sprite}`;
  for (const layer of style.layers) {
    if (layer.source && layer.source !== "openmaptiles") layer.source = "openmaptiles";
    const font = layer.layout?.["text-font"];
    if (font) layer.layout["text-font"] = font.map((f) => FONTS[f] ?? f);
  }
  writeFileSync(`${dst}/style.json`, JSON.stringify(style));
  console.log(`prepared omt/${variant}: ${style.layers.length} layers`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 110)); });

for (const variant of variants) {
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="../vendor/maplibre-gl.css" />
    <style>html,body,#map{margin:0;height:100%;width:100%}</style></head>
    <body><div id="map"></div>
    <script type="module">
      import * as maplibregl from "../vendor/maplibre-gl.mjs";
      const map = new maplibregl.Map({
        container: "map",
        style: "${SERVE}/${variant}/style.json",
        center: [-104.82, 38.84],
        zoom: 12.2,
        attributionControl: false
      });
      map.on("load", () => { window.__ready = true; });
      map.on("error", (e) => console.error("maplibre:", e?.error?.message ?? e));
    </script></body></html>`;
  writeFileSync(`${ROOT}/atakstyles-serve/${variant}/render.html`, html);
  await page.goto(`${SERVE}/${variant}/render.html`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 45000 });
    await page.waitForTimeout(7000);
  } catch { console.log(`  ${variant}: load timeout, capturing anyway`); }
  await page.screenshot({ path: `${ROOT}/shots/atakstyle-${variant}.png` });
  console.log(`rendered omt/${variant}`);
}
await browser.close();
