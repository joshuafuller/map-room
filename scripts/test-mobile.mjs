import { chromium, devices } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:8088";
const expectedOrigin = new URL(baseUrl).origin;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices["Pixel 7"] });
const page = await context.newPage();
const failures = [];
const vectorRequests = [];

page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
page.on("requestfailed", (request) => failures.push(`request failed: ${request.url()} (${request.failure()?.errorText})`));
page.on("request", (request) => {
  if (/\/data\/(?:california|florida)(?:\.json|\/)/.test(request.url())) vectorRequests.push(request.url());
});

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".maplibregl-canvas").waitFor({ state: "visible" });
await page.waitForFunction(() => document.querySelector("#region")?.textContent === "All installed maps");
await page.waitForTimeout(1000);

const initialPanel = await page.evaluate(() => {
  const panel = document.querySelector(".panel");
  const toggle = document.querySelector("#panel-toggle");
  return {
    height: panel?.getBoundingClientRect().height ?? Infinity,
    hasToggle: Boolean(toggle),
    toggleVisible: Boolean(toggle && getComputedStyle(toggle).display !== "none"),
    expanded: toggle?.getAttribute("aria-expanded")
  };
});
if (!initialPanel.hasToggle || !initialPanel.toggleVisible) failures.push("mobile controls did not expose a visible collapse toggle");
if (initialPanel.height > 80) failures.push(`mobile controls started at ${initialPanel.height}px instead of at most 80px`);
if (initialPanel.expanded !== "false") failures.push("mobile controls did not start collapsed");

if (initialPanel.hasToggle) {
  await page.locator("#panel-toggle").click();
  const expandedPanel = await page.locator(".panel").evaluate((panel) => panel.getBoundingClientRect().height);
  if (await page.locator("#panel-toggle").getAttribute("aria-expanded") !== "true") failures.push("mobile controls did not report their expanded state");
  if (expandedPanel <= initialPanel.height) failures.push("mobile controls did not grow when expanded");
  await page.locator("#panel-toggle").click();
  if (await page.locator("#panel-toggle").getAttribute("aria-expanded") !== "false") failures.push("mobile controls could not be collapsed again");
}

for (const region of ["california", "florida"]) {
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
console.log(`PASS mobile Chrome loaded both vector sources through ${expectedOrigin}`);
