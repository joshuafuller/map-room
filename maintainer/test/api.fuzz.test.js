import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fc from "fast-check";
import { createApi } from "../src/api.js";

async function serve(api, run) {
  const server = http.createServer(api);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function fixture() {
  const library = {
    list: async () => [{ id: "florida", name: "Florida" }],
    update: async (id, input) => ({ id, name: input.name }),
    delete: async () => {}
  };
  const queue = {
    snapshot: () => [],
    enqueue: (input) => ({ id: "job-1", ...input, status: "queued" }),
    retry: (id, options) => ({ id: "job-retry", status: "queued", buildMemory: options.buildMemory })
  };
  const catalog = async () => [{ id: "us/florida", name: "Florida", searchText: "florida", pbfUrl: "https://download.geofabrik.de/florida.osm.pbf" }];
  const saveUpload = async (request, identity) => { for await (const _chunk of request) {} return `sources/${identity.id}.osm.pbf`; };
  const loadTileJson = async (id) => ({ id, format: "pbf", minzoom: 0, maxzoom: 14, bounds: [0, 0, 1, 1], vector_layers: [] });
  return createApi({ library, queue, catalog, saveUpload, loadTileJson });
}

// A trusted-network admin API still must not answer client mistakes with a
// server fault, and must never let a request body reach Object.prototype.
const hostileNames = [
  "__proto__", "constructor", "prototype", "toString", "valueOf",
  "../../etc/passwd", "florida/../../secret", "..%2f..%2f",
  "<script>alert(1)</script>", "'; DROP TABLE maps; --",
  "a".repeat(300), "a".repeat(5000), "", " ", "\n\r\t"
];

// Lone surrogates go only into request bodies: encodeURIComponent refuses
// them, so no client could put one in a URL in the first place.
const hostileText = fc.oneof(fc.string({ maxLength: 60 }), fc.constantFrom(...hostileNames));
const hostileBodyText = fc.oneof(hostileText, fc.constant("\uD800"));

const hostileValue = fc.oneof(
  hostileBodyText, fc.integer(), fc.double(), fc.boolean(), fc.constant(null),
  fc.array(hostileBodyText, { maxLength: 4 }),
  fc.dictionary(hostileBodyText, hostileBodyText, { maxKeys: 4 })
);

const post = (base, path, body, headers = { "content-type": "application/json" }) =>
  fetch(`${base}${path}`, { method: "POST", headers, body });

const assertClientFault = async (response, label) => {
  assert.ok(response.status < 500, `${label} answered a client input with ${response.status}`);
  const text = await response.text();
  assert.doesNotThrow(() => JSON.parse(text), `${label} returned a non-JSON body: ${text.slice(0, 120)}`);
};

test("hostile creation bodies never fault the server", async () => {
  const api = fixture();
  await serve(api, async (base) => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        id: hostileValue, name: hostileValue, sourceType: hostileValue,
        catalogId: hostileValue, url: hostileValue
      }, { requiredKeys: [] }),
      async (body) => {
        await assertClientFault(await post(base, "/api/maps", JSON.stringify(body)), `POST /api/maps ${JSON.stringify(body).slice(0, 80)}`);
      }
    ), { numRuns: 120 });
  });
});

test("malformed request bodies are refused as client errors, not server faults", async () => {
  const api = fixture();
  await serve(api, async (base) => {
    const malformed = ["", "{", "null", "[]", "\"text\"", "{\"id\":}", "undefined", "\u0000", "{'id':'x'}"];
    for (const body of malformed) {
      await assertClientFault(await post(base, "/api/maps", body), `POST /api/maps with body ${JSON.stringify(body)}`);
      await assertClientFault(await fetch(`${base}/api/maps/florida`, { method: "PATCH", headers: { "content-type": "application/json" }, body }), `PATCH with body ${JSON.stringify(body)}`);
      await assertClientFault(await post(base, "/api/jobs/job-1/retry", body), `retry with body ${JSON.stringify(body)}`);
    }
  });
});

test("a request body cannot reach Object.prototype", async () => {
  const api = fixture();
  const pollutionAttempts = [
    '{"__proto__":{"polluted":"yes"}}',
    '{"constructor":{"prototype":{"polluted":"yes"}}}',
    '{"name":{"__proto__":{"polluted":"yes"}}}',
    '{"id":"florida","name":"ok","__proto__":{"canRebuild":true}}',
    '{"__proto__":{"toString":"broken"}}'
  ];
  await serve(api, async (base) => {
    for (const body of pollutionAttempts) {
      for (const path of ["/api/maps", "/api/jobs/job-1/retry"]) await post(base, path, body);
      await fetch(`${base}/api/maps/florida`, { method: "PATCH", headers: { "content-type": "application/json" }, body });
    }
  });
  assert.equal({}.polluted, undefined, "a request body polluted Object.prototype");
  assert.equal({}.canRebuild, undefined, "a request body polluted Object.prototype");
  assert.equal(typeof {}.toString, "function", "a request body replaced Object.prototype.toString");
});

test("hostile paths and query strings never fault the server", async () => {
  const api = fixture();
  await serve(api, async (base) => {
    await fc.assert(fc.asyncProperty(hostileText, async (value) => {
      const encoded = encodeURIComponent(value);
      await assertClientFault(await fetch(`${base}/api/catalog?q=${encoded}`), `GET /api/catalog?q=${encoded.slice(0, 60)}`);
      await assertClientFault(await fetch(`${base}/api/maps/${encoded}`, { method: "DELETE" }), `DELETE /api/maps/${encoded.slice(0, 60)}`);
      await assertClientFault(await fetch(`${base}/api/maps/${encoded}/rebuild`, { method: "POST" }), `rebuild ${encoded.slice(0, 60)}`);
    }), { numRuns: 80 });
  });
});

test("hostile upload identities never fault the server", async () => {
  const api = fixture();
  await serve(api, async (base) => {
    await fc.assert(fc.asyncProperty(hostileText, hostileText, async (id, name) => {
      const path = `/api/maps/import?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;
      await assertClientFault(
        await post(base, path, "not a real pbf", { "content-type": "application/octet-stream" }),
        `import ${path.slice(0, 80)}`
      );
    }), { numRuns: 60 });
  });
});

test("map IDs are bounded before they become filenames", async () => {
  const { validateMapIdentity } = await import("../src/map-library.js");
  assert.throws(() => validateMapIdentity("a".repeat(300), "Long"), /1 to 64|lowercase slug/,
    "an ID too long to be a filename passed validation and would fail later as a server fault");
  assert.doesNotThrow(() => validateMapIdentity("a".repeat(64), "Bounded"));
});

test("the API keeps serving after a fuzzing run", async () => {
  const api = fixture();
  await serve(api, async (base) => {
    for (const body of ['{"__proto__":{"x":1}}', "{", '{"id":"' + "a".repeat(5000) + '"}']) await post(base, "/api/maps", body);
    const healthy = await fetch(`${base}/api/maps`);
    assert.equal(healthy.status, 200);
    assert.deepEqual((await healthy.json()).maps, [{ id: "florida", name: "Florida" }]);
  });
});
