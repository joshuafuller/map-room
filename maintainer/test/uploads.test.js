import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createUploadSaver } from "../src/uploads.js";

const request = (chunks, length = null) => Object.assign(Readable.from(chunks), { headers: length === null ? {} : { "content-length": String(length) } });

test("streams a bounded upload into the managed source directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "map-room-upload-"));
  const save = createUploadSaver({ dataDirectory: root, maxBytes: 20 });
  assert.equal(await save(request([Buffer.from("osm"), Buffer.from(" data")], 8), { id: "florida" }), "sources/florida.osm.pbf");
  assert.equal(await readFile(join(root, "sources/florida.osm.pbf"), "utf8"), "osm data");
});

test("rejects empty, declared-oversize, and streamed-oversize uploads", async () => {
  const root = await mkdtemp(join(tmpdir(), "map-room-upload-"));
  const save = createUploadSaver({ dataDirectory: root, maxBytes: 3 });
  await assert.rejects(() => save(request([], 0), { id: "empty" }), /empty/);
  await assert.rejects(() => save(request([Buffer.from("data")], 4), { id: "large" }), /too large/);
  await assert.rejects(() => save(request([Buffer.from("data")]), { id: "streamed" }), /too large/);
});
