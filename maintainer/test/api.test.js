import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApi } from "../src/api.js";

async function serve(api, run) {
  const server = http.createServer(api);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function fixture(overrides = {}) {
  const calls = [];
  const jobs = [];
  const library = {
    list: async () => [{ id: "florida", name: "Florida" }],
    update: async (id, input) => (calls.push(["update", id, input]), { id, name: input.name }),
    delete: async (id, input) => { calls.push(["delete", id, input]); },
    ...overrides.library
  };
  const queue = {
    snapshot: () => jobs,
    enqueue: (input) => (calls.push(["enqueue", input]), { id: "job-1", ...input, status: "queued" })
  };
  const catalog = overrides.catalog ?? (async () => [{ id: "us/florida", name: "Florida", searchText: "florida us-fl", pbfUrl: "https://download.geofabrik.de/florida.osm.pbf" }]);
  const saveUpload = async (request, identity) => {
    for await (const _chunk of request) {}
    calls.push(["upload", identity]);
    return `sources/${identity.id}.osm.pbf`;
  };
  const loadTileJson = overrides.loadTileJson ?? (async (id) => ({
    id,
    format: "pbf",
    minzoom: 0,
    maxzoom: 14,
    bounds: [-87.64, 24.4, -80.03, 31.0],
    attribution: "OpenStreetMap contributors",
    vector_layers: [{ id: "transportation" }]
  }));
  return { api: createApi({ library, queue, catalog, saveUpload, loadTileJson }), calls };
}

test("reads installed maps, jobs, and a filtered catalog", async () => {
  const { api } = fixture();
  await serve(api, async (base) => {
    assert.deepEqual(await fetch(`${base}/api/maps`).then((r) => r.json()), { maps: [{ id: "florida", name: "Florida" }], jobs: [] });
    assert.deepEqual((await fetch(`${base}/api/catalog?q=us-fl`).then((r) => r.json())).regions.map(({ id }) => id), ["us/florida"]);
    assert.deepEqual((await fetch(`${base}/api/catalog?q=missing`).then((r) => r.json())).regions, []);
  });
});

test("returns the complete valid catalog instead of truncating grouped browsing", async () => {
  const regions = Array.from({ length: 125 }, (_, index) => ({
    id: `region/${index}`,
    name: `Region ${index}`,
    group: index < 60 ? "Africa" : "Europe",
    searchText: `region ${index}`,
    pbfUrl: `https://download.geofabrik.de/region-${index}.osm.pbf`
  }));
  const { api } = fixture({ catalog: async () => regions });

  await serve(api, async (base) => {
    const payload = await fetch(`${base}/api/catalog`).then((response) => response.json());
    assert.equal(payload.regions.length, 125);
  });
});

test("queues catalog, allow-listed URL, upload, and rebuild jobs", async () => {
  const { api, calls } = fixture();
  await serve(api, async (base) => {
    const post = (value) => fetch(`${base}/api/maps`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
    assert.equal((await post({ id: "florida", name: "Florida", sourceType: "catalog", catalogId: "us/florida" })).status, 202);
    assert.equal((await post({ id: "texas", name: "Texas", sourceType: "url", url: "https://download.geofabrik.de/texas.osm.pbf" })).status, 202);
    assert.equal((await fetch(`${base}/api/maps/import?id=local&name=Local`, { method: "POST", body: "pbf" })).status, 202);
    assert.equal((await fetch(`${base}/api/maps/florida/rebuild`, { method: "POST" })).status, 202);
  });
  assert.equal(calls.filter(([name]) => name === "enqueue").length, 4);
  assert.deepEqual(calls.find(([name]) => name === "upload"), ["upload", { id: "local", name: "Local" }]);
});

test("updates and deletes one validated map", async () => {
  const { api, calls } = fixture();
  await serve(api, async (base) => {
    const updated = await fetch(`${base}/api/maps/florida`, { method: "PATCH", body: JSON.stringify({ name: "Florida Ops" }) });
    assert.equal(updated.status, 200);
    const deleted = await fetch(`${base}/api/maps/florida?confirm=florida`, { method: "DELETE" });
    assert.equal(deleted.status, 200);
  });
  assert.deepEqual(calls.slice(0, 2), [["update", "florida", { name: "Florida Ops" }], ["delete", "florida", { confirmation: "florida" }]]);
});

test("returns structured client errors for unsafe or unknown input", async () => {
  const { api } = fixture({ library: { update: async () => { throw new Error("Map 'missing' not found"); } } });
  await serve(api, async (base) => {
    const cases = [
      fetch(`${base}/api/maps`, { method: "POST", body: JSON.stringify({ id: "bad/id", name: "Bad", sourceType: "url", url: "https://download.geofabrik.de/a.osm.pbf" }) }),
      fetch(`${base}/api/maps`, { method: "POST", body: JSON.stringify({ id: "safe", name: "Safe", sourceType: "url", url: "https://example.test/a.osm.pbf" }) }),
      fetch(`${base}/api/maps`, { method: "POST", body: JSON.stringify({ id: "safe", name: "Safe", sourceType: "other" }) }),
      fetch(`${base}/api/maps/missing`, { method: "PATCH", body: JSON.stringify({ name: "Missing" }) }),
      fetch(`${base}/api/unknown`)
    ];
    const responses = await Promise.all(cases);
    assert.deepEqual(responses.map(({ status }) => status), [400, 400, 400, 400, 404]);
    for (const response of responses) assert.equal(typeof (await response.json()).error, "string");
  });
});

test("serves stable ATAK raster and vector definitions on the requesting origin", async () => {
  const { api } = fixture();
  await serve(api, async (base) => {
    const options = { headers: { "x-forwarded-host": "maps.example.test:8088", "x-forwarded-proto": "https" } };
    const raster = await fetch(`${base}/api/atak/raster/dark-blue.xml`, options);
    assert.equal(raster.status, 200);
    assert.match(raster.headers.get("content-type"), /^application\/xml/);
    assert.match(await raster.text(), /https:\/\/maps\.example\.test:8088\/styles\/all-dark-blue\/\{\$z\}\/\{\$x\}\/\{\$y\}@2x\.png/);

    const vector = await fetch(`${base}/api/atak/vector/florida.json`, options);
    assert.equal(vector.status, 200);
    assert.match(vector.headers.get("content-type"), /^application\/json/);
    const descriptor = await vector.json();
    assert.equal(descriptor.title, "Map Room - Florida");
    assert.equal(descriptor.url, "https://maps.example.test:8088/data/florida/{$z}/{$x}/{$y}.pbf");
  });
});

test("ATAK definition endpoints reject unknown maps, themes, and untrusted forwarding headers", async () => {
  const { api } = fixture();
  await serve(api, async (base) => {
    const statuses = await Promise.all([
      fetch(`${base}/api/atak/raster/missing.xml`),
      fetch(`${base}/api/atak/vector/missing.json`),
      fetch(`${base}/api/atak/raster/daylight.xml`, { headers: { "x-forwarded-proto": "javascript" } })
    ]);
    assert.deepEqual(statuses.map(({ status }) => status), [400, 400, 400]);
  });
});
