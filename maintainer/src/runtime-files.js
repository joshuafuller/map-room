import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildRuntimeArtifacts } from "./runtime-config.js";

const parseJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const writeJson = async (file, value) => {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
};

export async function compileRuntime({ dataDirectory, styleDirectory, baseConfigPath, defaultRegion = null }) {
  const manifestDirectory = path.join(dataDirectory, "regions");
  await mkdir(manifestDirectory, { recursive: true });
  const manifestFiles = (await readdir(manifestDirectory)).filter((name) => name.endsWith(".json")).sort();
  const regions = [];
  for (const filename of manifestFiles) {
    const id = path.basename(filename, ".json");
    const manifest = await parseJson(path.join(manifestDirectory, filename));
    await access(path.join(dataDirectory, manifest.archive));
    regions.push({ id, name: manifest.region, ...manifest });
  }

  const selectedDefault = regions.some(({ id }) => id === defaultRegion) ? defaultRegion : regions[0]?.id ?? null;
  const baseConfig = await parseJson(baseConfigPath);
  const themes = {};
  for (const [themeId, value] of Object.entries(baseConfig.styles)) {
    themes[themeId] = await parseJson(path.join(styleDirectory, value.style));
  }

  const { config, styles, catalog } = buildRuntimeArtifacts({
    registry: { defaultRegion: selectedDefault, regions }, themes
  });
  for (const [relativePath, style] of Object.entries(styles)) {
    const destination = path.join(styleDirectory, relativePath);
    await writeJson(destination, style);
  }
  await mkdir(path.join(dataDirectory, "runtime"), { recursive: true });
  await writeJson(path.join(dataDirectory, "runtime", "config.json"), config);
  await writeJson(path.join(dataDirectory, "regions.json"), catalog);
  if (selectedDefault) await writeJson(path.join(dataDirectory, "manifest.json"), await parseJson(path.join(manifestDirectory, `${selectedDefault}.json`)));
  else await writeJson(path.join(dataDirectory, "manifest.json"), { region: "No maps installed" });
  return catalog;
}
