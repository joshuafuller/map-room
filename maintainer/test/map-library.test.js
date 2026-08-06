import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MapLibrary } from "../src/map-library.js";

const manifest = (name, archive = "florida.mbtiles") => ({
  region: name,
  archive,
  archiveBytes: 12,
  bounds: [-88, 24, -77, 31],
  center: [-82, 27, 6],
  displayCenter: [-82, 27],
  displayZoom: 6,
  minZoom: 0,
  maxZoom: 14,
  generatedAt: "2026-08-05T00:00:00Z"
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "map-room-library-"));
  const regions = join(root, "regions");
  const sources = join(root, "sources");
  const runtimeCalls = [];
  const library = new MapLibrary({
    dataDirectory: root,
    applyRuntime: async () => runtimeCalls.push("applied"),
    buildMap: async ({ output }) => writeFile(output, "new archive"),
    inspectArchive: async ({ name, archive }) => manifest(name, archive.split("/").at(-1))
  });
  return { root, regions, sources, runtimeCalls, library };
}

test("reads installed maps without exposing filesystem paths", async () => {
  const { root, regions, library } = await fixture();
  await import("node:fs/promises").then(({ mkdir }) => mkdir(regions, { recursive: true }));
  await writeFile(join(root, "florida.mbtiles"), "archive");
  await writeFile(join(regions, "florida.json"), JSON.stringify({ ...manifest("Florida"), source: { type: "catalog", catalogId: "us/florida" } }));

  assert.deepEqual(await library.list(), [{
    id: "florida",
    name: "Florida",
    archiveBytes: 12,
    bounds: [-88, 24, -77, 31],
    generatedAt: "2026-08-05T00:00:00Z",
    source: { type: "catalog", catalogId: "us/florida" },
    canRebuild: true
  }]);
});

test("creates a map atomically and applies the new runtime", async () => {
  const { root, regions, runtimeCalls, library } = await fixture();

  await library.create({ id: "florida", name: "Florida", source: { type: "catalog", catalogId: "us/florida", url: "https://example.test/florida.osm.pbf" } });

  assert.equal(await readFile(join(root, "florida.mbtiles"), "utf8"), "new archive");
  assert.equal(JSON.parse(await readFile(join(regions, "florida.json"), "utf8")).source.catalogId, "us/florida");
  assert.deepEqual(runtimeCalls, ["applied"]);
});

test("failed rebuild preserves the published archive and manifest", async () => {
  const { root, regions, library } = await fixture();
  await import("node:fs/promises").then(({ mkdir }) => mkdir(regions, { recursive: true }));
  await writeFile(join(root, "florida.mbtiles"), "working archive");
  await writeFile(join(regions, "florida.json"), JSON.stringify({ ...manifest("Florida"), source: { type: "url", url: "https://example.test/florida.osm.pbf" } }));
  library.buildMap = async () => { throw new Error("build failed"); };

  await assert.rejects(() => library.rebuild("florida"), /build failed/);
  assert.equal(await readFile(join(root, "florida.mbtiles"), "utf8"), "working archive");
  assert.equal(JSON.parse(await readFile(join(regions, "florida.json"), "utf8")).region, "Florida");
});

test("failed runtime activation rolls back a replacement archive and metadata", async () => {
  const { root, regions, library } = await fixture();
  await import("node:fs/promises").then(({ mkdir }) => mkdir(regions, { recursive: true }));
  await writeFile(join(root, "florida.mbtiles"), "working archive");
  await writeFile(join(regions, "florida.json"), JSON.stringify({ ...manifest("Florida"), source: { type: "url", url: "https://example.test/florida.osm.pbf" } }));
  let calls = 0;
  library.applyRuntime = async () => {
    calls += 1;
    if (calls === 1) throw new Error("activation failed");
  };

  await assert.rejects(() => library.rebuild("florida"), /activation failed/);
  assert.equal(await readFile(join(root, "florida.mbtiles"), "utf8"), "working archive");
  assert.equal(JSON.parse(await readFile(join(regions, "florida.json"), "utf8")).generatedAt, "2026-08-05T00:00:00Z");
  assert.equal(calls, 2);
});

test("failed first-map activation removes unpublished output but retains its managed source", async () => {
  const { root, sources, library } = await fixture();
  await import("node:fs/promises").then(({ mkdir }) => mkdir(sources, { recursive: true }));
  await writeFile(join(sources, "florida.osm.pbf"), "source");
  await writeFile(join(sources, "florida.osm.pbf.json"), "source metadata");
  library.applyRuntime = async () => { throw new Error("activation failed"); };

  await assert.rejects(() => library.create({ id: "florida", name: "Florida", source: { type: "catalog", catalogId: "us/florida" } }), /activation failed/);
  assert.deepEqual(await library.list(), []);
  await assert.rejects(() => readFile(join(root, "florida.mbtiles")), /ENOENT/);
  assert.equal(await readFile(join(sources, "florida.osm.pbf"), "utf8"), "source");
  assert.equal(await readFile(join(sources, "florida.osm.pbf.json"), "utf8"), "source metadata");
});

test("retained uploaded sources can rebuild and report the configuration phase", async () => {
  const { root, regions, sources, library } = await fixture();
  await import("node:fs/promises").then(({ mkdir }) => Promise.all([mkdir(regions, { recursive: true }), mkdir(sources, { recursive: true })]));
  await writeFile(join(root, "local.mbtiles"), "working archive");
  await writeFile(join(sources, "local.osm.pbf"), "source");
  await writeFile(join(regions, "local.json"), JSON.stringify({ ...manifest("Local", "local.mbtiles"), source: { type: "upload", file: "sources/local.osm.pbf" } }));
  const phases = [];

  await library.rebuild("local", { onProgress: ({ phase }) => phases.push(phase) });

  assert.equal((await library.list())[0].canRebuild, true);
  assert.deepEqual(phases, ["configuring", "activating"]);
});

test("updates a map name and deletes exactly the confirmed map", async () => {
  const { root, regions, sources, runtimeCalls, library } = await fixture();
  await import("node:fs/promises").then(({ mkdir }) => Promise.all([mkdir(regions, { recursive: true }), mkdir(sources, { recursive: true })]));
  await writeFile(join(root, "florida.mbtiles"), "archive");
  await writeFile(join(sources, "florida.osm.pbf"), "source");
  await writeFile(join(sources, "florida.osm.pbf.json"), "source metadata");
  await writeFile(join(sources, "florida.osm.pbf.download"), "partial");
  await writeFile(join(sources, "florida.osm.pbf.download.json"), "metadata");
  await writeFile(join(regions, "florida.json"), JSON.stringify(manifest("Florida")));

  await library.update("florida", { name: "Florida Ops" });
  assert.equal(JSON.parse(await readFile(join(regions, "florida.json"), "utf8")).region, "Florida Ops");
  await assert.rejects(() => library.delete("florida", { confirmation: "wrong" }), /confirmation/i);
  await library.delete("florida", { confirmation: "florida" });
  assert.deepEqual(await library.list(), []);
  await assert.rejects(() => readFile(join(sources, "florida.osm.pbf")), /ENOENT/);
  await assert.rejects(() => readFile(join(sources, "florida.osm.pbf.json")), /ENOENT/);
  await assert.rejects(() => readFile(join(sources, "florida.osm.pbf.download")), /ENOENT/);
  await assert.rejects(() => readFile(join(sources, "florida.osm.pbf.download.json")), /ENOENT/);
  assert.deepEqual(runtimeCalls, ["applied", "applied"]);
});

test("failed delete activation restores the map archive, manifest, and managed source", async () => {
  const { root, regions, sources, library } = await fixture();
  await import("node:fs/promises").then(({ mkdir }) => Promise.all([mkdir(regions, { recursive: true }), mkdir(sources, { recursive: true })]));
  await writeFile(join(root, "florida.mbtiles"), "archive");
  await writeFile(join(sources, "florida.osm.pbf"), "source");
  await writeFile(join(regions, "florida.json"), JSON.stringify(manifest("Florida")));
  let calls = 0;
  library.applyRuntime = async () => { calls += 1; if (calls === 1) throw new Error("activation failed"); };

  await assert.rejects(() => library.delete("florida", { confirmation: "florida" }), /activation failed/);
  assert.equal(await readFile(join(root, "florida.mbtiles"), "utf8"), "archive");
  assert.equal(await readFile(join(sources, "florida.osm.pbf"), "utf8"), "source");
  assert.equal((await library.list())[0].name, "Florida");
});

test("rejects unsafe IDs, duplicate maps, incomplete updates, and missing maps", async () => {
  const { root, regions, library } = await fixture();
  await assert.rejects(() => library.create({ id: "../bad", name: "Bad", source: {} }), /ID/);
  await assert.rejects(() => library.create({ id: "good", name: "", source: {} }), /name/);
  await import("node:fs/promises").then(({ mkdir }) => mkdir(regions, { recursive: true }));
  await writeFile(join(root, "good.mbtiles"), "archive");
  await writeFile(join(regions, "good.json"), JSON.stringify(manifest("Good", "good.mbtiles")));
  await assert.rejects(() => library.create({ id: "good", name: "Good", source: {} }), /exists/);
  await assert.rejects(() => library.update("good", { name: "" }), /name/);
  await assert.rejects(() => library.update("missing", { name: "Missing" }), /not found/);
  await assert.rejects(() => library.delete("missing", { confirmation: "missing" }), /not found/);
});
