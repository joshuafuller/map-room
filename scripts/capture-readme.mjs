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

const managerState = await fetch(`${baseUrl}/api/maps`).then((response) => response.json());
const screenshotJob = {
  id: "readme-progress",
  regionId: "rhode-island",
  name: "Rhode Island",
  status: "running",
  phase: "downloading",
  createdAt: new Date(Date.now() - 73_000).toISOString(),
  startedAt: new Date(Date.now() - 70_000).toISOString(),
  progress: { completedBytes: 25 * 1024 ** 2, totalBytes: 100 * 1024 ** 2, percent: 25, bytesPerSecond: 5 * 1024 ** 2, etaSeconds: 15 },
  error: null
};
await page.route("**/api/maps", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ ...managerState, jobs: [screenshotJob] })
}));
await page.locator("#manage-maps").click();
await page.locator("#map-manager").waitFor({ state: "visible" });
await page.locator("#catalog-search").fill("florida");
await page.waitForFunction(() => [...document.querySelectorAll("#catalog-region option")].some(({ value }) => value === "us/florida"));
await page.locator("#catalog-region").selectOption("us/florida");
await capture("map-management.jpg");

await browser.close();
console.log(`README screenshots written to ${outputDir.pathname}`);
