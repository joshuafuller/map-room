import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:8088";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function waitForJob(name) {
  const row = page.locator(".job-row").filter({ hasText: name }).first();
  await page.waitForFunction((jobName) => {
    const job = [...document.querySelectorAll(".job-row")].find((item) => item.textContent.includes(jobName));
    return ["complete", "failed"].includes(job?.querySelector(".job-state")?.textContent);
  }, name, { timeout: 10 * 60 * 1000 });
  if (await row.locator(".job-state").textContent() === "failed") throw new Error(`${name} failed: ${await row.textContent()}`);
}

async function deleteMap(id) {
  const row = page.locator(".map-row").filter({ hasText: id }).first();
  await row.locator(".delete").click();
  await row.locator(".delete-confirm input").fill(id);
  await row.locator(".confirm-delete").click();
  await page.waitForFunction((mapId) => ![...document.querySelectorAll("#region-select option")].some(({ value }) => value === mapId), id);
}

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#manage-maps").click();
  await page.locator("#map-manager").waitFor({ state: "visible" });

  await page.locator("#catalog-search").fill("Rhode Island");
  await page.waitForFunction(() => [...document.querySelectorAll("#catalog-region option")].some(({ value }) => value === "us/rhode-island"));
  await page.locator("#catalog-region").selectOption("us/rhode-island");
  await page.locator("#map-name").fill("Catalog Smoke");
  await page.locator("#map-id").fill("catalog-smoke");
  await page.locator("#map-create-form button[type=submit]").click();
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll(".job-row")].find((item) => item.textContent.includes("Catalog Smoke"));
    return row?.textContent.includes("Generating vector tiles with Planetiler — still working") && /\d+s elapsed/.test(row.textContent);
  }, null, { timeout: 10 * 60 * 1000 });

  await page.locator("#map-source-type").selectOption("url");
  await page.locator("#map-source-url").fill("https://download.geofabrik.de/north-america/us/rhode-island-latest.osm.pbf");
  await page.locator("#map-name").fill("HTTPS Smoke");
  await page.locator("#map-id").fill("https-smoke");
  await page.locator("#map-create-form button[type=submit]").click();
  await page.locator(".job-row").filter({ hasText: "HTTPS Smoke" }).getByText("Waiting for another map").waitFor();

  await waitForJob("Catalog Smoke");
  await page.waitForFunction(() => [...document.querySelectorAll("#region-select option")].some(({ value }) => value === "catalog-smoke"));
  await page.locator(".map-row").filter({ hasText: "Catalog · us/rhode-island" }).waitFor();
  await waitForJob("HTTPS Smoke");
  await page.waitForFunction(() => [...document.querySelectorAll("#region-select option")].some(({ value }) => value === "https-smoke"));
  await page.locator(".map-row").filter({ hasText: "HTTPS · download.geofabrik.de" }).waitFor();
  await deleteMap("catalog-smoke");
  await deleteMap("https-smoke");
} finally {
  const state = await fetch(`${baseUrl}/api/maps`).then((response) => response.json()).catch(() => ({ maps: [] }));
  for (const id of ["catalog-smoke", "https-smoke"]) {
    if (state.maps.some((map) => map.id === id)) await fetch(`${baseUrl}/api/maps/${id}?confirm=${id}`, { method: "DELETE" });
  }
  await browser.close();
}

console.log("PASS catalog and allow-listed HTTPS maps were built and deleted through the UI");
