import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createMapBuilder } from "../src/map-builder.js";

const missing = async (file) => access(file).then(() => false, () => true);

function successfulSpawn(invocations) {
  return (command, args, options) => {
    invocations.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    queueMicrotask(() => child.emit("exit", 0));
    return child;
  };
}

test("keeps Planetiler scratch data inside the writable map directory and removes it", async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "map-room-builder-"));
  const input = path.join(dataDirectory, "source.osm.pbf");
  await writeFile(input, "fixture");
  let invocation;
  const spawnImpl = (command, args, options) => {
    invocation = { command, args, options };
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    queueMicrotask(() => child.emit("exit", 0));
    return child;
  };
  const build = createMapBuilder({ dataDirectory, spawnImpl });

  await build({ id: "rhode-island", source: { file: "source.osm.pbf" }, output: path.join(dataDirectory, "output.mbtiles") });

  assert.equal(invocation.command, "/opt/java/openjdk/bin/java");
  assert.ok(invocation.args.includes(`--tmpdir=${path.join(dataDirectory, ".map-room-work", "rhode-island")}`));
  assert.ok(invocation.args.includes(`--download-dir=${path.join(dataDirectory, "sources")}`));
  assert.ok(invocation.args.includes(`--osm-path=${input}`));
  assert.equal(await missing(path.join(dataDirectory, ".map-room-work", "rhode-island")), true);
});

test("reuses a completed managed source and applies per-job build memory", async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "map-room-builder-reuse-"));
  const sources = path.join(dataDirectory, "sources");
  await mkdir(sources);
  await writeFile(path.join(sources, "us-south.osm.pbf"), "verified source");
  const invocations = [];
  const progress = [];
  const build = createMapBuilder({
    dataDirectory,
    fetchImpl: async () => { throw new Error("completed source must not be downloaded again"); },
    spawnImpl: successfulSpawn(invocations)
  });

  await build({
    id: "us-south",
    source: { url: "https://download.geofabrik.de/us-south.osm.pbf" },
    output: path.join(dataDirectory, "output.mbtiles"),
    buildMemory: "8g",
    onProgress: (state) => progress.push(state)
  });

  assert.equal(invocations[0].options.env.JAVA_TOOL_OPTIONS, "-Xmx8g");
  assert.equal(progress.some(({ sourceMode }) => sourceMode === "reused"), true);
});

test("resumes a validator-matched partial download and promotes it atomically", async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "map-room-builder-resume-"));
  const sources = path.join(dataDirectory, "sources");
  await mkdir(sources);
  const download = path.join(sources, "region.osm.pbf.download");
  await writeFile(download, "abc");
  await writeFile(`${download}.json`, JSON.stringify({
    url: "https://download.geofabrik.de/region.osm.pbf",
    etag: '"v1"',
    lastModified: null,
    totalBytes: 6
  }));
  const requests = [];
  const progress = [];
  const build = createMapBuilder({
    dataDirectory,
    fetchImpl: async (_url, options) => {
      requests.push(options);
      return new Response("def", { status: 206, headers: {
        "content-length": "3", "content-range": "bytes 3-5/6", etag: '"v1"'
      } });
    },
    spawnImpl: successfulSpawn([])
  });

  await build({ id: "region", source: { url: "https://download.geofabrik.de/region.osm.pbf" }, output: path.join(dataDirectory, "output.mbtiles"), onProgress: (state) => progress.push(state) });

  assert.equal(requests[0].headers.Range, "bytes=3-");
  assert.equal(requests[0].headers["If-Range"], '"v1"');
  assert.equal(await readFile(path.join(sources, "region.osm.pbf"), "utf8"), "abcdef");
  assert.equal(await missing(download), true);
  assert.equal(await missing(`${download}.json`), true);
  assert.equal(progress.some(({ sourceMode }) => sourceMode === "resumed"), true);
});

test("restarts safely when a provider ignores or contradicts the requested range", async () => {
  for (const scenario of ["ignored", "contradicted"]) {
    const dataDirectory = await mkdtemp(path.join(tmpdir(), `map-room-builder-${scenario}-`));
    const sources = path.join(dataDirectory, "sources");
    await mkdir(sources);
    const download = path.join(sources, "region.osm.pbf.download");
    await writeFile(download, "old");
    await writeFile(`${download}.json`, JSON.stringify({ url: "https://download.geofabrik.de/region.osm.pbf", etag: '"old"', totalBytes: 6 }));
    let calls = 0;
    const build = createMapBuilder({
      dataDirectory,
      fetchImpl: async () => {
        calls += 1;
        if (scenario === "ignored") return new Response("fresh", { status: 200, headers: { "content-length": "5", etag: '"new"' } });
        if (calls === 1) return new Response("bad", { status: 206, headers: { "content-length": "3", "content-range": "bytes 4-6/7", etag: '"old"' } });
        return new Response("fresh", { status: 200, headers: { "content-length": "5", etag: '"new"' } });
      },
      spawnImpl: successfulSpawn([])
    });

    await build({ id: "region", source: { url: "https://download.geofabrik.de/region.osm.pbf" }, output: path.join(dataDirectory, "output.mbtiles") });
    assert.equal(await readFile(path.join(sources, "region.osm.pbf"), "utf8"), "fresh");
    assert.equal(calls, scenario === "ignored" ? 1 : 2);
  }
});

test("retains a truncated partial and never starts Planetiler", async () => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "map-room-builder-truncated-"));
  let spawned = false;
  const build = createMapBuilder({
    dataDirectory,
    fetchImpl: async () => new Response("ab", { status: 200, headers: { "content-length": "3", etag: '"v1"' } }),
    spawnImpl: () => { spawned = true; }
  });

  await assert.rejects(
    () => build({ id: "region", source: { url: "https://download.geofabrik.de/region.osm.pbf" }, output: path.join(dataDirectory, "output.mbtiles") }),
    /ended early/
  );
  assert.equal(await readFile(path.join(dataDirectory, "sources", "region.osm.pbf.download"), "utf8"), "ab");
  assert.equal(await missing(path.join(dataDirectory, "sources", "region.osm.pbf.download.json")), false);
  assert.equal(spawned, false);
});
