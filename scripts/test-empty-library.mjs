import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:18088";
const smokePbf = process.env.MAP_ROOM_BUILD_SMOKE_PBF;
if (!smokePbf) throw new Error("MAP_ROOM_BUILD_SMOKE_PBF is required");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#manage-maps").waitFor({ state: "visible" });
  if (!await page.locator("#region-select").isDisabled()) throw new Error("new empty library did not disable the map selector");
  await page.locator("#manage-maps").click();
  await page.locator("#map-manager").waitFor({ state: "visible" });
  await page.getByText("No maps installed. Add the first one above.").waitFor();
  if (await page.locator("#map-create-form").isVisible()) throw new Error("empty library exposed the full creation form before Add map was chosen");
  await page.locator("#manager-add-map").click();
  await page.locator("#map-create-form").waitFor({ state: "visible" });

  await page.locator("#map-source-type").selectOption("upload");
  await page.locator("#map-upload").setInputFiles(smokePbf);
  await page.locator("#map-name").fill("First Map");
  await page.locator("#map-create-form button[type=submit]").click();
  await page.locator("#manager-library-view").waitFor({ state: "visible" });
  const job = page.locator(".job-row").filter({ hasText: "First Map" }).first();
  await job.waitFor();
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const { maps, jobs } = await fetch(`${baseUrl}/api/maps`).then((response) => response.json());
    const status = jobs.findLast((entry) => entry.name === "First Map")?.status;
    if (status === "failed") throw new Error(`first-map build failed: ${await job.textContent()}`);
    if (maps.some((entry) => entry.id === "first-map")) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const published = await fetch(`${baseUrl}/api/maps`).then((response) => response.json());
  if (!published.maps.some((entry) => entry.id === "first-map")) throw new Error("first-map did not finish within 10 minutes");
  try {
    await page.waitForFunction(() => [...document.querySelectorAll("#region-select option")].some(({ value }) => value === "first-map"));
  } catch (error) {
    const [catalog, api, managerStatus, options] = await Promise.all([
      page.evaluate(() => fetch("/regions.json", { cache: "no-store" }).then((response) => response.json())),
      page.evaluate(() => fetch("/api/maps").then((response) => response.json())),
      page.locator("#manager-status").textContent(),
      page.locator("#region-select option").allTextContents()
    ]);
    throw new Error(`first map did not refresh into the viewer: ${JSON.stringify({ catalog, api, managerStatus, options })}`, { cause: error });
  }
  if (await page.locator(".map-row").filter({ hasText: "Uploaded PBF" }).count() !== 1) throw new Error("first map did not identify its uploaded source");

  const row = page.locator(".map-row").filter({ hasText: "first-map" }).first();
  await row.locator(".delete").click();
  await row.locator(".confirm-delete").click();
  await page.waitForFunction(() => document.querySelector("#region-select")?.disabled === true);
  await page.getByText("No maps installed. Add the first one above.").waitFor();
} finally {
  await browser.close();
}

console.log("PASS empty library created and deleted its first map entirely through the UI");
