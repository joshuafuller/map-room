import test from "node:test";
import assert from "node:assert/strict";
import { buildAtakXml } from "./atak.js";

test("generates region-qualified Cyberpunk ATAK XML for the exact PNG XYZ preview route", () => {
  const xml = buildAtakXml({ theme: "cyberpunk", region: "florida", regionName: "Florida", baseUrl: "https://maps.example.test/" });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?>/);
  assert.match(xml, /<name>Map Room - Florida - Cyberpunk<\/name>/);
  assert.match(xml, /<tileType>png<\/tileType>/);
  assert.match(xml, /<tileUpdate>IfNoneMatch<\/tileUpdate>/);
  assert.match(xml, /https:\/\/maps\.example\.test\/styles\/florida-cyberpunk\/\{\$z\}\/\{\$x\}\/\{\$y\}@2x\.png/);
  assert.match(xml, /<backgroundColor>#060711<\/backgroundColor>/);
  assert.match(xml, /<ignoreErrors>false<\/ignoreErrors>/);
  assert.match(xml, /<serverParts><\/serverParts>/);
});

test("generates Cyberpunk Tactical ATAK XML as a separate map source", () => {
  const xml = buildAtakXml({ theme: "cyberpunk-tactical", region: "california", regionName: "California", baseUrl: "https://maps.example.test/" });

  assert.match(xml, /<name>Map Room - California - Cyberpunk Tactical<\/name>/);
  assert.match(xml, /https:\/\/maps\.example\.test\/styles\/california-cyberpunk-tactical\/\{\$z\}\/\{\$x\}\/\{\$y\}@2x\.png/);
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
    assert.throws(() => buildAtakXml({ theme: "cyberpunk-tactical", region: "florida", regionName: "Florida", baseUrl: invalid }), /ATAK base URL/);
  }
});

test("rejects unsafe region identifiers and XML-sensitive region names", () => {
  assert.throws(
    () => buildAtakXml({ theme: "daylight", region: "../florida", regionName: "Florida", baseUrl: "https://maps.example.test" }),
    /ATAK region/
  );
  assert.throws(
    () => buildAtakXml({ theme: "daylight", region: "florida", regionName: "Florida & Gulf", baseUrl: "https://maps.example.test" }),
    /ATAK region name/
  );
});
