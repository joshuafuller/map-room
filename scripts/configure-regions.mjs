#!/usr/bin/env node
import { access, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRuntimeArtifacts } from "../maintainer/src/runtime-config.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = process.env.MAP_ROOM_DATA_DIR ?? path.join(repositoryRoot, "data");
const styleDirectory = process.env.MAP_ROOM_STYLE_DIR ?? path.join(repositoryRoot, "styles");
const baseConfigPath = process.env.MAP_ROOM_BASE_CONFIG ?? path.join(repositoryRoot, "config.json");
const manifestDirectory = path.join(dataDirectory, "regions");

const parseJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const manifestFiles = (await readdir(manifestDirectory))
  .filter((name) => name.endsWith(".json"))
  .sort();

if (manifestFiles.length === 0) throw new Error(`No region manifests found in ${manifestDirectory}`);

const regions = [];
for (const filename of manifestFiles) {
  const id = path.basename(filename, ".json");
  const manifest = await parseJson(path.join(manifestDirectory, filename));
  await access(path.join(dataDirectory, manifest.archive));
  regions.push({ id, name: manifest.region, ...manifest });
}

const defaultRegion = process.env.MAP_ROOM_DEFAULT_REGION?.trim() || regions[0].id;
const baseConfig = await parseJson(baseConfigPath);
const themes = {};
for (const [themeId, value] of Object.entries(baseConfig.styles)) {
  themes[themeId] = await parseJson(path.join(styleDirectory, value.style));
}

const { config, styles, catalog } = buildRuntimeArtifacts({ registry: { defaultRegion, regions }, themes });
for (const [relativePath, style] of Object.entries(styles)) {
  const destination = path.join(styleDirectory, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(style, null, 2)}\n`);
}

await mkdir(path.join(dataDirectory, "runtime"), { recursive: true });
await writeFile(path.join(dataDirectory, "runtime", "config.json"), `${JSON.stringify(config, null, 2)}\n`);
await writeFile(path.join(dataDirectory, "regions.json"), `${JSON.stringify(catalog, null, 2)}\n`);
await copyFile(path.join(manifestDirectory, `${defaultRegion}.json`), path.join(dataDirectory, "manifest.json"));

console.log(`Configured ${regions.length} regions (${regions.map(({ id }) => id).join(", ")}); default: ${defaultRegion}`);
