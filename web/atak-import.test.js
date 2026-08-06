import test from "node:test";
import assert from "node:assert/strict";
import { buildAtakImportUri, isLoopbackMapRoomUrl, normalizeAtakServerUrl } from "./atak-import.js";

test("builds an exact ATAK import URI for nested queries, Unicode, and reserved characters", () => {
  const definition = "https://maps.example.test/root/api/atak/vector/caf%C3%A9.json?style=dark%20blue&next=https%3A%2F%2Ftiles.example%2Fa%3Fx%3D1%26y%3D%23frag";
  const uri = buildAtakImportUri(definition);

  assert.equal(uri, `tak://com.atakmap.app/import?url=${encodeURIComponent(definition)}`);
  assert.equal(new URL(uri).searchParams.get("url"), definition);
});

test("rejects unsafe definition URLs and identifies loopback Map Room addresses", () => {
  for (const value of ["not a URL", "ftp://maps.example.test/map.xml", "https://user:secret@maps.example.test/map.xml"]) {
    assert.throws(() => buildAtakImportUri(value), /HTTP|credentials/);
  }
  for (const value of ["http://localhost:8088", "http://maps.localhost", "http://127.8.9.10", "http://[::1]:8088"]) {
    assert.equal(isLoopbackMapRoomUrl(value), true, value);
  }
  assert.equal(isLoopbackMapRoomUrl("http://192.168.1.20:8088"), false);
  assert.equal(isLoopbackMapRoomUrl("https://maps.example.test"), false);
});

test("normalizes a device-reachable Map Room address and rejects dead-end setup origins", () => {
  assert.equal(normalizeAtakServerUrl(" https://maps.example.test/root/ "), "https://maps.example.test/root");
  assert.equal(normalizeAtakServerUrl("https://maps.example.test"), "https://maps.example.test");
  assert.equal(normalizeAtakServerUrl("maps.example.test:8088"), "http://maps.example.test:8088");
  for (const value of [
    "http://localhost:8088",
    "http://127.0.0.1:8088",
    "https://user:secret@maps.example.test",
    "https://maps.example.test/?token=secret",
    "ftp://maps.example.test",
    null
  ]) {
    assert.throws(() => normalizeAtakServerUrl(value), /device-reachable|credentials|query|HTTP/);
  }
});
