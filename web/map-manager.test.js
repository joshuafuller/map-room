import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogResultGroups,
  catalogShortcutRegions,
  describeSource,
  escapeHtml,
  formatBytes,
  groupCatalogRegions,
  jobPhaseSteps,
  jobPresentation,
  moveCatalogFocus,
  retryAction,
  slug
} from "./map-manager.js";

test("formats map sizes for the management UI", () => {
  assert.equal(formatBytes(null), "Size unavailable");
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(20 * 1024 ** 2), "20 MB");
});

test("creates safe stable ID suggestions and escapes job text", () => {
  assert.equal(slug("  Rhode Island Ops! "), "rhode-island-ops");
  assert.equal(slug("Québec"), "quebec");
  assert.equal(escapeHtml(`<img src=x onerror="bad"> & 'oops'`), "&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; &#39;oops&#39;");
});

test("describes catalog, uploaded, HTTPS, and legacy map sources", () => {
  assert.equal(describeSource({ type: "catalog", catalogId: "us/florida" }), "Catalog · us/florida");
  assert.equal(describeSource({ type: "upload", file: "sources/local.osm.pbf" }), "Uploaded PBF");
  assert.equal(describeSource({ type: "url", url: "https://download.geofabrik.de/north-america/us/florida-latest.osm.pbf" }), "HTTPS · download.geofabrik.de");
  assert.equal(describeSource(null), "Source unavailable");
});

test("explains every map job phase and keeps elapsed time visible", () => {
  const now = Date.parse("2026-08-05T22:20:30Z");
  const base = { status: "running", startedAt: "2026-08-05T22:20:00Z" };

  assert.deepEqual(jobPresentation({ status: "queued", phase: "queued", createdAt: "2026-08-05T22:20:00Z" }, now), {
    title: "Waiting for another map",
    detail: "Queued — the current map build must finish first",
    elapsed: "30s elapsed",
    error: null
  });
  assert.equal(jobPresentation({ ...base, phase: "downloading", progress: { completedBytes: 50, totalBytes: 100, percent: 50, bytesPerSecond: 10, etaSeconds: 5 } }, now).detail, "Downloading source · 50% · 50 B of 100 B · 10 B/s · about 5s left");
  assert.equal(jobPresentation({ ...base, phase: "building" }, now).detail, "Generating vector tiles with Planetiler — still working");
  assert.equal(jobPresentation({ ...base, phase: "configuring" }, now).detail, "Inspecting the completed map archive");
  assert.equal(jobPresentation({ ...base, phase: "activating" }, now).detail, "Publishing the map and refreshing the tile service");
  assert.equal(jobPresentation({ ...base, status: "complete", phase: "complete", completedAt: "2026-08-05T22:20:25Z" }, now).elapsed, "Completed in 25s");
});

test("maps queued, active, failed, and complete jobs onto an accessible phase path", () => {
  assert.deepEqual(jobPhaseSteps({ status: "queued", phase: "queued" }).map(({ state }) => state), ["future", "future", "future", "future"]);
  assert.deepEqual(jobPhaseSteps({ status: "running", phase: "building" }).map(({ state }) => state), ["complete", "current", "future", "future"]);
  assert.deepEqual(jobPhaseSteps({ status: "failed", phase: "failed", lastPhase: "configuring" }).map(({ state }) => state), ["complete", "complete", "failed", "future"]);
  assert.deepEqual(jobPhaseSteps({ status: "complete", phase: "complete" }).map(({ state }) => state), ["complete", "complete", "complete", "complete"]);
  assert.deepEqual(jobPhaseSteps({ phase: "activating" }).map(({ label }) => label), ["Acquire", "Tiles", "Check", "Publish"]);
});

test("groups worldwide catalog results without changing provider identities", () => {
  const groups = groupCatalogRegions([
    { id: "africa/morocco", name: "Morocco", group: "Africa" },
    { id: "north-america/us/florida", name: "Florida", group: "North America / US" },
    { id: "europe/germany", name: "Germany", group: "Europe" },
    { id: "europe/france", name: "France", group: "Europe" }
  ]);

  assert.deepEqual(groups.map(({ label, regions }) => [label, regions.map(({ id }) => id)]), [
    ["Africa", ["africa/morocco"]],
    ["Europe", ["europe/france", "europe/germany"]],
    ["North America / US", ["north-america/us/florida"]]
  ]);
});

test("keeps search results grouped and bounded without hiding the result count", () => {
  const regions = Array.from({ length: 75 }, (_, index) => ({
    id: `us/region-${index}`,
    name: `Region ${index}`,
    group: index < 50 ? "North America / US" : "Europe"
  }));
  const result = catalogResultGroups(regions, 40);

  assert.equal(result.total, 75);
  assert.equal(result.visible, 40);
  assert.equal(result.truncated, true);
  assert.equal(result.groups.reduce((count, group) => count + group.regions.length, 0), 40);
});

test("puts installed and recent regions first without duplicate provider IDs", () => {
  const shortcuts = catalogShortcutRegions([
    { name: "Florida Ops", source: { catalogId: "us/florida" } },
    { name: "Uploaded", source: { type: "upload" } }
  ], [
    { id: "us/florida", name: "Florida", group: "North America / US" },
    { id: "europe/germany", name: "Germany", group: "Europe" }
  ]);

  assert.deepEqual(shortcuts, [
    { id: "us/florida", name: "Florida Ops", group: "Installed maps", installed: true },
    { id: "europe/germany", name: "Germany", group: "Recent regions" }
  ]);
});

test("moves keyboard focus through search results without escaping the list", () => {
  assert.equal(moveCatalogFocus(-1, 1, 3), 0);
  assert.equal(moveCatalogFocus(0, 1, 3), 1);
  assert.equal(moveCatalogFocus(2, 1, 3), 0);
  assert.equal(moveCatalogFocus(0, -1, 3), 2);
  assert.equal(moveCatalogFocus(0, 1, 0), -1);
});

test("turns Planetiler heap failures into actionable guidance", () => {
  const presentation = jobPresentation({
    status: "failed",
    phase: "failed",
    startedAt: "2026-08-05T22:20:00Z",
    completedAt: "2026-08-05T22:21:00Z",
    error: "java.lang.OutOfMemoryError: Java heap space"
  }, Date.parse("2026-08-05T22:21:30Z"));

  assert.equal(presentation.detail, "Map build failed");
  assert.match(presentation.error, /Retry with 4 GB/);
  assert.doesNotMatch(presentation.error, /java\.lang/);
  assert.deepEqual(retryAction({ status: "failed", error: "OutOfMemoryError", type: "create" }), { label: "Retry with 4 GB", buildMemory: "4g" });
  assert.deepEqual(retryAction({ status: "failed", error: "Java heap space", type: "rebuild", buildMemory: "16g" }), { label: "Retry with 16 GB", buildMemory: "16g" });
  assert.deepEqual(retryAction({ status: "failed", error: "network lost", type: "create" }), { label: "Retry build", buildMemory: null });
  assert.equal(retryAction({ status: "complete", type: "create" }), null);
});
