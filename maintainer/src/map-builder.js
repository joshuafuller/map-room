import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ProgressTracker } from "./progress.js";

export function createMapBuilder({ dataDirectory, fetchImpl = fetch, spawnImpl = spawn }) {
  return async function buildMap({ id, source, output, onProgress = () => {} }) {
    const sources = path.join(dataDirectory, "sources");
    await mkdir(sources, { recursive: true });
    const durableSource = path.join(sources, `${id}.osm.pbf`);
    if (source.url) {
      const response = await fetchImpl(source.url, { headers: { accept: "application/octet-stream" } });
      if (!response.ok || !response.body) throw new Error(`Map source returned HTTP ${response.status}`);
      const download = `${durableSource}.download`;
      const totalBytes = Number(response.headers.get("content-length")) || null;
      const tracker = new ProgressTracker();
      let completedBytes = 0;
      const stream = Readable.fromWeb(response.body).map((chunk) => {
        completedBytes += chunk.length;
        onProgress({ phase: "downloading", progress: tracker.update({ completedBytes, totalBytes }) });
        return chunk;
      });
      try {
        await pipeline(stream, createWriteStream(download));
        await rename(download, durableSource);
      } finally {
        await rm(download, { force: true });
      }
    } else if (!source.file) {
      throw new Error("Map source is not reusable");
    }
    const input = source.file ? path.join(dataDirectory, source.file) : durableSource;
    const temporaryDirectory = path.join(dataDirectory, ".map-room-work", id);
    await mkdir(temporaryDirectory, { recursive: true });
    onProgress({ phase: "building", progress: null });
    try {
      await new Promise((resolve, reject) => {
        const child = spawnImpl("/opt/java/openjdk/bin/java", [
          "-cp", "@/app/jib-classpath-file", "com.onthegomap.planetiler.Main",
          "--download", `--osm-path=${input}`, `--output=${output}`,
          `--download-dir=${sources}`, `--tmpdir=${temporaryDirectory}`, "--force"
        ], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, JAVA_TOOL_OPTIONS: `-Xmx${process.env.MAP_ROOM_BUILD_MEMORY ?? "2g"}` } });
        let errorText = "";
        child.stderr.on("data", (chunk) => { errorText = `${errorText}${chunk}`.slice(-4000); });
        child.once("error", reject);
        child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Planetiler failed (${code}): ${errorText.trim()}`)));
      });
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  };
}
