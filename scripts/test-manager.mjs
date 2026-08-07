import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:8088";
const outputDirectory = new URL("../data/browser-test/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const failures = [];
const smokePbf = process.env.MAP_ROOM_BUILD_SMOKE_PBF;
let initialMaps = [];

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#manage-maps").click();
  await page.locator("#map-manager").waitFor({ state: "visible" });
  if (!await page.locator(".manager-warning").getByText("Trusted local network only").isVisible()) failures.push("manager did not disclose the unauthenticated trusted-network boundary");
  if (!await page.locator("#manager-library-view").isVisible() || await page.locator("#manager-create-view").isVisible()) failures.push("manager did not open on the map library");
  if (await page.locator("#manager-library-view").evaluate((view) => view.querySelector("#installed-maps").compareDocumentPosition(view.querySelector("#map-jobs")) !== Node.DOCUMENT_POSITION_FOLLOWING)) failures.push("library did not lead with installed maps ahead of build activity");
  if (await page.locator(".job-row").count() === 0 && await page.locator("#jobs-section").isVisible()) failures.push("idle library still showed an empty build activity section");
  const libraryHeadings = (await page.locator("#manager-library-view h3").allTextContents()).join(" | ");
  if (libraryHeadings !== "Installed maps | Build activity") failures.push(`library restated its own title instead of naming only its sections: ${libraryHeadings}`);
  await page.locator("#manager-add-map").click();
  if (!await page.locator("#manager-create-view").isVisible() || await page.locator("#manager-library-view").isVisible()) failures.push("Add map did not open a dedicated creation view");
  if (await page.locator("#manager-create-view h3").count() !== 0) failures.push("creation view repeated the dialog title in a section heading");
  if (await page.locator("#manager-title").textContent() !== "Create map") failures.push("dialog title did not name the creation view it was showing");
  await page.locator("#catalog-search").focus();
  await page.locator("#catalog-results").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  if (!await page.locator("#manager-create-view").isVisible() || !await page.locator("#catalog-results").isHidden()) failures.push("Escape with the region list open abandoned the creation view instead of only dismissing the list");
  await page.keyboard.press("Escape");
  if (!await page.locator("#map-manager").isVisible() || !await page.locator("#manager-library-view").isVisible()) failures.push("Escape did not return from creation to the library");
  await page.locator("#manager-add-map").click();
  await page.locator("#manager-back").click();
  if (await page.locator("#create-discard").isVisible()) failures.push("an untouched creation form asked to discard work that did not exist");
  if (!await page.locator("#manager-add-map").evaluate((button) => button === document.activeElement)) failures.push("Back to library did not restore focus to Add map");
  await page.locator("#manager-add-map").click();
  const mapState = await page.evaluate(() => fetch("/api/maps").then((response) => response.json()));
  initialMaps = mapState.maps;
  if (await page.locator(".map-row").count() !== mapState.maps.length) failures.push("manager did not list every installed map");

  if (await page.locator("#catalog-region").getAttribute("type") !== "hidden" ||
      await page.locator("#catalog-search").getAttribute("role") !== "combobox") {
    failures.push("catalog did not use a search-first combobox with a hidden provider identity");
  }
  if (await page.locator("#catalog-results [role=option]").count() > 40) failures.push("catalog rendered too many shortcut options");

  await page.locator("#catalog-search").fill("no-region-has-this-name");
  await page.waitForFunction(() => document.querySelector("#catalog-summary")?.textContent === "No regions match this search.");
  if (!await page.locator("#catalog-results").isHidden()) failures.push("empty catalog search left a stale result list open");

  await page.route("**/api/catalog?q=catalog-failure", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Catalog fixture unavailable" }) }));
  await page.locator("#catalog-search").fill("catalog-failure");
  await page.waitForFunction(() => document.querySelector("#catalog-summary")?.textContent.includes("could not be loaded"));
  await page.unroute("**/api/catalog?q=catalog-failure");

  await page.locator("#catalog-search").fill("morocco");
  await page.locator('#catalog-results [role="option"][data-region-id="morocco"]').waitFor();
  if (await page.locator('#catalog-results [role="group"][aria-label="Africa"] [data-region-id="morocco"]').count() !== 1) failures.push("worldwide search did not keep Morocco in its geographic category");

  await page.locator("#catalog-search").fill("florida");
  await page.locator('#catalog-results [role="option"][data-region-id="us/florida"]').waitFor();
  await page.locator("#catalog-search").press("ArrowDown");
  await page.locator("#catalog-search").press("Enter");
  if (await page.locator("#map-name").inputValue() !== "Florida" || await page.locator("#map-id").inputValue() !== "florida") failures.push("catalog selection did not suggest a name and safe ID");
  if (await page.locator(".advanced-fields").getAttribute("open") !== null) failures.push("stable ID was not hidden under advanced settings");
  await page.locator(".advanced-fields summary").click();
  await page.locator("#map-id").fill("operator-defined-id");
  await page.locator("#map-name").fill("Operator Map");
  if (await page.locator("#map-id").inputValue() !== "operator-defined-id") failures.push("editing the map name overwrote an advanced stable ID");
  await page.locator("#map-id").fill("operator-map");
  await page.locator(".advanced-fields summary").click();
  await page.locator("#catalog-search").fill("");
  await page.locator("#catalog-search").focus();
  if (await page.locator('#catalog-results [role="group"][aria-label="Recent regions"] [data-region-id="us/florida"]').count() !== 1) failures.push("recently selected region was not easy to reach again");

  await page.locator("#map-source-type").selectOption("upload");
  if (!await page.locator("#upload-fields").isVisible() || await page.locator("#catalog-fields").isVisible()) failures.push("source chooser did not reveal only the upload workflow");
  await page.locator("#map-source-type").selectOption("url");
  await page.locator("#map-source-url").fill("https://example.test/unsafe.osm.pbf");
  await page.locator("#map-name").fill("Unsafe Source");
  if (await page.locator("#map-id").inputValue() !== "unsafe-source") failures.push("map name did not generate the hidden stable ID");
  await page.locator("#map-create-form button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("#create-status")?.textContent.includes("not allowed"));
  if (await page.locator("#manager-status").textContent() !== "") failures.push("a creation failure was reported away from the form it belongs to");

  await page.locator("#manager-back").click();
  if (!await page.locator("#create-discard").isVisible() || !await page.locator("#manager-create-view").isVisible()) failures.push("leaving a filled creation form discarded it without asking");
  await page.locator("#create-keep").click();
  if (await page.locator("#create-discard").isVisible() || await page.locator("#map-name").inputValue() !== "Unsafe Source") failures.push("keep editing did not restore the creation form untouched");
  await page.locator("#manager-back").click();
  await page.locator("#create-discard-confirm").click();
  if (!await page.locator("#manager-library-view").isVisible()) failures.push("discarding the creation form did not return to the library");
  await page.locator("#manager-add-map").click();
  if (await page.locator("#map-name").inputValue() !== "" || await page.locator("#catalog-search").inputValue() !== "" || await page.locator("#catalog-region").inputValue() !== "") failures.push("a discarded creation form was reopened with its old values");
  await page.locator("#manager-back").click();

  const renameTarget = mapState.maps[0];
  if (renameTarget) {
    const changedName = `${renameTarget.name} UI Test`;
    const row = page.locator(".map-row").filter({ hasText: renameTarget.id }).first();
    let dialogs = 0;
    page.on("dialog", (dialog) => { dialogs += 1; dialog.dismiss(); });
    await row.locator(".rename").click();
    const renameInput = row.locator(".rename-input");
    if (!await renameInput.isVisible() || await renameInput.inputValue() !== renameTarget.name) failures.push("rename did not open an in-place editor seeded with the current name");
    await renameInput.fill(changedName);

    // A background library poll must not wipe out an edit in progress.
    await page.route("**/api/maps", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      payload.maps = payload.maps.map((map) => map.id === renameTarget.id ? { ...map, archiveBytes: (map.archiveBytes ?? 0) + 4096 } : map);
      await route.fulfill({ response, json: payload });
    });
    await page.waitForTimeout(2500);
    if (!await renameInput.isVisible() || await renameInput.inputValue() !== changedName) failures.push("a background library refresh discarded the rename in progress");
    await page.unroute("**/api/maps");

    await row.locator(".save-rename").click();
    await page.waitForFunction(({ id, name }) => [...document.querySelectorAll('#region-select option')].some((option) => option.value === id && option.textContent === name), { id: renameTarget.id, name: changedName });
    const renamed = page.locator(".map-row").filter({ hasText: renameTarget.id }).first();
    await renamed.locator(".rename").click();
    await renamed.locator(".rename-input").fill(renameTarget.name);
    await renamed.locator(".save-rename").click();
    await page.waitForFunction(({ id, name }) => [...document.querySelectorAll('#region-select option')].some((option) => option.value === id && option.textContent === name), renameTarget);

    const restored = page.locator(".map-row").filter({ hasText: renameTarget.id }).first();
    await restored.locator(".rename").click();
    await restored.locator(".cancel-rename").click();
    if (await restored.locator(".rename-input").isVisible()) failures.push("canceling a rename left the editor open");
    if (!await restored.locator(".rename").evaluate((button) => button === document.activeElement)) failures.push("canceling a rename did not restore focus to Rename");
    if (dialogs !== 0) failures.push("map management still fell back to a browser dialog");
    page.removeAllListeners("dialog");

    await restored.locator(".delete").click();
    const deleteConfirmation = restored.locator(".delete-confirm");
    if (!(await deleteConfirmation.getByText(`Are you sure you want to delete ${renameTarget.name}?`).isVisible()) ||
        await deleteConfirmation.locator("input").count() !== 0) {
      failures.push("delete confirmation did not name the map without requiring typed input");
    }
    await page.waitForTimeout(2500);
    if (!await deleteConfirmation.isVisible()) failures.push("a background library refresh closed an open delete confirmation");
    await deleteConfirmation.locator(".cancel-delete").click();
    if (await deleteConfirmation.isVisible() ||
        await page.locator(".map-row").filter({ hasText: renameTarget.id }).count() !== 1) {
      failures.push("canceling delete changed the map library or left confirmation open");
    }
  }

  await page.screenshot({ path: new URL("map-manager.png", outputDirectory).pathname, fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.locator("#map-manager").boundingBox();
  if (!bounds || bounds.width > 390 || bounds.height > 844) failures.push("map manager did not fit the mobile viewport");

  if (smokePbf) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator("#manager-add-map").click();
    await page.locator("#map-source-type").selectOption("upload");
    await page.locator("#map-upload").setInputFiles(smokePbf);
    await page.locator("#map-name").fill("CRUD Smoke");
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
    await smoke.locator(".confirm-delete").click();
    await page.waitForFunction(() => ![...document.querySelectorAll('#region-select option')].some(({ value }) => value === "crud-smoke"));
  }
} finally {
  const state = await fetch(`${baseUrl}/api/maps`).then((response) => response.json()).catch(() => ({ maps: [] }));
  for (const original of initialMaps) {
    const current = state.maps.find(({ id }) => id === original.id);
    if (current && current.name !== original.name) {
      await fetch(`${baseUrl}/api/maps/${original.id}`, { method: "PATCH", body: JSON.stringify({ name: original.name }) });
    }
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
