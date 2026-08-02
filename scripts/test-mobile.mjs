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
