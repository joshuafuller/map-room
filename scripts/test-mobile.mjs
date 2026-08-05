import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:8088";
const expectedOrigin = new URL(baseUrl).origin;
const outputDir = new URL("../data/browser-test/", import.meta.url);
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices["Pixel 7"] });
const page = await context.newPage();
const failures = [];
const vectorRequests = [];

page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
page.on("requestfailed", (request) => failures.push(`request failed: ${request.url()} (${request.failure()?.errorText})`));
page.on("request", (request) => {
  if (/\/data\/[a-z0-9-]+(?:\.json|\/)/.test(request.url())) vectorRequests.push(request.url());
});

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.locator(".maplibregl-canvas").waitFor({ state: "visible" });
await page.waitForFunction(() => document.querySelector("#region")?.textContent === "All installed maps");
await page.waitForTimeout(1000);
const catalog = await page.evaluate(() => fetch("/regions.json").then((response) => response.json()));

const initialPanel = await page.evaluate(() => {
  const panel = document.querySelector(".panel");
  const toggle = document.querySelector("#panel-toggle");
  return {
    height: panel?.getBoundingClientRect().height ?? Infinity,
    width: panel?.getBoundingClientRect().width ?? Infinity,
    hasToggle: Boolean(toggle),
    toggleVisible: Boolean(toggle && getComputedStyle(toggle).display !== "none"),
    expanded: toggle?.getAttribute("aria-expanded")
  };
});
if (!initialPanel.hasToggle || !initialPanel.toggleVisible) failures.push("mobile controls did not expose a visible collapse toggle");
if (initialPanel.height > 80) failures.push(`mobile controls started at ${initialPanel.height}px instead of at most 80px`);
if (initialPanel.width > 64) failures.push(`collapsed mobile controls remained a ${initialPanel.width}px-wide panel instead of a compact button`);
if (initialPanel.expanded !== "false") failures.push("mobile controls did not start collapsed");

if (initialPanel.hasToggle) {
  await page.locator("#panel-toggle").click();
  const expandedPanel = await page.locator(".panel").evaluate((panel) => panel.getBoundingClientRect().height);
  if (await page.locator("#panel-toggle").getAttribute("aria-expanded") !== "true") failures.push("mobile controls did not report their expanded state");
  if (expandedPanel <= initialPanel.height) failures.push("mobile controls did not grow when expanded");
  await page.locator("#hosted-path-title").scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL("mobile-atak-paths.png", outputDir).pathname, fullPage: true });
  const pathHeadings = await page.locator(".path-card h3").allTextContents();
  if (!pathHeadings.includes("Host and stream maps") ||
      !pathHeadings.includes("Make a completely offline map")) {
    failures.push("mobile ATAK setup did not distinguish hosted and completely offline paths");
  }
  await page.locator(".delivery-guide summary").click();
  await page.screenshot({ path: new URL("mobile-atak-delivery-guide.png", outputDir).pathname, fullPage: true });
  if (await page.locator(".delivery-guide").getAttribute("open") === null) failures.push("mobile ATAK delivery guide could not be expanded");
  await page.locator("#panel-toggle").click();
  if (await page.locator("#panel-toggle").getAttribute("aria-expanded") !== "false") failures.push("mobile controls could not be collapsed again");
}

for (const { id: region } of catalog.regions) {
  if (!vectorRequests.some((url) => url.includes(`/data/${region}`))) {
    failures.push(`mobile Chrome did not request the ${region} vector source`);
  }
}
for (const url of vectorRequests) {
  if (new URL(url).origin !== expectedOrigin) {
    failures.push(`vector request escaped the page origin: ${url}`);
  }
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`PASS mobile Chrome loaded ${catalog.regions.length} vector sources through ${expectedOrigin}`);
