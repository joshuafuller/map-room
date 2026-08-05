import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:8088";
const outputDirectory = new URL("../data/browser-test/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const failures = [];
const smokePbf = process.env.MAP_ROOM_BUILD_SMOKE_PBF;

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("#manage-maps").click();
  await page.locator("#map-manager").waitFor({ state: "visible" });
  if (!await page.locator(".manager-warning").getByText("Trusted local network only").isVisible()) failures.push("manager did not disclose the unauthenticated trusted-network boundary");
  const mapCount = (await page.evaluate(() => fetch("/api/maps").then((response) => response.json()))).maps.length;
  if (await page.locator(".map-row").count() !== mapCount) failures.push("manager did not list every installed map");

  await page.waitForFunction(() => document.querySelectorAll("#catalog-region optgroup").length > 1);
  const catalogShape = await page.locator("#catalog-region").evaluate((select) => ({
    groups: select.querySelectorAll("optgroup").length,
    options: select.querySelectorAll("option").length,
    overflow: select.scrollWidth > select.clientWidth
  }));
  if (catalogShape.groups < 2 || catalogShape.options <= 100) failures.push("catalog did not expose the complete grouped regional list");
  if (catalogShape.overflow) failures.push("catalog chooser overflowed its available width");

  await page.locator("#catalog-search").fill("morocco");
  await page.waitForFunction(() => [...document.querySelectorAll("#catalog-region option")].some(({ value }) => value === "morocco"));
  if (await page.locator('#catalog-region optgroup[label="Africa"] option[value="morocco"]').count() !== 1) failures.push("worldwide search did not keep Morocco in its geographic category");

  await page.locator("#catalog-search").fill("florida");
  await page.waitForFunction(() => [...document.querySelectorAll("#catalog-region option")].some(({ value }) => value === "us/florida"));
  await page.locator("#catalog-region").selectOption("us/florida");
  if (await page.locator("#map-name").inputValue() !== "Florida" || await page.locator("#map-id").inputValue() !== "florida") failures.push("catalog selection did not suggest a name and safe ID");

  await page.locator("#map-source-type").selectOption("upload");
  if (!await page.locator("#upload-fields").isVisible() || await page.locator("#catalog-fields").isVisible()) failures.push("source chooser did not reveal only the upload workflow");
  await page.locator("#map-source-type").selectOption("url");
  await page.locator("#map-source-url").fill("https://example.test/unsafe.osm.pbf");
  await page.locator("#map-name").fill("Unsafe Source");
  await page.locator("#map-id").fill("unsafe-source");
  await page.locator("#map-create-form button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("#manager-status")?.textContent.includes("not allowed"));

  const florida = page.locator(".map-row").filter({ hasText: "florida" }).first();
  page.once("dialog", (dialog) => dialog.accept("Florida UI Test"));
  await florida.locator(".rename").click();
  await page.waitForFunction(() => [...document.querySelectorAll('#region-select option')].some((option) => option.value === "florida" && option.textContent === "Florida UI Test"));
  page.once("dialog", (dialog) => dialog.accept("Florida"));
  await page.locator(".map-row").filter({ hasText: "florida" }).first().locator(".rename").click();
  await page.waitForFunction(() => [...document.querySelectorAll('#region-select option')].some((option) => option.value === "florida" && option.textContent === "Florida"));

  const restored = page.locator(".map-row").filter({ hasText: "florida" }).first();
  await restored.locator(".delete").click();
  await restored.locator(".delete-confirm input").fill("wrong-id");
  await restored.locator(".confirm-delete").click();
  await page.waitForFunction(() => document.querySelector("#manager-status")?.textContent.includes("confirmation"));
  if (await page.locator(".map-row").filter({ hasText: "florida" }).count() !== 1) failures.push("incorrect delete confirmation changed the map library");

  await page.screenshot({ path: new URL("map-manager.png", outputDirectory).pathname, fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.locator("#map-manager").boundingBox();
  if (!bounds || bounds.width > 390 || bounds.height > 844) failures.push("map manager did not fit the mobile viewport");

  if (smokePbf) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator("#map-source-type").selectOption("upload");
    await page.locator("#map-upload").setInputFiles(smokePbf);
    await page.locator("#map-name").fill("CRUD Smoke");
    await page.locator("#map-id").fill("crud-smoke");
    await page.locator("#map-create-form button[type=submit]").click();
    await page.waitForFunction(() => document.querySelector("#manager-status")?.textContent.includes("Map build queued"));
    await page.waitForFunction(async () => {
      const { jobs } = await fetch("/api/maps").then((response) => response.json());
      return jobs.some(({ regionId }) => regionId === "crud-smoke");
    });
    await page.waitForFunction(async () => {
      const { jobs } = await fetch("/api/maps").then((response) => response.json());
      return ["complete", "failed"].includes(jobs.find(({ regionId }) => regionId === "crud-smoke")?.status);
    }, null, { timeout: 10 * 60 * 1000 });
    const smokeJob = await page.evaluate(() => fetch("/api/maps").then((response) => response.json()).then(({ jobs }) => jobs.find(({ regionId }) => regionId === "crud-smoke")));
    if (!smokeJob) throw new Error("CRUD smoke job disappeared before its result could be verified");
    if (smokeJob.status === "failed") throw new Error(`CRUD smoke build failed: ${smokeJob.error}`);
    await page.waitForFunction(() => [...document.querySelectorAll('#region-select option')].some(({ value }) => value === "crud-smoke"));
    await page.locator(".map-row").filter({ hasText: "crud-smoke" }).first().locator(".rebuild").click();
    await page.waitForFunction(async () => {
      const { jobs } = await fetch("/api/maps").then((response) => response.json());
      const smokeJobs = jobs.filter(({ regionId }) => regionId === "crud-smoke");
      return smokeJobs.length === 2 && ["complete", "failed"].includes(smokeJobs.at(-1).status);
    }, null, { timeout: 10 * 60 * 1000 });
    const rebuildJob = await page.evaluate(() => fetch("/api/maps").then((response) => response.json()).then(({ jobs }) => jobs.filter(({ regionId }) => regionId === "crud-smoke").at(-1)));
    if (rebuildJob.status === "failed") throw new Error(`CRUD smoke rebuild failed: ${rebuildJob.error}`);
    const smoke = page.locator(".map-row").filter({ hasText: "crud-smoke" }).first();
    await smoke.locator(".delete").click();
    await smoke.locator(".delete-confirm input").fill("crud-smoke");
    await smoke.locator(".confirm-delete").click();
    await page.waitForFunction(() => ![...document.querySelectorAll('#region-select option')].some(({ value }) => value === "crud-smoke"));
  }
} finally {
  const state = await fetch(`${baseUrl}/api/maps`).then((response) => response.json()).catch(() => ({ maps: [] }));
  if (state.maps.some(({ id, name }) => id === "florida" && name !== "Florida")) {
    await fetch(`${baseUrl}/api/maps/florida`, { method: "PATCH", body: JSON.stringify({ name: "Florida" }) });
  }
  if (state.maps.some(({ id }) => id === "crud-smoke")) {
    await fetch(`${baseUrl}/api/maps/crud-smoke?confirm=crud-smoke`, { method: "DELETE" });
  }
  await browser.close();
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL ${failure}`).join("\n"));
  process.exit(1);
}
console.log("PASS map CRUD dialog, runtime rename, guarded delete, and mobile layout");
