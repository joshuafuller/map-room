import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const guidePath = path.join(root, "docs", "ATAK_MAP_ARCHITECTURE.md");

test("ATAK map architecture guide preserves the source-traced ingestion workflows", async () => {
  const [guide, readme] = await Promise.all([
    readFile(guidePath, "utf8"),
    readFile(path.join(root, "README.md"), "utf8"),
  ]);

  assert.match(guide, /17deb7e1aeb51cc499ff385986853f5b293d3604/);
  assert.match(guide, /93c6cf2a45609b2e275e07270113277faa1d591d/);
  assert.match(guide, /## Evidence boundary/);
  assert.match(guide, /## Mental model: how ATAK maps work/);
  assert.match(guide, /## Raster sources/);
  assert.match(guide, /## Maps and imagery are not styles/);
  assert.match(guide, /## Streamed vector tiles/);
  assert.match(guide, /## Offline tile containers and MBTiles/);
  assert.match(guide, /## QR and Add to ATAK/);
  assert.match(guide, /## Full Data Package ingestion/);
  assert.match(guide, /## What Map Room should publish/);

  const mermaidDiagrams = guide.match(/```mermaid/g) ?? [];
  assert.ok(mermaidDiagrams.length >= 4, "guide should include at least four Mermaid diagrams");

  for (const source of [
    "ImportExportMapComponent.java",
    "ImportFileDownloader.java",
    "StreamingTiles.java",
    "StreamingTileClient.java",
    "StreamingContentDatasetDescriptorSpi.java",
    "ImportMissionPackageResolver.java",
    "MissionPackageExtractor.java",
    "MissionPackageEventHandler2.java",
  ]) {
    assert.match(guide, new RegExp(source.replace(".", "\\.")));
  }

  assert.match(readme, /docs\/ATAK_MAP_ARCHITECTURE\.md/);
});
