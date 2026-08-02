import test from "node:test";
import assert from "node:assert/strict";
import { buildAtakXml } from "./atak.js";

test("generates one composed Cyberpunk ATAK map source for every installed region", () => {
  const xml = buildAtakXml({ theme: "cyberpunk", baseUrl: "https://maps.example.test/" });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?>/);
  assert.match(xml, /<name>Map Room - Cyberpunk<\/name>/);
  assert.match(xml, /<tileType>png<\/tileType>/);
  assert.match(xml, /<tileUpdate>IfNoneMatch<\/tileUpdate>/);
  assert.match(xml, /https:\/\/maps\.example\.test\/styles\/all-cyberpunk\/\{\$z\}\/\{\$x\}\/\{\$y\}@2x\.png/);
  assert.equal((xml.match(/<customMapSource>/g) ?? []).length, 1);
  assert.match(xml, /<backgroundColor>#060711<\/backgroundColor>/);
  assert.match(xml, /<ignoreErrors>false<\/ignoreErrors>/);
  assert.match(xml, /<serverParts><\/serverParts>/);
});

test("generates Cyberpunk Tactical ATAK XML as one composed map source", () => {
  const xml = buildAtakXml({ theme: "cyberpunk-tactical", baseUrl: "https://maps.example.test/" });

  assert.match(xml, /<name>Map Room - Cyberpunk Tactical<\/name>/);
  assert.match(xml, /https:\/\/maps\.example\.test\/styles\/all-cyberpunk-tactical\/\{\$z\}\/\{\$x\}\/\{\$y\}@2x\.png/);
  assert.match(xml, /<backgroundColor>#03040b<\/backgroundColor>/);
  assert.match(xml, /<maxZoom>20<\/maxZoom>/);
});

test("rejects base URLs that cannot identify a reachable HTTP tile server", () => {
  for (const invalid of [
    "not a URL",
    "ftp://maps.example.test",
    "https://user:secret@maps.example.test",
    "https://:secret@maps.example.test",
    "https://maps.example.test/?deployment=one",
    "https://maps.example.test/#fragment"
  ]) {
    assert.throws(() => buildAtakXml({ theme: "cyberpunk-tactical", baseUrl: invalid }), /ATAK base URL/);
  }
});

test("rejects an unknown theme and accepts a path-prefixed HTTP deployment", () => {
  assert.throws(() => buildAtakXml({ theme: "missing", baseUrl: "https://maps.example.test" }), /Unknown ATAK theme/);
  const xml = buildAtakXml({ theme: "daylight", baseUrl: "http://maps.example.test/map-room///" });
  assert.match(xml, /http:\/\/maps\.example\.test\/map-room\/styles\/all-daylight/);
});
