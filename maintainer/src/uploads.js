import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { clientError } from "./request-error.js";

export function createUploadSaver({ dataDirectory, maxBytes = 20 * 1024 ** 3 }) {
  return async (request, { id }) => {
    const length = Number(request.headers["content-length"]);
    if (Number.isFinite(length) && length > maxBytes) throw clientError("Uploaded source is too large");
    const directory = path.join(dataDirectory, "sources");
    const destination = path.join(directory, `${id}.osm.pbf`);
    const temporary = `${destination}.upload`;
    await mkdir(directory, { recursive: true });
    let bytes = 0;
    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) request.destroy(new Error("Uploaded source is too large"));
    });
    try {
      await pipeline(request, createWriteStream(temporary, { flags: "wx" }));
      if (bytes === 0) throw clientError("Uploaded source is empty");
      await rename(temporary, destination);
      return `sources/${id}.osm.pbf`;
    } finally {
      await rm(temporary, { force: true });
    }
  };
}
