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

const daylightPath = new URL("daylight.png", outputDir);
await page.screenshot({ path: daylightPath.pathname });

const rasterResponse = page.waitForResponse((response) => response.url().includes("/styles/daylight/512/") && response.url().endsWith(".png"));
await page.locator('[data-mode="raster"]').click();
await page.locator('[data-mode="raster"][aria-checked="true"]').waitFor();
await rasterResponse;
await page.waitForTimeout(500);
if (!requestedUrls.some((url) => url.includes("/styles/daylight/512/") && url.endsWith(".png"))) {
  failures.push("ATAK raster mode did not request rendered PNG tiles");
}

await page.locator('[data-mode="vector"]').click();
await page.locator('[data-mode="vector"][aria-checked="true"]').waitFor();

await page.locator('[data-theme="midnight"]').click();
await page.locator('[data-theme="midnight"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1200);

const midnightPath = new URL("midnight.png", outputDir);
await page.screenshot({ path: midnightPath.pathname });

await page.locator('[data-theme="cyberpunk"]').click();
await page.locator('[data-theme="cyberpunk"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1200);

const cyberpunkPath = new URL("cyberpunk.png", outputDir);
await page.screenshot({ path: cyberpunkPath.pathname });

await page.locator('[data-theme="cyberpunk-tactical"]').click();
await page.locator('[data-theme="cyberpunk-tactical"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1200);
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

const tacticalPath = new URL("cyberpunk-tactical-florida.png", outputDir);
await page.screenshot({ path: tacticalPath.pathname });
if (await page.locator("#grid-toggle").getAttribute("aria-pressed") !== "false") {
  failures.push("Tactical coordinate grid was not disabled by default");
}
if (!(await page.locator('.swatch.cyberpunk-tactical').evaluate((element) => getComputedStyle(element).backgroundImage)).includes("/styles/cyberpunk-tactical/")) {
  failures.push("Tactical preview card did not use a real local raster tile");
}
await page.locator("#grid-toggle").click();
if (await page.locator("#grid-toggle").getAttribute("aria-pressed") !== "true") {
  failures.push("Tactical coordinate grid could not be enabled");
}
await page.locator("#grid-toggle").click();

const tacticalRasterResponse = page.waitForResponse((response) => response.url().includes("/styles/cyberpunk-tactical/512/") && response.url().endsWith(".png"));
await page.locator('[data-mode="raster"]').click();
await page.locator('[data-mode="raster"][aria-checked="true"]').waitFor();
await tacticalRasterResponse;
const tacticalHighZoomResponse = page.waitForResponse((response) => /\/styles\/cyberpunk-tactical\/512\/(?:1[5-8])\//.test(response.url()) && response.url().endsWith(".png"));
await page.evaluate(() => { window.location.hash = "#17/25.775/-80.19"; });
await tacticalHighZoomResponse;
await page.waitForTimeout(500);
const tacticalRasterMiamiPath = new URL("cyberpunk-tactical-miami-raster.png", outputDir);
await page.screenshot({ path: tacticalRasterMiamiPath.pathname });

await page.locator('[data-mode="vector"]').click();
await page.locator('[data-mode="vector"][aria-checked="true"]').waitFor();
await page.waitForTimeout(700);
await page.evaluate(() => { window.location.hash = "#13.2/25.775/-80.19"; });
await page.waitForTimeout(1600);
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
