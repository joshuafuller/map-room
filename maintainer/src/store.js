import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const defaults = {
  selections: [],
  installed: [],
  settings: { autoUpdate: true, checkIntervalHours: 24 },
  lastCheckedAt: null
};

export class JsonStateStore {
  constructor(path) {
    this.path = path;
  }

  async load() {
    try {
      const saved = JSON.parse(await readFile(this.path, "utf8"));
      return { ...structuredClone(defaults), ...saved, settings: { ...defaults.settings, ...saved.settings } };
    } catch (error) {
      if (error.code === "ENOENT") return structuredClone(defaults);
      throw error;
    }
  }

  async save(state) {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporary, this.path);
  }
}
