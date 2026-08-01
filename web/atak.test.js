import test from "node:test";
import assert from "node:assert/strict";
import { buildAtakXml } from "./atak.js";

test("generates Cyberpunk ATAK XML for the exact PNG XYZ preview route", () => {
  const xml = buildAtakXml("cyberpunk", "https://maps.example.test/");

  assert.match(xml, /<name>Map Room - Cyberpunk<\/name>/);
  assert.match(xml, /<tileType>png<\/tileType>/);
  assert.match(xml, /https:\/\/maps\.example\.test\/styles\/cyberpunk\/\{\$z\}\/\{\$x\}\/\{\$y\}\.png/);
  assert.match(xml, /<backgroundColor>#060711<\/backgroundColor>/);
});
