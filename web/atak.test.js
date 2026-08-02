import test from "node:test";
import assert from "node:assert/strict";
import { buildAtakXml } from "./atak.js";

test("generates Cyberpunk ATAK XML for the exact PNG XYZ preview route", () => {
  const xml = buildAtakXml("cyberpunk", "https://maps.example.test/");

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?>/);
  assert.match(xml, /<name>Map Room - Cyberpunk<\/name>/);
  assert.match(xml, /<tileType>png<\/tileType>/);
  assert.match(xml, /<tileUpdate>IfNoneMatch<\/tileUpdate>/);
  assert.match(xml, /https:\/\/maps\.example\.test\/styles\/cyberpunk\/\{\$z\}\/\{\$x\}\/\{\$y\}@2x\.png/);
  assert.match(xml, /<backgroundColor>#060711<\/backgroundColor>/);
  assert.match(xml, /<ignoreErrors>false<\/ignoreErrors>/);
  assert.match(xml, /<serverParts><\/serverParts>/);
});

test("generates Cyberpunk Tactical ATAK XML as a separate map source", () => {
  const xml = buildAtakXml("cyberpunk-tactical", "https://maps.example.test/");

  assert.match(xml, /<name>Map Room - Cyberpunk Tactical<\/name>/);
  assert.match(xml, /https:\/\/maps\.example\.test\/styles\/cyberpunk-tactical\/\{\$z\}\/\{\$x\}\/\{\$y\}@2x\.png/);
  assert.match(xml, /<backgroundColor>#03040b<\/backgroundColor>/);
  assert.match(xml, /<maxZoom>20<\/maxZoom>/);
});

test("rejects base URLs that cannot identify a reachable HTTP tile server", () => {
  for (const invalid of [
    "not a URL",
    "ftp://maps.example.test",
    "https://user:secret@maps.example.test",
    "https://maps.example.test/?deployment=one",
    "https://maps.example.test/#fragment"
  ]) {
    assert.throws(() => buildAtakXml("cyberpunk-tactical", invalid), /ATAK base URL/);
  }
});
