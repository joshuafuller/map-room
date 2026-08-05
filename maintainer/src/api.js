import { URL } from "node:url";
import { validateMapIdentity } from "./map-library.js";
import { validateRemoteSourceUrl } from "./source-policy.js";

const json = (response, status, value) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(`${JSON.stringify(value)}\n`);
};

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createApi({ library, queue, catalog, saveUpload, allowedSourceHosts = ["download.geofabrik.de"] }) {
  return async (request, response) => {
    const url = new URL(request.url, "http://map-room.local");
    try {
      if (request.method === "GET" && url.pathname === "/api/maps") {
        return json(response, 200, { maps: await library.list(), jobs: queue.snapshot() });
      }
      if (request.method === "GET" && url.pathname === "/api/catalog") {
        const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        const entries = await catalog();
        return json(response, 200, { regions: entries.filter(({ searchText }) => !query || searchText.includes(query)) });
      }
      if (request.method === "POST" && url.pathname === "/api/maps") {
        const input = await readJson(request);
        const identity = validateMapIdentity(input.id, input.name);
        const source = input.sourceType === "catalog"
          ? (await catalog()).find(({ id }) => id === input.catalogId)
          : null;
        if (input.sourceType === "catalog" && !source) return json(response, 400, { error: "Unknown catalog region" });
        if (!source && input.sourceType !== "url") return json(response, 400, { error: "Unknown source type" });
        const mapSource = source
          ? { type: "catalog", catalogId: source.id, url: source.pbfUrl }
          : { type: "url", url: validateRemoteSourceUrl(input.url, allowedSourceHosts) };
        const job = queue.enqueue({ type: "create", regionId: identity.id, name: identity.name, source: mapSource });
        return json(response, 202, { job });
      }
      if (request.method === "POST" && url.pathname === "/api/maps/import") {
        const identity = validateMapIdentity(url.searchParams.get("id"), url.searchParams.get("name"));
        const file = await saveUpload(request, identity);
        const job = queue.enqueue({ type: "create", regionId: identity.id, name: identity.name, source: { type: "upload", file } });
        return json(response, 202, { job });
      }
      const match = url.pathname.match(/^\/api\/maps\/([a-z0-9-]+)$/);
      if (match && request.method === "PATCH") {
        return json(response, 200, { map: await library.update(match[1], await readJson(request)) });
      }
      if (match && request.method === "DELETE") {
        await library.delete(match[1], { confirmation: url.searchParams.get("confirm") });
        return json(response, 200, { deleted: match[1] });
      }
      const rebuild = url.pathname.match(/^\/api\/maps\/([a-z0-9-]+)\/rebuild$/);
      if (rebuild && request.method === "POST") {
        return json(response, 202, { job: queue.enqueue({ type: "rebuild", regionId: rebuild[1] }) });
      }
      return json(response, 404, { error: "Not found" });
    } catch (error) {
      return json(response, /not found|not allowed|unknown|requires|must|too large|valid HTTPS/i.test(error.message) ? 400 : 500, { error: error.message });
    }
  };
}
