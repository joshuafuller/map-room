import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const themes = {
  daylight: {
    name: "Daylight",
    background: "#f4f1ea",
    residential: "#e9e5dc",
    industrial: "#ddd8d0",
    park: "#cfe3c5",
    wood: "#bfd6bb",
    water: "#9bc8df",
    waterLine: "#78b4d2",
    building: "#d5cbc0",
    buildingOutline: "#c4b7aa",
    boundary: "#9b74a9",
    roadCasing: "#c8c0b5",
    motorway: "#d98357",
    primary: "#e8b06d",
    secondary: "#f1d49a",
    minor: "#ffffff",
    rail: "#8c8580",
    text: "#293038",
    textHalo: "#fbfaf7",
    waterText: "#356c89"
  },
  midnight: {
    name: "Midnight",
    background: "#101820",
    residential: "#17232c",
    industrial: "#202933",
    park: "#18332d",
    wood: "#15352c",
    water: "#102b3c",
    waterLine: "#1d526c",
    building: "#29343d",
    buildingOutline: "#35434d",
    boundary: "#8f73b5",
    roadCasing: "#0c1117",
    motorway: "#d77d5b",
    primary: "#c7a260",
    secondary: "#7f7a65",
    minor: "#53606a",
    rail: "#6d7780",
    text: "#e2e8ec",
    textHalo: "#111a22",
    waterText: "#79b9d4"
  }
};

const roadColor = (theme) => [
  "match", ["get", "class"],
  ["motorway", "trunk"], theme.motorway,
  "primary", theme.primary,
  "secondary", theme.secondary,
  theme.minor
];

const roadWidth = [
  "interpolate", ["linear"], ["zoom"],
  7, ["match", ["get", "class"], ["motorway", "trunk"], 1.2, 0.35],
  12, ["match", ["get", "class"], ["motorway", "trunk"], 4.5, "primary", 3.5, "secondary", 2.6, 1.4],
  16, ["match", ["get", "class"], ["motorway", "trunk"], 14, "primary", 11, "secondary", 9, 6]
];

const roadCasingWidth = [
  "interpolate", ["linear"], ["zoom"],
  7, ["match", ["get", "class"], ["motorway", "trunk"], 2.8, 1.95],
  12, ["match", ["get", "class"], ["motorway", "trunk"], 6.1, "primary", 5.1, "secondary", 4.2, 3],
  16, ["match", ["get", "class"], ["motorway", "trunk"], 15.6, "primary", 12.6, "secondary", 10.6, 7.6]
];

function makeStyle(id, theme) {
  const labelLayout = {
    "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
    "text-font": ["Open Sans Regular"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 14, 15],
    "text-max-width": 9
  };

  return {
    version: 8,
    name: theme.name,
    metadata: {
      "map-room:theme": id,
      "map-room:tileset-schema": "openmaptiles-3.16"
    },
    sources: {
      osm: { type: "vector", url: "mbtiles://{osm}" }
    },
    glyphs: "{fontstack}/{range}.pbf",
    layers: [
      { id: "background", type: "background", paint: { "background-color": theme.background } },
      {
        id: "landuse", type: "fill", source: "osm", "source-layer": "landuse",
        paint: {
          "fill-color": ["match", ["get", "class"], "residential", theme.residential, "industrial", theme.industrial, ["park", "grass", "cemetery"], theme.park, theme.background],
          "fill-opacity": 0.78
        }
      },
      {
        id: "landcover", type: "fill", source: "osm", "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["wood", "grass"]]],
        paint: { "fill-color": ["match", ["get", "class"], "wood", theme.wood, theme.park], "fill-opacity": 0.72 }
      },
      { id: "parks", type: "fill", source: "osm", "source-layer": "park", paint: { "fill-color": theme.park, "fill-opacity": 0.82 } },
      { id: "water", type: "fill", source: "osm", "source-layer": "water", paint: { "fill-color": theme.water } },
      { id: "waterways", type: "line", source: "osm", "source-layer": "waterway", paint: { "line-color": theme.waterLine, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 15, 2.2] } },
      {
        id: "buildings", type: "fill", source: "osm", "source-layer": "building", minzoom: 13,
        paint: { "fill-color": theme.building, "fill-outline-color": theme.buildingOutline, "fill-opacity": 0.9 }
      },
      {
        id: "boundaries", type: "line", source: "osm", "source-layer": "boundary",
        paint: { "line-color": theme.boundary, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 12, 1.6], "line-dasharray": [4, 2], "line-opacity": 0.8 }
      },
      {
        id: "roads-casing", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "path", "track"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadCasing, "line-width": roadCasingWidth, "line-opacity": 0.95 }
      },
      {
        id: "roads", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "path", "track"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": roadColor(theme), "line-width": roadWidth }
      },
      {
        id: "rail", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["==", ["get", "class"], "rail"],
        paint: { "line-color": theme.rail, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 15, 2], "line-dasharray": [3, 2] }
      },
      {
        id: "road-labels", type: "symbol", source: "osm", "source-layer": "transportation_name", minzoom: 12,
        layout: { ...labelLayout, "symbol-placement": "line", "text-size": 11 },
        paint: { "text-color": theme.text, "text-halo-color": theme.textHalo, "text-halo-width": 1.5 }
      },
      {
        id: "water-labels", type: "symbol", source: "osm", "source-layer": "water_name",
        layout: { ...labelLayout, "text-font": ["Open Sans Italic"] },
        paint: { "text-color": theme.waterText, "text-halo-color": theme.textHalo, "text-halo-width": 1.4 }
      },
      {
        id: "place-labels", type: "symbol", source: "osm", "source-layer": "place",
        layout: { ...labelLayout, "text-font": ["Open Sans Semibold"], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 12, 17] },
        paint: { "text-color": theme.text, "text-halo-color": theme.textHalo, "text-halo-width": 1.8 }
      },
      {
        id: "house-numbers", type: "symbol", source: "osm", "source-layer": "housenumber", minzoom: 14,
        layout: { "text-field": ["get", "housenumber"], "text-font": ["Open Sans Regular"], "text-size": 9 },
        paint: { "text-color": theme.text, "text-halo-color": theme.textHalo, "text-halo-width": 1 }
      }
    ]
  };
}

for (const [id, theme] of Object.entries(themes)) {
  const output = resolve(here, id, "style.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(makeStyle(id, theme), null, 2)}\n`);
  console.log(`wrote ${output}`);
}
