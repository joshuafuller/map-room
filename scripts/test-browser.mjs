import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import sharp from "sharp";

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
const catalog = await page.evaluate(() => fetch("/regions.json").then((response) => response.json()));
const vectorTestRegion = catalog.regions.find(({ id }) => id === "florida") ?? catalog.regions[0];

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
if (await page.locator("#atak-download").textContent() !== "Download raster/TMS source (.xml)") {
  failures.push("ATAK raster action did not name the configuration file it downloads");
}
const pathHeadings = await page.locator(".path-card h3").allTextContents();
if (!pathHeadings.includes("Host and stream maps") ||
    !pathHeadings.includes("Make a completely offline map")) {
  failures.push("ATAK setup did not present hosted and completely offline use as separate first-class paths");
}
await page.locator("#hosted-path-title").scrollIntoViewIfNeeded();
await page.screenshot({ path: new URL("atak-hosted-offline-paths.png", outputDir).pathname });
await page.locator(".delivery-guide summary").click();
const deliveryGuideText = await page.locator(".delivery-guide").textContent();
if (!deliveryGuideText.includes("XML / JSON") ||
    !deliveryGuideText.includes("Vector PBF — preferred") ||
    !deliveryGuideText.includes("Raster / TMS") ||
    !deliveryGuideText.includes("MBTiles") ||
    !deliveryGuideText.includes("does not mean live tracking")) {
  failures.push("ATAK delivery guide did not explain streaming, configuration, and archive choices");
}
const deliveryGuidePath = new URL("atak-delivery-guide.png", outputDir);
await page.screenshot({ path: deliveryGuidePath.pathname });
await page.locator(".delivery-guide summary").click();

if (await page.locator("#region-select option").count() !== catalog.regions.length + 1) {
  failures.push("Map view selector did not list the composed map and every installed regional view");
}
if (await page.locator("#region-select").inputValue() !== "all") {
  failures.push("Map view selector did not start on the composed map");
}
if (await page.locator("#atak-vector-map").isVisible()) {
  failures.push("Composed map view exposed a stale regional MBTiles download");
}
await page.locator("#region-select").selectOption(vectorTestRegion.id);
await page.waitForFunction((name) => document.querySelector("#region")?.textContent === name, vectorTestRegion.name);
const offlineMessage = await page.locator("#offline-message").textContent();
if (!offlineMessage.includes(vectorTestRegion.name) || !/\d+(?:\.\d+)?\s(?:KB|MB|GB)/.test(offlineMessage)) {
  failures.push("Completely offline path did not identify the selected region and its archive size");
}
if (await page.locator("#atak-vector-map").textContent() !== `Download ${vectorTestRegion.name} archive (.mbtiles)`) {
  failures.push("Completely offline action did not name the region and MBTiles file type");
}
if (!(await page.locator("#atak-vector-map").isVisible())) {
  failures.push("Selected regional view did not expose its MBTiles download");
}
if (requestedUrls.some((url) => url.includes(`/styles/${vectorTestRegion.id}-daylight/`))) {
  failures.push(`Framing ${vectorTestRegion.name} switched away from the composed map layer`);
}
await page.locator("#region-select").selectOption("all");
await page.waitForFunction(() => document.querySelector("#region")?.textContent === "All installed maps");

if (await page.locator("#detail-hint").getAttribute("hidden") !== null) {
  failures.push("Daylight did not explain automatic progressive detail");
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
const midnightPath = new URL("midnight.png", outputDir);
await page.screenshot({ path: midnightPath.pathname });

const practicalThemePaths = new Map();
await page.locator("#region-select").selectOption(vectorTestRegion.id);
await page.waitForFunction((name) => document.querySelector("#region")?.textContent === name, vectorTestRegion.name);
for (const theme of ["dark-blue", "dark-red", "dark-green"]) {
  await page.locator(`[data-theme="${theme}"]`).click();
  await page.locator(`[data-theme="${theme}"][aria-checked="true"]`).waitFor();
  await page.waitForTimeout(1200);
  const path = new URL(`${theme}.png`, outputDir);
  await page.locator(".maplibregl-canvas").screenshot({ path: path.pathname });
  practicalThemePaths.set(theme, path);
}
await page.locator("#region-select").selectOption("all");
await page.waitForFunction(() => document.querySelector("#region")?.textContent === "All installed maps");

await page.locator('[data-theme="cyberpunk"]').click();
await page.locator('[data-theme="cyberpunk"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1200);
const cyberpunkPath = new URL("cyberpunk.png", outputDir);
await page.screenshot({ path: cyberpunkPath.pathname });

await page.locator('[data-theme="cyberpunk-tactical"]').click();
await page.locator('[data-theme="cyberpunk-tactical"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1200);
await page.locator("#region-select").selectOption(vectorTestRegion.id);
await page.waitForFunction((name) => document.querySelector("#region")?.textContent === name, vectorTestRegion.name);
if (await page.locator("#atak-vector-map").getAttribute("href") !== `/atak/vector/${vectorTestRegion.id}.mbtiles`) {
  failures.push(`ATAK vector test did not link to the selected ${vectorTestRegion.name} archive`);
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
const vectorSourceDocument = await readFile(downloadedVectorSourcePath, "utf8");
const vectorSource = JSON.parse(vectorSourceDocument);
if (downloadedVectorSource.suggestedFilename() !== `map-room-${vectorTestRegion.id}-atak-vector.json` ||
    Buffer.byteLength(vectorSourceDocument) > 8192 ||
    vectorSource.schema !== "4.0.0" ||
    vectorSource.title !== `Map Room - ${vectorTestRegion.name}` ||
    vectorSource.url !== `${baseUrl}/data/${vectorTestRegion.id}/{$z}/{$x}/{$y}.pbf` ||
    vectorSource.content !== "vector" ||
    vectorSource.mimeType !== "application/vnd.mapbox-vector-tile" ||
    vectorSource.srs !== "EPSG:3857" ||
    vectorSource.numLevels !== vectorTestRegion.maxZoom + 1 ||
    vectorSource.downloadable !== true ||
    vectorSource.metadata.styleSchema !== "omt" ||
    "json" in vectorSource.metadata) {
  failures.push("ATAK vector source download did not preserve the importable remote PBF contract");
}
const vectorStyleDownload = page.waitForEvent("download");
await page.locator("#atak-vector-style").click();
const downloadedVectorStyle = await vectorStyleDownload;
const downloadedVectorStylePath = await downloadedVectorStyle.path();
const vectorStyle = JSON.parse(await readFile(downloadedVectorStylePath, "utf8"));
if (downloadedVectorStyle.suggestedFilename() !== "map-room-cyberpunk-tactical-atak-vector.json" ||
    vectorStyle.name !== "Map Room - Cyberpunk Tactical - ATAK Vector" ||
    Object.keys(vectorStyle.sources).length !== 1 ||
    vectorStyle.sources.osm.url !== `${baseUrl}/data/${vectorTestRegion.id}.json` ||
    vectorStyle.sprite !== `${baseUrl}/styles/cyberpunk-tactical/sprite` ||
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
await page.locator(".raster-option summary").click();
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
const progressiveDetail = await page.evaluate(async () => {
  const style = await fetch("/styles/all-cyberpunk-tactical/style.json").then((response) => response.json());
  const first = (prefix) => style.layers.find(({ id }) => id.startsWith(prefix));
  return {
    essential: first("poi-essential--")?.minzoom,
    explore: first("poi-explore--")?.minzoom,
    addresses: first("house-numbers--")?.minzoom,
    parking: first("poi-parking--")?.minzoom
  };
});
if (!(progressiveDetail.essential < progressiveDetail.explore &&
      progressiveDetail.explore < progressiveDetail.addresses &&
      progressiveDetail.addresses === progressiveDetail.parking)) {
  failures.push("POIs, addresses, and parking did not progressively disclose at increasing zoom levels");
}
if ((await page.locator("[data-poi-preset]").count()) !== 0) {
  failures.push("automatic progressive disclosure still exposed manual detail buttons");
}
for (const zoom of [14, 17, 18]) {
  await page.evaluate((value) => { window.location.hash = `#${value}/25.775/-80.19`; }, zoom);
  await page.waitForTimeout(900);
  await page.locator(".maplibregl-canvas").screenshot({
    path: new URL(`progressive-detail-z${zoom}.png`, outputDir).pathname
  });
}

const tacticalPath = new URL("cyberpunk-tactical-california.png", outputDir);
await page.screenshot({ path: tacticalPath.pathname });
if (!(await page.locator('.swatch.cyberpunk-tactical').evaluate((element) => getComputedStyle(element).backgroundImage)).includes("/styles/all-cyberpunk-tactical/")) {
  failures.push("Tactical preview card did not use a real local raster tile");
}

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
await page.evaluate(() => { window.location.hash = "#12/25.775/-80.19"; });
await page.waitForTimeout(1600);
const rotationHashBefore = await page.evaluate(() => window.location.hash);
await page.mouse.move(600, 450);
await page.mouse.down({ button: "right" });
await page.mouse.move(710, 510, { steps: 10 });
await page.mouse.up({ button: "right" });
await page.waitForTimeout(500);
if (await page.evaluate(() => window.location.hash) === rotationHashBefore) {
  failures.push("right-button mouse drag did not rotate or tilt the map camera");
}
await page.evaluate(() => { window.location.hash = "#12/25.775/-80.19"; });
await page.waitForTimeout(500);
if (await page.locator("#buildings-toggle").getAttribute("hidden") !== null) {
  failures.push("Cyberpunk Tactical did not expose the 3D building control");
}
if (await page.locator("#rotate-hint").getAttribute("hidden") !== null ||
    !(await page.locator("#rotate-hint").textContent()).includes("right-drag")) {
  failures.push("vector view did not explain mouse camera rotation");
}
await page.locator('[data-theme="daylight"]').click();
await page.locator('[data-theme="daylight"][aria-checked="true"]').waitFor();
if (await page.locator("#buildings-toggle").getAttribute("hidden") !== null) {
  failures.push("Daylight did not expose the 3D building control");
}
await page.evaluate(() => { window.location.hash = "#16/25.775/-80.19/-18/58"; });
await page.locator("#buildings-toggle").click();
await page.waitForTimeout(1100);
await page.locator(".maplibregl-canvas").screenshot({
  path: new URL("daylight-buildings.png", outputDir).pathname
});
await page.locator("#buildings-toggle").click();
await page.locator('[data-theme="cyberpunk-tactical"]').click();
await page.locator('[data-theme="cyberpunk-tactical"][aria-checked="true"]').waitFor();
await page.waitForTimeout(700);
await page.locator("#buildings-toggle").click();
if (await page.locator("#buildings-toggle").getAttribute("aria-pressed") !== "true") {
  failures.push("Cyberpunk 3D buildings could not be enabled");
}
await page.waitForTimeout(1100);
const buildingZoom = Number((await page.evaluate(() => window.location.hash)).slice(1).split("/")[0]);
if (buildingZoom < 15) {
  failures.push(`Cyberpunk 3D buildings remained below a legible zoom (${buildingZoom})`);
}
const buildingLayerCounts = await page.evaluate(async () => {
  const themeIds = ["daylight", "midnight", "dark-blue", "dark-red", "dark-green", "cyberpunk", "cyberpunk-tactical"];
  return Promise.all(themeIds.map(async (theme) => {
    const style = await fetch(`/styles/all-${theme}/style.json`).then((response) => response.json());
    return [theme, style.layers.filter(({ id }) => id.startsWith("buildings-3d--")).length];
  }));
});
if (buildingLayerCounts.some(([, count]) => count !== catalog.regions.length)) {
  failures.push("every composed theme did not publish one 3D building layer per installed region");
}
await page.locator("#buildings-toggle").click();
await page.evaluate(() => { window.location.hash = "#16/25.775/-80.19/-18/58"; });
await page.waitForTimeout(1600);
const buildingsOffPath = new URL("cyberpunk-tactical-buildings-off.png", outputDir);
const buildingsOnPath = new URL("cyberpunk-tactical-buildings-on.png", outputDir);
await page.locator(".maplibregl-canvas").screenshot({ path: buildingsOffPath.pathname });
await page.locator("#buildings-toggle").click();
await page.waitForTimeout(1600);
await page.locator(".maplibregl-canvas").screenshot({ path: buildingsOnPath.pathname });
const tacticalMiamiPath = new URL("cyberpunk-tactical-miami.png", outputDir);
await page.screenshot({ path: tacticalMiamiPath.pathname });

const digest = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const daylightDigest = await digest(daylightPath);
const midnightDigest = await digest(midnightPath);
const cyberpunkDigest = await digest(cyberpunkPath);
const tacticalDigest = await digest(tacticalPath);
const tacticalMiamiDigest = await digest(tacticalMiamiPath);
const tacticalRasterMiamiDigest = await digest(tacticalRasterMiamiPath);
const practicalThemeDigests = await Promise.all([...practicalThemePaths.values()].map(digest));

const buildingsOff = await sharp(buildingsOffPath.pathname).raw().toBuffer({ resolveWithObject: true });
const buildingsOn = await sharp(buildingsOnPath.pathname).raw().toBuffer();
let changedBuildingPixels = 0;
let buildingColorDelta = 0;
for (let index = 0; index < buildingsOff.data.length; index += 4) {
  const delta = Math.abs(buildingsOff.data[index] - buildingsOn[index])
    + Math.abs(buildingsOff.data[index + 1] - buildingsOn[index + 1])
    + Math.abs(buildingsOff.data[index + 2] - buildingsOn[index + 2]);
  if (delta > 30) changedBuildingPixels += 1;
  buildingColorDelta += delta;
}
const buildingPixelCount = buildingsOff.info.width * buildingsOff.info.height;
if (changedBuildingPixels < 100000 || buildingColorDelta / buildingPixelCount < 10) {
  failures.push(`3D building toggle did not visibly change the map (${changedBuildingPixels} pixels)`);
}

if (daylightDigest === midnightDigest) failures.push("theme screenshots are identical");
if (new Set(practicalThemeDigests).size !== practicalThemeDigests.length) failures.push("Dark blue, red, and green screenshots are not visually distinct");
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
console.log("PASS Dark Blue, Dark Red, and Dark Green produced distinct browser screenshots");
console.log("PASS Cyberpunk produced a distinct vector screenshot");
console.log("PASS every vector theme exposes 3D buildings and right-drag rotates the camera");
console.log("PASS Cyberpunk Tactical rendered distinctly with a real preview tile and ATAK raster request");
console.log(`Screenshots: ${outputDir.pathname}`);
