import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createMapBuilder } from "../src/map-builder.js";

const missing = async (file) => access(file).then(() => false, () => true);

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
