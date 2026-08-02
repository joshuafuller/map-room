import test from "node:test";
import assert from "node:assert/strict";
import { buildAtakVectorDescriptor, buildAtakXml } from "./atak.js";

const floridaTileJson = {
  id: "florida",
  name: "OpenMapTiles",
  format: "pbf",
  minzoom: 0,
  maxzoom: 14,
  bounds: [-88.70372, 23.68312, -77.72359, 31.00307],
  attribution: "© OpenMapTiles © OpenStreetMap contributors",
  vector_layers: [
    {
      id: "building",
      fields: {
        colour: "String",
        hide_3d: "Boolean",
        render_height: "Number",
        render_min_height: "Number"
      },
      minzoom: 13,
      maxzoom: 14
    },
    { id: "transportation", fields: { class: "String" }, minzoom: 4, maxzoom: 14 }
  ]
};

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

test("builds a stock ATAK stream descriptor for one self-hosted vector publication", () => {
  const descriptor = buildAtakVectorDescriptor({
    publication: { id: "florida", name: "Florida" },
    baseUrl: "https://maps.example.test/map-room/",
    tileJson: floridaTileJson
  });

  assert.deepEqual(descriptor, {
    schema: "4.0.0",
    title: "Map Room - Florida",
    url: "https://maps.example.test/map-room/data/florida/{$z}/{$x}/{$y}.pbf",
    attribution: "© OpenMapTiles © OpenStreetMap contributors",
    downloadable: true,
    overlay: false,
    srs: "EPSG:3857",
    bounds: {
      minX: -9874452.941869117,
      minY: 2714842.168027307,
      maxX: -8652150.46142517,
      maxY: 3633147.8477424732
    },
    isQuadtree: true,
    numLevels: 15,
    content: "vector",
    mimeType: "application/vnd.mapbox-vector-tile",
    metadata: {
      styleSchema: "omt",
      json: JSON.stringify({ vector_layers: floridaTileJson.vector_layers })
    }
  });
});

test("preserves the published building schema required by 3D styles", () => {
  const descriptor = buildAtakVectorDescriptor({
    publication: { id: "florida", name: "Florida" },
    baseUrl: "http://maps.example.test:8088",
    tileJson: floridaTileJson
  });
  const schema = JSON.parse(descriptor.metadata.json);
  const building = schema.vector_layers.find(({ id }) => id === "building");

  assert.equal(building.fields.render_height, "Number");
  assert.equal(building.fields.render_min_height, "Number");
  assert.equal(building.fields.hide_3d, "Boolean");
});

test("fails closed for publications ATAK cannot safely stream", () => {
  const valid = {
    publication: { id: "florida", name: "Florida" },
    baseUrl: "https://maps.example.test",
    tileJson: floridaTileJson
  };

  assert.throws(() => buildAtakVectorDescriptor({ ...valid, publication: { id: "../florida", name: "Florida" } }), /publication ID/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, publication: { id: "florida", name: "" } }), /publication name/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, tileJson: { ...floridaTileJson, format: "png" } }), /PBF TileJSON/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, tileJson: { ...floridaTileJson, minzoom: 1 } }), /zoom zero/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, tileJson: { ...floridaTileJson, maxzoom: 31 } }), /zoom range/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, tileJson: { ...floridaTileJson, bounds: [1, 2, 3] } }), /bounds/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, tileJson: { ...floridaTileJson, bounds: [-88, 32, -89, 31] } }), /bounds/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, tileJson: { ...floridaTileJson, vector_layers: [] } }), /vector layer metadata/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, tileJson: { ...floridaTileJson, id: "california" } }), /match its TileJSON ID/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, tileJson: { ...floridaTileJson, attribution: "" } }), /attribution/);
  assert.throws(() => buildAtakVectorDescriptor({ ...valid, baseUrl: "https://maps.example.test/?token=secret" }), /ATAK base URL/);
});
