#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileRuntime } from "../maintainer/src/runtime-files.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = process.env.MAP_ROOM_DATA_DIR ?? path.join(repositoryRoot, "data");
const styleDirectory = process.env.MAP_ROOM_STYLE_DIR ?? path.join(repositoryRoot, "styles");
const baseConfigPath = process.env.MAP_ROOM_BASE_CONFIG ?? path.join(repositoryRoot, "config.json");
const defaultRegion = process.env.MAP_ROOM_DEFAULT_REGION?.trim() || null;
const catalog = await compileRuntime({ dataDirectory, styleDirectory, baseConfigPath, defaultRegion });
console.log(`Configured ${catalog.regions.length} regions (${catalog.regions.map(({ id }) => id).join(", ")}); default: ${catalog.defaultRegion ?? "none"}`);
