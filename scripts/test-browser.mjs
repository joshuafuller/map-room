import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:8088";
const outputDir = new URL("../data/browser-test/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1
});
page.setDefaultTimeout(5000);
const failures = [];
const requestedUrls = [];

page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
page.on("requestfailed", (request) => {
  const error = request.failure()?.errorText;
  if (error !== "net::ERR_ABORTED") failures.push(`request failed: ${request.url()} (${error})`);
});
page.on("request", (request) => requestedUrls.push(request.url()));

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".maplibregl-canvas").waitFor({ state: "visible" });
await page.waitForFunction(() => document.querySelector("#region")?.textContent !== "Loading local map…");
await page.waitForTimeout(1000);

const collapsedPanel = await page.locator(".panel").evaluate((panel) => ({
  width: panel.getBoundingClientRect().width,
  height: panel.getBoundingClientRect().height
}));
if (collapsedPanel.width > 64 || collapsedPanel.height > 64) {
  failures.push(`desktop controls did not start as a compact floating button (${collapsedPanel.width}x${collapsedPanel.height})`);
}
if (await page.locator("#panel-toggle").getAttribute("aria-expanded") !== "false") {
  failures.push("desktop controls did not start collapsed");
}
await page.locator("#panel-toggle").click();
if (await page.locator("#panel-toggle").getAttribute("aria-expanded") !== "true") {
  failures.push("desktop controls could not be expanded");
}

if (await page.locator("#region-select option").count() !== 3) {
  failures.push("Map view selector did not list the composed map and both regional views");
}
if (await page.locator("#region-select").inputValue() !== "all") {
  failures.push("Map view selector did not start on the composed map");
}
await page.locator("#region-select").selectOption("florida");
await page.waitForFunction(() => document.querySelector("#region")?.textContent === "Florida");
if (requestedUrls.some((url) => url.includes("/styles/florida-daylight/"))) {
  failures.push("Framing Florida switched away from the composed map layer");
}
await page.locator("#region-select").selectOption("all");
await page.waitForFunction(() => document.querySelector("#region")?.textContent === "All installed maps");

if (await page.locator("#poi-controls").getAttribute("hidden") !== null) {
  failures.push("Daylight did not expose shared POI controls");
}

const daylightPath = new URL("daylight.png", outputDir);
await page.screenshot({ path: daylightPath.pathname });

const rasterResponse = page.waitForResponse((response) => response.url().includes("/styles/all-daylight/") && response.url().endsWith("@2x.png"));
await page.locator('[data-mode="raster"]').click();
await page.locator('[data-mode="raster"][aria-checked="true"]').waitFor();
await rasterResponse;
await page.waitForTimeout(500);
if (!requestedUrls.some((url) => url.includes("/styles/all-daylight/") && url.endsWith("@2x.png"))) {
  failures.push("ATAK raster mode did not request rendered PNG tiles");
}

await page.locator('[data-mode="vector"]').click();
await page.locator('[data-mode="vector"][aria-checked="true"]').waitFor();

await page.locator('[data-theme="midnight"]').click();
await page.locator('[data-theme="midnight"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1200);
if (await page.locator("#poi-controls").getAttribute("hidden") !== null) {
  failures.push("Midnight did not expose shared POI controls");
}

const midnightPath = new URL("midnight.png", outputDir);
await page.screenshot({ path: midnightPath.pathname });

await page.locator('[data-theme="cyberpunk"]').click();
await page.locator('[data-theme="cyberpunk"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1200);
if (await page.locator("#poi-controls").getAttribute("hidden") !== null) {
  failures.push("Cyberpunk Classic did not expose shared POI controls");
}

const cyberpunkPath = new URL("cyberpunk.png", outputDir);
await page.screenshot({ path: cyberpunkPath.pathname });

await page.locator('[data-theme="cyberpunk-tactical"]').click();
await page.locator('[data-theme="cyberpunk-tactical"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1200);
await page.locator("#region-select").selectOption("florida");
await page.waitForFunction(() => document.querySelector("#region")?.textContent === "Florida");
if (await page.locator("#atak-vector-map").getAttribute("href") !== "/atak/vector/florida.mbtiles") {
  failures.push("ATAK vector test did not link to the known-good Florida archive");
}
const vectorInstructions = await page.locator("#atak-vector-instructions").textContent();
if (!vectorInstructions.includes("Set Layer Style") ||
    !vectorInstructions.includes("Import File") ||
    !vectorInstructions.includes("not localhost")) {
  failures.push("ATAK vector workflow did not use the verified ATAK 5.8 menu labels");
}
const vectorSourceDownload = page.waitForEvent("download");
await page.locator("#atak-vector-source").click();
const downloadedVectorSource = await vectorSourceDownload;
const downloadedVectorSourcePath = await downloadedVectorSource.path();
const vectorSource = JSON.parse(await readFile(downloadedVectorSourcePath, "utf8"));
const advertisedSchema = JSON.parse(vectorSource.metadata.json);
if (downloadedVectorSource.suggestedFilename() !== "map-room-florida-atak-vector.json" ||
    vectorSource.schema !== "4.0.0" ||
    vectorSource.title !== "Map Room - Florida" ||
    vectorSource.url !== `${baseUrl}/data/florida/{$z}/{$x}/{$y}.pbf` ||
    vectorSource.content !== "vector" ||
    vectorSource.mimeType !== "application/vnd.mapbox-vector-tile" ||
    vectorSource.srs !== "EPSG:3857" ||
    vectorSource.numLevels !== 15 ||
    vectorSource.downloadable !== true ||
    vectorSource.metadata.styleSchema !== "omt" ||
    !advertisedSchema.vector_layers.some((layer) => layer.id === "building" &&
      layer.fields.render_height === "Number" && layer.fields.render_min_height === "Number")) {
  failures.push("ATAK vector source download did not preserve the remote PBF and 3D-building contract");
}
const vectorStyleDownload = page.waitForEvent("download");
await page.locator("#atak-vector-style").click();
const downloadedVectorStyle = await vectorStyleDownload;
const downloadedVectorStylePath = await downloadedVectorStyle.path();
const vectorStyle = JSON.parse(await readFile(downloadedVectorStylePath, "utf8"));
if (downloadedVectorStyle.suggestedFilename() !== "map-room-cyberpunk-atak-vector.json" ||
    vectorStyle.name !== "Map Room - Cyberpunk Classic - ATAK Vector" ||
    Object.keys(vectorStyle.sources).length !== 1 ||
    vectorStyle.sources.osm.url !== `${baseUrl}/data/florida.json` ||
    vectorStyle.sprite !== `${baseUrl}/styles/cyberpunk/sprite` ||
    vectorStyle.glyphs !== `${baseUrl}/fonts/{fontstack}/{range}.pbf` ||
    vectorStyle.layers.length < 50 ||
    !vectorStyle.layers.some((layer) => layer.id === "roads-motorway") ||
    !vectorStyle.layers.some((layer) => layer.id === "roads-primary") ||
    !vectorStyle.layers.some((layer) => layer.id === "poi-essential-fuel") ||
    vectorStyle.layers.find((layer) => layer.id === "poi-airports")?.["source-layer"] !== "aerodrome_label" ||
    /\["(?:get|literal|match|coalesce|interpolate|case|step)"/.test(JSON.stringify(vectorStyle.layers)) ||
    vectorStyle.layers.some((layer) => layer.source && layer.source !== "osm")) {
  failures.push("ATAK vector style download did not preserve the one-source custom-style contract");
}
const atakDownload = page.waitForEvent("download");
await page.locator("#atak-download").click();
const downloadedSource = await atakDownload;
const downloadedPath = await downloadedSource.path();
const downloadedXml = await readFile(downloadedPath, "utf8");
if (downloadedSource.suggestedFilename() !== "map-room-cyberpunk-tactical.xml") {
  failures.push("ATAK download did not use the single composed-map XML filename");
}
if (!downloadedXml.includes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>') ||
    !downloadedXml.includes("<tileUpdate>IfNoneMatch</tileUpdate>") ||
    !downloadedXml.includes("<ignoreErrors>false</ignoreErrors>") ||
    !downloadedXml.includes("<serverParts></serverParts>") ||
    (downloadedXml.match(/<customMapSource>/g) ?? []).length !== 1 ||
    !downloadedXml.includes("<name>Map Room - Cyberpunk Tactical</name>") ||
    !downloadedXml.includes(`${baseUrl}/styles/all-cyberpunk-tactical/{$z}/{$x}/{$y}@2x.png`)) {
  failures.push("ATAK download did not contain the hardened customMapSource contract");
}
if (await page.locator('[data-poi-preset="essential"]').getAttribute("aria-pressed") !== "true") {
  failures.push("Essential POIs were not enabled by default");
}
if (await page.locator('[data-poi-preset="explore"]').getAttribute("aria-pressed") !== "false") {
  failures.push("Explore POIs were not conservative by default");
}
await page.locator('[data-poi-preset="explore"]').click();
if (await page.locator('[data-poi-preset="explore"]').getAttribute("aria-pressed") !== "true") {
  failures.push("Explore POIs could not be enabled");
}

const tacticalPath = new URL("cyberpunk-tactical-california.png", outputDir);
await page.screenshot({ path: tacticalPath.pathname });
if (await page.locator("#grid-toggle").getAttribute("aria-pressed") !== "false") {
  failures.push("Tactical coordinate grid was not disabled by default");
}
if (!(await page.locator('.swatch.cyberpunk-tactical').evaluate((element) => getComputedStyle(element).backgroundImage)).includes("/styles/all-cyberpunk-tactical/")) {
  failures.push("Tactical preview card did not use a real local raster tile");
}
await page.locator("#grid-toggle").click();
if (await page.locator("#grid-toggle").getAttribute("aria-pressed") !== "true") {
  failures.push("Tactical coordinate grid could not be enabled");
}
await page.locator("#grid-toggle").click();

const tacticalRasterResponse = page.waitForResponse((response) => response.url().includes("/styles/all-cyberpunk-tactical/") && response.url().endsWith("@2x.png"));
await page.locator('[data-mode="raster"]').click();
await page.locator('[data-mode="raster"][aria-checked="true"]').waitFor();
await tacticalRasterResponse;
const tacticalHighZoomResponse = page.waitForResponse((response) => /\/styles\/all-cyberpunk-tactical\/(?:19|20)\//.test(response.url()) && response.url().endsWith("@2x.png"));
await page.evaluate(() => { window.location.hash = "#20/37.7749/-122.4194"; });
await tacticalHighZoomResponse;
await page.waitForTimeout(500);
const tacticalRasterMiamiPath = new URL("cyberpunk-tactical-miami-raster.png", outputDir);
await page.screenshot({ path: tacticalRasterMiamiPath.pathname });

await page.locator('[data-mode="vector"]').click();
await page.locator('[data-mode="vector"][aria-checked="true"]').waitFor();
await page.waitForTimeout(700);
await page.evaluate(() => { window.location.hash = "#13.2/25.775/-80.19"; });
await page.waitForTimeout(1600);
if (await page.locator("#buildings-toggle").getAttribute("hidden") !== null) {
  failures.push("Cyberpunk Tactical did not expose the 3D building control");
}
await page.locator("#buildings-toggle").click();
if (await page.locator("#buildings-toggle").getAttribute("aria-pressed") !== "true") {
  failures.push("Cyberpunk 3D buildings could not be enabled");
}
await page.waitForTimeout(900);
const tacticalMiamiPath = new URL("cyberpunk-tactical-miami.png", outputDir);
await page.screenshot({ path: tacticalMiamiPath.pathname });

const digest = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const daylightDigest = await digest(daylightPath);
const midnightDigest = await digest(midnightPath);
const cyberpunkDigest = await digest(cyberpunkPath);
const tacticalDigest = await digest(tacticalPath);
const tacticalMiamiDigest = await digest(tacticalMiamiPath);
const tacticalRasterMiamiDigest = await digest(tacticalRasterMiamiPath);

if (daylightDigest === midnightDigest) failures.push("theme screenshots are identical");
if (daylightDigest === cyberpunkDigest || midnightDigest === cyberpunkDigest) failures.push("Cyberpunk screenshot is not visually distinct");
if ([daylightDigest, midnightDigest, cyberpunkDigest].includes(tacticalDigest)) failures.push("Cyberpunk Tactical screenshot is not visually distinct");
if (tacticalMiamiDigest === tacticalDigest) failures.push("Cyberpunk Tactical dense-urban screenshot did not change from the regional view");
if (tacticalRasterMiamiDigest === tacticalMiamiDigest) failures.push("Tactical raster evidence did not exercise the PNG route");
if ((await page.locator(".maplibregl-ctrl").count()) < 2) failures.push("MapLibre controls did not render");

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("PASS Chromium rendered the map, manifest, and controls");
console.log("PASS ATAK Raster mode requested the rendered PNG tile endpoint");
console.log("PASS Daylight and Midnight produced distinct browser screenshots");
console.log("PASS Cyberpunk produced a distinct vector screenshot");
console.log("PASS Cyberpunk Tactical rendered distinctly with a real preview tile, default-off grid, and ATAK raster request");
console.log(`Screenshots: ${outputDir.pathname}`);
