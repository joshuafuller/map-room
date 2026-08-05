import test from "node:test";
import assert from "node:assert/strict";
import { renderQrSvg } from "./qr-code.js";

test("renders an accessible local QR SVG", () => {
  const svg = renderQrSvg("tak://com.atakmap.app/import?url=https%3A%2F%2Fmaps.example.test%2Fmap.xml");
  assert.match(svg, /^<svg /);
  assert.match(svg, /Scan to add this hosted map to ATAK/);
  assert.match(svg, /QR code containing an ATAK import link/);
  assert.match(svg, /<path /);
});

test("rejects empty QR content", () => {
  for (const value of ["", null]) assert.throws(() => renderQrSvg(value), /required/);
});
