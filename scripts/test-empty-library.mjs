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

  await page.locator("#map-source-type").selectOption("upload");
  await page.locator("#map-upload").setInputFiles(smokePbf);
  await page.locator("#map-name").fill("First Map");
  await page.locator("#map-id").fill("first-map");
  await page.locator("#map-create-form button[type=submit]").click();
  const job = page.locator(".job-row").filter({ hasText: "First Map" }).first();
  await page.waitForFunction(() => {
    const state = document.querySelector(".job-row .job-state")?.textContent;
    return state === "complete" || state === "failed";
  }, null, { timeout: 10 * 60 * 1000 });
  if (await job.locator(".job-state").textContent() === "failed") throw new Error(`first-map build failed: ${await job.textContent()}`);
  await page.waitForFunction(() => [...document.querySelectorAll("#region-select option")].some(({ value }) => value === "first-map"));
  if (await page.locator(".map-row").filter({ hasText: "Uploaded PBF" }).count() !== 1) throw new Error("first map did not identify its uploaded source");

  const row = page.locator(".map-row").filter({ hasText: "first-map" }).first();
  await row.locator(".delete").click();
  await row.locator(".delete-confirm input").fill("first-map");
  await row.locator(".confirm-delete").click();
  await page.waitForFunction(() => document.querySelector("#region-select")?.disabled === true);
  await page.getByText("No maps installed. Add the first one above.").waitFor();
} finally {
  await browser.close();
}

console.log("PASS empty library created and deleted its first map entirely through the UI");
