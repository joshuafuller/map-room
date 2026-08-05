import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:8088";
const outputDir = new URL("../docs/screenshots/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(8000);

const capture = async (name) => page.screenshot({
  path: new URL(name, outputDir).pathname,
  type: "jpeg",
  quality: 86
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".maplibregl-canvas").waitFor({ state: "visible" });
await page.waitForFunction(() => document.querySelector("#region")?.textContent !== "Loading local map…");
await page.waitForTimeout(900);
await capture("map-overview.jpg");

await page.locator("#panel-toggle").click();
const preferredRegion = await page.locator('#region-select option[value="florida"]').count() ? "florida" : null;
if (preferredRegion) await page.locator("#region-select").selectOption(preferredRegion);
await page.locator('[data-theme="dark-blue"]').click();
await page.locator('[data-theme="dark-blue"][aria-checked="true"]').waitFor();
await page.waitForTimeout(1000);
await capture("dark-blue-theme.jpg");

await page.setViewportSize({ width: 1440, height: 1120 });
await page.evaluate(() => {
  const content = document.querySelector(".panel-content");
  const hosted = document.querySelector("#hosted-path-title");
  content.scrollTop = hosted.offsetTop - 85;
});
await page.waitForTimeout(300);
await capture("atak-workflows.jpg");

await page.setViewportSize({ width: 1440, height: 900 });
await page.locator('[data-theme="daylight"]').click();
await page.locator('[data-theme="daylight"][aria-checked="true"]').waitFor();
await page.evaluate(() => { window.location.hash = "#16/25.775/-80.19/-18/58"; });
await page.locator("#buildings-toggle").click();
await page.waitForTimeout(1200);
await page.locator("#panel-toggle").click();
await capture("daylight-3d.jpg");

await browser.close();
console.log(`README screenshots written to ${outputDir.pathname}`);
