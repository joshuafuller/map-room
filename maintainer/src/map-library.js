import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Every ID becomes a filename, so it must stay well inside the 255-byte limit
// that filesystems impose — otherwise a valid-looking ID fails as ENAMETOOLONG.
const MAX_ID_LENGTH = 64;

function validateId(id) {
  if (typeof id !== "string" || !SAFE_ID.test(id) || id.length > MAX_ID_LENGTH) {
    throw new Error(`Map ID must be a lowercase slug of 1 to ${MAX_ID_LENGTH} characters`);
  }
}

function validateName(name) {
  if (typeof name !== "string" || name.trim() === "" || name.length > 120) throw new Error("Map name must be 1 to 120 characters");
  return name.trim();
}

export function validateMapIdentity(id, name) {
  validateId(id);
  return { id, name: validateName(name) };
}

function publicMap(id, manifest) {
  return {
    id,
    name: manifest.region,
    archiveBytes: manifest.archiveBytes ?? null,
    bounds: manifest.bounds ?? null,
    generatedAt: manifest.generatedAt ?? null,
    source: manifest.source ?? null,
    canRebuild: Boolean(manifest.source?.url || manifest.source?.catalogId || manifest.source?.file)
  };
}

export class MapLibrary {
  constructor({ dataDirectory, applyRuntime, buildMap, inspectArchive }) {
    this.dataDirectory = dataDirectory;
    this.regionsDirectory = path.join(dataDirectory, "regions");
    this.applyRuntime = applyRuntime;
    this.buildMap = buildMap;
    this.inspectArchive = inspectArchive;
  }

  async list() {
    let names;
    try {
      names = await readdir(this.regionsDirectory);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    const maps = await Promise.all(names.filter((name) => name.endsWith(".json")).sort().map(async (filename) => {
      const id = path.basename(filename, ".json");
      const manifest = JSON.parse(await readFile(path.join(this.regionsDirectory, filename), "utf8"));
      return publicMap(id, manifest);
    }));
    return maps;
  }

  async create({ id, name, source, reuseSource, buildMemory, onProgress }) {
    ({ id, name } = validateMapIdentity(id, name));
    await mkdir(this.regionsDirectory, { recursive: true });
    const manifestPath = this.#manifestPath(id);
    const archivePath = this.#archivePath(id);
    if ((await this.list()).some((map) => map.id === id)) throw new Error(`Map '${id}' already exists`);
    const token = randomUUID();
    const stagingArchive = path.join(this.dataDirectory, `.${id}-${token}.mbtiles`);
    const stagingManifest = path.join(this.regionsDirectory, `.${id}-${token}.json`);
    try {
      await this.buildMap({ id, name, source, output: stagingArchive, reuseSource, buildMemory, onProgress });
      onProgress?.({ phase: "configuring", progress: null });
      const inspected = await this.inspectArchive({ name, archive: stagingArchive });
      const manifest = { ...inspected, archive: `${id}.mbtiles`, source };
      await writeFile(stagingManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      onProgress?.({ phase: "activating", progress: null });
      await this.#activate({ archivePath, manifestPath, stagingArchive, stagingManifest });
      return publicMap(id, manifest);
    } finally {
      await rm(stagingArchive, { force: true });
      await rm(stagingManifest, { force: true });
    }
  }

  async update(id, { name }) {
    const { manifest, manifestPath } = await this.#load(id);
    const updated = { ...manifest, region: validateName(name) };
    const temporary = `${manifestPath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    await this.#activate({ manifestPath, stagingManifest: temporary });
    return publicMap(id, updated);
  }

  async rebuild(id, { reuseSource, buildMemory, onProgress } = {}) {
    const { manifest } = await this.#load(id);
    if (!manifest.source?.url && !manifest.source?.catalogId && !manifest.source?.file) throw new Error(`Map '${id}' does not have a reusable source`);
    return this.#replace(id, manifest, { reuseSource, buildMemory, onProgress });
  }

  async delete(id, { confirmation }) {
    validateId(id);
    if (confirmation !== id) throw new Error("Delete confirmation must match the map ID");
    const { manifest, manifestPath } = await this.#load(id);
    const archivePath = path.join(this.dataDirectory, manifest.archive);
    const token = randomUUID();
    const parkedManifest = `${manifestPath}.${token}.deleting`;
    const parkedArchive = `${archivePath}.${token}.deleting`;
    const sourcePath = path.join(this.dataDirectory, "sources", `${id}.osm.pbf`);
    const sourceMetadataPath = `${sourcePath}.json`;
    const partialSourcePath = `${sourcePath}.download`;
    const partialMetadataPath = `${partialSourcePath}.json`;
    const parkedSource = `${sourcePath}.${token}.deleting`;
    const hadSource = await access(sourcePath).then(() => true, () => false);
    await rename(manifestPath, parkedManifest);
    await rename(archivePath, parkedArchive);
    if (hadSource) await rename(sourcePath, parkedSource);
    try {
      await this.applyRuntime();
      await rm(parkedManifest, { force: true });
      await rm(parkedArchive, { force: true });
      await rm(parkedSource, { force: true });
      await rm(sourceMetadataPath, { force: true });
      await rm(partialSourcePath, { force: true });
      await rm(partialMetadataPath, { force: true });
    } catch (error) {
      if (hadSource) await rename(parkedSource, sourcePath);
      await rename(parkedArchive, archivePath);
      await rename(parkedManifest, manifestPath);
      try { await this.applyRuntime(); } catch {}
      throw error;
    }
  }

  async #replace(id, manifest, { reuseSource, buildMemory, onProgress }) {
    const token = randomUUID();
    const archivePath = path.join(this.dataDirectory, manifest.archive);
    const stagingArchive = path.join(this.dataDirectory, `.${id}-${token}.mbtiles`);
    try {
      await this.buildMap({ id, name: manifest.region, source: manifest.source, output: stagingArchive, reuseSource, buildMemory, onProgress });
      onProgress?.({ phase: "configuring", progress: null });
      const inspected = await this.inspectArchive({ name: manifest.region, archive: stagingArchive });
      const updated = { ...inspected, archive: manifest.archive, source: manifest.source };
      const manifestPath = this.#manifestPath(id);
      const stagingManifest = `${manifestPath}.${token}.tmp`;
      await writeFile(stagingManifest, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
      onProgress?.({ phase: "activating", progress: null });
      await this.#activate({ archivePath, manifestPath, stagingArchive, stagingManifest });
      return publicMap(id, updated);
    } finally {
      await rm(stagingArchive, { force: true });
    }
  }

  async #activate({ archivePath = null, manifestPath, stagingArchive = null, stagingManifest }) {
    const token = randomUUID();
    const backupArchive = archivePath ? `${archivePath}.${token}.rollback` : null;
    const backupManifest = `${manifestPath}.${token}.rollback`;
    const hadArchive = archivePath ? await access(archivePath).then(() => true, () => false) : false;
    const hadManifest = await access(manifestPath).then(() => true, () => false);
    if (hadArchive) await rename(archivePath, backupArchive);
    if (hadManifest) await rename(manifestPath, backupManifest);
    try {
      if (stagingArchive) await rename(stagingArchive, archivePath);
      await rename(stagingManifest, manifestPath);
      await this.applyRuntime();
      if (backupArchive) await rm(backupArchive, { force: true });
      await rm(backupManifest, { force: true });
    } catch (error) {
      if (archivePath) await rm(archivePath, { force: true });
      await rm(manifestPath, { force: true });
      if (hadArchive) await rename(backupArchive, archivePath);
      if (hadManifest) await rename(backupManifest, manifestPath);
      try { await this.applyRuntime(); } catch {}
      throw error;
    }
  }

  async #load(id) {
    validateId(id);
    const manifestPath = this.#manifestPath(id);
    try {
      return { manifestPath, manifest: JSON.parse(await readFile(manifestPath, "utf8")) };
    } catch (error) {
      if (error.code === "ENOENT") throw new Error(`Map '${id}' not found`);
      throw error;
    }
  }

  #archivePath(id) {
    return path.join(this.dataDirectory, `${id}.mbtiles`);
  }

  #manifestPath(id) {
    return path.join(this.regionsDirectory, `${id}.json`);
  }
}

export { SAFE_ID };
