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
  },
  cyberpunk: {
    name: "Cyberpunk",
    background: "#060711",
    residential: "#101126",
    industrial: "#171028",
    park: "#071f20",
    wood: "#08251f",
    water: "#061b2a",
    waterLine: "#00d9ff",
    building: "#17152d",
    buildingOutline: "#ff2aa3",
    boundary: "#9d5cff",
    roadCasing: "#080812",
    motorway: "#ff2aa3",
    primary: "#00e5ff",
    secondary: "#9d5cff",
    tertiary: "#5e6da8",
    minor: "#35406b",
    path: "#26314f",
    rail: "#f7e65b",
    text: "#f4f7ff",
    textHalo: "#080912",
    waterText: "#70f7ff",
    glow: true
  },
  "cyberpunk-tactical": {
    name: "Cyberpunk Tactical",
    description: "Operational neon with disciplined visual hierarchy",
    background: "#03040b",
    residential: "#090c19",
    industrial: "#120a1c",
    park: "#041714",
    wood: "#052019",
    water: "#03131f",
    waterLine: "#00eaff",
    building: "#101225",
    buildingOutline: "#32406c",
    boundary: "#8056d9",
    roadCasing: "#020309",
    motorway: "#ff2a9f",
    primary: "#00eaff",
    secondary: "#8c62f4",
    tertiary: "#41598b",
    minor: "#26314e",
    path: "#172039",
    rail: "#f2dc58",
    text: "#f6f8ff",
    textHalo: "#03040b",
    waterText: "#70f6ff",
    glow: true,
    tactical: true
  }
};

const roadColor = (theme) => [
  "match", ["get", "class"],
  ["motorway", "trunk"], theme.motorway,
  "primary", theme.primary,
  "secondary", theme.secondary,
  "tertiary", theme.tertiary ?? theme.minor,
  ["path", "track"], theme.path ?? theme.minor,
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

const tacticalRoadWidth = [
  "interpolate", ["linear"], ["zoom"],
  7, ["match", ["get", "class"], ["motorway", "trunk"], 1.5, "primary", 0.9, "secondary", 0.45, 0.18],
  12, ["match", ["get", "class"], ["motorway", "trunk"], 5.2, "primary", 4.1, "secondary", 2.2, "tertiary", 1.25, 0.6],
  16, ["match", ["get", "class"], ["motorway", "trunk"], 15, "primary", 12, "secondary", 8, "tertiary", 5, 2]
];

const tacticalRoadCasingWidth = [
  "interpolate", ["linear"], ["zoom"],
  7, ["match", ["get", "class"], ["motorway", "trunk"], 3.2, "primary", 2.1, 1.1],
  12, ["match", ["get", "class"], ["motorway", "trunk"], 6.8, "primary", 5.7, "secondary", 3.7, 2.1],
  16, ["match", ["get", "class"], ["motorway", "trunk"], 16.8, "primary", 13.8, "secondary", 9.8, "tertiary", 6.8, 3.8]
];

function makeStyle(id, theme) {
  const labelLayout = {
    "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
    "text-font": ["Open Sans Regular"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 14, 15],
    "text-max-width": 9
  };

  const selectedRoadWidth = theme.tactical ? tacticalRoadWidth : roadWidth;
  const selectedRoadCasingWidth = theme.tactical ? tacticalRoadCasingWidth : roadCasingWidth;
  const glowRoadClasses = theme.tactical
    ? ["motorway", "trunk", "primary"]
    : ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "path", "track"];
  const glowLayers = theme.glow ? [
    {
      id: "waterway-glow", type: "line", source: "osm", "source-layer": "waterway",
      paint: {
        "line-color": theme.waterLine,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 15, 7],
        "line-blur": 4,
        "line-opacity": 0.38
      }
    },
    {
      id: "roads-glow", type: "line", source: "osm", "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", glowRoadClasses]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": roadColor(theme),
        "line-width": selectedRoadCasingWidth,
        "line-blur": theme.tactical ? 4 : 3,
        "line-opacity": theme.tactical ? 0.36 : 0.44
      }
    },
    {
      id: "rail-glow", type: "line", source: "osm", "source-layer": "transportation",
      filter: ["==", ["get", "class"], "rail"],
      paint: {
        "line-color": theme.rail,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2, 15, 6],
        "line-blur": 3,
        "line-opacity": 0.35
      }
    }
  ] : [];

  const tacticalLayers = theme.tactical ? {
    urban: [{
      id: "urban-glow", type: "circle", source: "osm", "source-layer": "place", maxzoom: 11,
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      paint: {
        "circle-color": ["match", ["get", "class"], "city", theme.motorway, theme.primary],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4, 8, 25, 11, 42],
        "circle-blur": 0.92,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.04, 8, 0.12, 11, 0]
      }
    }],
    coastline: [{
      id: "coastline-glow", type: "line", source: "osm", "source-layer": "water",
      paint: { "line-color": theme.waterLine, "line-width": 5, "line-blur": 5, "line-opacity": 0.28 }
    }],
    landmarks: [
      {
        id: "airports", type: "fill", source: "osm", "source-layer": "aeroway", minzoom: 8,
        filter: ["in", ["get", "class"], ["literal", ["aerodrome", "heliport"]]],
        paint: { "fill-color": theme.primary, "fill-opacity": 0.11, "fill-outline-color": theme.primary }
      },
      {
        id: "operational-landmarks", type: "circle", source: "osm", "source-layer": "poi", minzoom: 12,
        filter: ["in", ["get", "class"], ["literal", ["hospital", "clinic", "police", "fire_station", "harbor"]]],
        paint: { "circle-color": ["match", ["get", "class"], ["hospital", "clinic"], theme.motorway, ["police", "fire_station"], theme.primary, theme.rail], "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2, 16, 5], "circle-stroke-color": theme.textHalo, "circle-stroke-width": 1.5 }
      }
    ],
    grid: [{
      id: "coordinate-grid", type: "line", source: "coordinate-grid", minzoom: 14,
      layout: { visibility: "none" },
      paint: { "line-color": theme.primary, "line-width": 0.8, "line-dasharray": [2, 3], "line-opacity": 0.24 }
    }]
  } : { urban: [], coastline: [], landmarks: [], grid: [] };

  return {
    version: 8,
    name: theme.name,
    metadata: {
      "map-room:theme": id,
      "map-room:tileset-schema": "openmaptiles-3.16",
      "map-room:style-version": "1.0.0",
      ...(theme.tactical ? {
        "map-room:description": theme.description,
        "map-room:variant-of": "cyberpunk"
      } : {})
    },
    sources: {
      osm: { type: "vector", url: "mbtiles://{osm}" },
      ...(theme.tactical ? { "coordinate-grid": { type: "geojson", data: { type: "FeatureCollection", features: [] } } } : {})
    },
    glyphs: "{fontstack}/{range}.pbf",
    layers: [
      { id: "background", type: "background", paint: { "background-color": theme.background } },
      ...tacticalLayers.urban,
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
      ...tacticalLayers.coastline,
      ...glowLayers.filter(({ id: layerId }) => layerId === "waterway-glow"),
      { id: "waterways", type: "line", source: "osm", "source-layer": "waterway", paint: { "line-color": theme.waterLine, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 15, 2.2] } },
      {
        id: "buildings", type: "fill", source: "osm", "source-layer": "building", minzoom: 13,
        paint: { "fill-color": theme.building, "fill-outline-color": theme.buildingOutline, "fill-opacity": 0.9 }
      },
      {
        id: "boundaries", type: "line", source: "osm", "source-layer": "boundary",
        paint: { "line-color": theme.boundary, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.5, 12, 1.6], "line-dasharray": [4, 2], "line-opacity": 0.8 }
      },
      ...glowLayers.filter(({ id: layerId }) => layerId === "roads-glow"),
      {
        id: "roads-casing", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "path", "track"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.roadCasing, "line-width": selectedRoadCasingWidth, "line-opacity": 0.95 }
      },
      {
        id: "roads", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service", "path", "track"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": roadColor(theme), "line-width": selectedRoadWidth }
      },
      ...glowLayers.filter(({ id: layerId }) => layerId === "rail-glow"),
      {
        id: "rail", type: "line", source: "osm", "source-layer": "transportation",
        filter: ["==", ["get", "class"], "rail"],
        paint: { "line-color": theme.rail, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 15, 2], "line-dasharray": [3, 2] }
      },
      ...tacticalLayers.landmarks,
      ...tacticalLayers.grid,
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
