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
  failures.push(`request failed: ${request.url()} (${request.failure()?.errorText})`);
});
page.on("request", (request) => requestedUrls.push(request.url()));

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".maplibregl-canvas").waitFor({ state: "visible" });
await page.waitForFunction(() => document.querySelector("#region")?.textContent !== "Loading local map…");
await page.waitForTimeout(1000);

const daylightPath = new URL("daylight.png", outputDir);
await page.screenshot({ path: daylightPath.pathname });

const rasterResponse = page.waitForResponse((response) => response.url().includes("/styles/daylight/") && response.url().endsWith(".png"));
await page.locator('[data-mode="raster"]').click();
await page.locator('[data-mode="raster"][aria-checked="true"]').waitFor();
await rasterResponse;
await page.waitForTimeout(500);
if (!requestedUrls.some((url) => url.includes("/styles/daylight/") && url.endsWith(".png"))) {
  failures.push("ATAK raster mode did not request rendered PNG tiles");
}

await page.locator('[data-mode="vector"]').click();
await page.locator('[data-mode="vector"][aria-checked="true"]').waitFor();

await page.locator('[data-theme="midnight"]').click();
await page.locator('[data-theme="midnight"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1200);

const midnightPath = new URL("midnight.png", outputDir);
await page.screenshot({ path: midnightPath.pathname });

const digest = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");
const daylightDigest = await digest(daylightPath);
const midnightDigest = await digest(midnightPath);

if (daylightDigest === midnightDigest) failures.push("theme screenshots are identical");
if ((await page.locator(".maplibregl-ctrl").count()) < 2) failures.push("MapLibre controls did not render");

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("PASS Chromium rendered the map, manifest, and controls");
console.log("PASS ATAK Raster mode requested the rendered PNG tile endpoint");
console.log("PASS Daylight and Midnight produced distinct browser screenshots");
console.log(`Screenshots: ${outputDir.pathname}`);
