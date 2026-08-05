import http from "node:http";
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { createApi } from "./api.js";
import { availableCatalog, fetchCatalog } from "./catalog.js";
import { JobQueue } from "./queue.js";
import { MapLibrary } from "./map-library.js";
import { createMapBuilder } from "./map-builder.js";
import { compileRuntime } from "./runtime-files.js";
import { TileSupervisor } from "./tile-supervisor.js";
import { createUploadSaver } from "./uploads.js";

const dataDirectory = process.env.MAP_ROOM_DATA_DIR ?? "/data/archive";
const styleDirectory = process.env.MAP_ROOM_STYLE_DIR ?? "/data/styles";
const baseConfigPath = process.env.MAP_ROOM_BASE_CONFIG ?? "/opt/map-room/config.json";
const developmentRevision = process.env.MAP_ROOM_DEV_WATCH === "1" ? String(Date.now()) : null;
const supervisor = new TileSupervisor();
let catalogCache = null;
let library;

const catalog = async () => {
  if (!catalogCache) catalogCache = availableCatalog(await fetchCatalog());
  return catalogCache;
};

const inspectArchive = async ({ name, archive }) => {
  const output = `${archive}.manifest.json`;
  try {
    await new Promise((resolve, reject) => {
      const child = spawn("python3", ["/opt/map-room/scripts/write-manifest.py", archive, output, name], { stdio: "inherit" });
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Archive inspection failed (${code})`)));
    });
    return JSON.parse(await readFile(output, "utf8"));
  } finally {
    await rm(output, { force: true });
  }
};

const applyRuntime = async () => {
  const result = await compileRuntime({ dataDirectory, styleDirectory, baseConfigPath, defaultRegion: process.env.MAP_ROOM_DEFAULT_REGION ?? null });
  await supervisor.restart(result.regions.length > 0);
};

const queue = new JobQueue({ worker: async (job, update) => {
  const onProgress = (state) => update(state);
  if (job.type === "create") await library.create({ id: job.regionId, name: job.name, source: job.source, onProgress });
  else if (job.type === "rebuild") await library.rebuild(job.regionId, { onProgress });
  else throw new Error(`Unsupported job type: ${job.type}`);
} });

library = new MapLibrary({
  dataDirectory,
  applyRuntime,
  buildMap: createMapBuilder({ dataDirectory }),
  inspectArchive
});
const api = createApi({
  library,
  queue,
  catalog,
  saveUpload: createUploadSaver({ dataDirectory, maxBytes: Number(process.env.MAP_ROOM_MAX_UPLOAD_BYTES) || 20 * 1024 ** 3 }),
  loadTileJson: async (id) => {
    const response = await fetch(`http://127.0.0.1:8081/data/${encodeURIComponent(id)}.json`);
    if (!response.ok) throw new Error(`TileJSON for map '${id}' is unavailable`);
    return response.json();
  },
  allowedSourceHosts: (process.env.MAP_ROOM_SOURCE_HOSTS ?? "download.geofabrik.de").split(",").map((value) => value.trim()).filter(Boolean)
});

function proxy(request, response) {
  const upstream = http.request({ hostname: "127.0.0.1", port: 8081, path: request.url, method: request.method, headers: request.headers }, (result) => {
    response.writeHead(result.statusCode, result.headers);
    result.pipe(response);
  });
  upstream.on("error", () => {
    response.writeHead(503, { "content-type": "application/json" });
    response.end('{"error":"No map tile service is currently available"}\n');
  });
  request.pipe(upstream);
}

await applyRuntime();
const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    return response.end("ok\n");
  }
  if (request.url === "/api/dev/revision" && developmentRevision) {
    response.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
    return response.end(`${developmentRevision}\n`);
  }
  if (request.url.startsWith("/api/")) return api(request, response);
  return proxy(request, response);
});
server.listen(8080, "0.0.0.0", () => console.log("Map Room manager listening on port 8080"));

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => {
  server.close();
  await supervisor.stop();
  process.exit(0);
});
