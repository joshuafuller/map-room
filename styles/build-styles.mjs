import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSpriteAtlas } from "./build-sprite.mjs";

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
    waterText: "#356c89",
    symbols: {
      markerFill: "#ffffff", shieldFill: "#ffffff", frame: "#293038", shadow: "#fbfaf7",
      emergency: "#c52f58", service: "#00748a", utility: "#9a6800", leisure: "#6946a5",
      onMarker: "#202830", onLight: "#202830", lightFill: "#ffffff"
    }
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
    waterText: "#79b9d4",
    symbols: {
      markerFill: "#101820", shieldFill: "#101820", frame: "#e2e8ec", shadow: "#0c1117",
      emergency: "#f08a74", service: "#55c8dc", utility: "#e1c45a", leisure: "#a98be0",
      onMarker: "#f4f7f9", onLight: "#182028", lightFill: "#f4f7f9"
    }
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
    glow: true,
    extrusion: {
      colors: [0, "#211d3e", 30, "#2d3469", 100, "#6438a5", 220, "#ff2aa3"],
      light: "#d8ccff"
    },
    symbols: {
      markerFill: "#060711", shieldFill: "#060711", frame: "#f4f7ff", shadow: "#03040b",
      emergency: "#ff2aa3", service: "#00e5ff", utility: "#f7e65b", leisure: "#9d5cff",
      onMarker: "#f4f7ff", onLight: "#080912", lightFill: "#f4f7ff"
    }
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
    tactical: true,
    extrusion: {
      colors: [0, "#151a35", 30, "#193454", 100, "#176278", 220, "#00dff7"],
      light: "#8feeff"
    },
    symbols: {
      markerFill: "#060711", shieldFill: "#03040b", frame: "#f6f8ff", shadow: "#03040b",
      emergency: "#ff2a9f", service: "#00eaff", utility: "#f2dc58", leisure: "#8c62f4",
      onMarker: "#f6f8ff", onLight: "#03040b", lightFill: "#f6f8ff"
    }
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

const extrusionColor = (theme) => [
  "interpolate", ["linear"], ["coalesce", ["get", "render_height"], 3],
  ...theme.extrusion.colors
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

  const featureLayers = {
    urban: theme.tactical ? [{
      id: "urban-glow", type: "circle", source: "osm", "source-layer": "place", maxzoom: 11,
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      paint: {
        "circle-color": ["match", ["get", "class"], "city", theme.motorway, theme.primary],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4, 8, 25, 11, 42],
        "circle-blur": 0.92,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.04, 8, 0.12, 11, 0]
      }
    }] : [],
    coastline: theme.tactical ? [{
      id: "coastline-glow", type: "line", source: "osm", "source-layer": "water",
      paint: { "line-color": theme.waterLine, "line-width": 5, "line-blur": 5, "line-opacity": 0.28 }
    }] : [],
    landmarks: [
      {
        id: "airports", type: "fill", source: "osm", "source-layer": "aeroway", minzoom: 8,
        filter: ["in", ["get", "class"], ["literal", ["aerodrome", "heliport"]]],
        paint: { "fill-color": theme.primary, "fill-opacity": 0.11, "fill-outline-color": theme.primary }
      },
      ...(theme.glow ? [{
        id: "runway-glow", type: "line", source: "osm", "source-layer": "aeroway", minzoom: 9,
        filter: ["==", ["get", "class"], "runway"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.primary, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 5, 16, 18], "line-blur": 5, "line-opacity": 0.28 }
      }] : []),
      {
        id: "runways", type: "line", source: "osm", "source-layer": "aeroway", minzoom: 9,
        filter: ["==", ["get", "class"], "runway"],
        layout: { "line-cap": "square", "line-join": "round" },
        paint: { "line-color": theme.text, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.2, 14, 4, 18, 9], "line-opacity": 0.92 }
      },
      {
        id: "taxiways", type: "line", source: "osm", "source-layer": "aeroway", minzoom: 12,
        filter: ["==", ["get", "class"], "taxiway"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.primary, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.65, 18, 3.2], "line-opacity": 0.48 }
      },
      {
        id: "operational-landmarks", type: "circle", source: "osm", "source-layer": "poi", minzoom: 12,
        filter: ["in", ["get", "class"], ["literal", ["hospital", "clinic", "police", "fire_station", "harbor"]]],
        paint: { "circle-color": ["match", ["get", "class"], ["hospital", "clinic"], theme.motorway, ["police", "fire_station"], theme.primary, theme.rail], "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2, 16, 5], "circle-stroke-color": theme.textHalo, "circle-stroke-width": 1.5 }
      }
    ],
    grid: theme.tactical ? [{
      id: "coordinate-grid", type: "line", source: "coordinate-grid", minzoom: 14,
      layout: { visibility: "none" },
      paint: { "line-color": theme.primary, "line-width": 0.8, "line-dasharray": [2, 3], "line-opacity": 0.24 }
    }] : [],
    symbols: [
      {
        id: "road-shields", type: "symbol", source: "osm", "source-layer": "transportation_name", minzoom: 8,
        filter: ["any", ["has", "ref"], ["has", "route_1_ref"]],
        layout: {
          "symbol-placement": "line", "symbol-spacing": 320,
          "icon-image": ["match", ["coalesce", ["get", "route_1_network"], ["get", "network"], ""],
            ["US:I", "us-interstate"], "shield-interstate", ["US:US", "us-highway"], "shield-us",
            ["US:FL", "us-state"], "shield-state", "US:FL:CR", "shield-county", "shield-state"],
          "icon-size": 0.86, "icon-rotation-alignment": "viewport",
          "text-field": ["coalesce", ["get", "route_1_ref"], ["get", "ref"]],
          "text-font": ["Open Sans Semibold"],
          "text-size": [
            "step", ["length", ["to-string", ["coalesce", ["get", "route_1_ref"], ["get", "ref"], ""]]],
            17, 3, 15, 5, 13.5
          ],
          "text-rotation-alignment": "viewport", "text-allow-overlap": false
        },
        paint: {
          "text-color": ["match", ["coalesce", ["get", "route_1_network"], ["get", "network"], ""], ["US:US", "us-highway"], theme.symbols.onLight, theme.symbols.onMarker],
          "text-halo-color": ["match", ["coalesce", ["get", "route_1_network"], ["get", "network"], ""], ["US:US", "us-highway"], theme.symbols.lightFill, theme.symbols.shieldFill],
          "text-halo-width": ["match", ["coalesce", ["get", "route_1_network"], ["get", "network"], ""], ["US:US", "us-highway"], 0.4, 1.25]
        }
      },
      {
        id: "poi-essential", type: "symbol", source: "osm", "source-layer": "poi", minzoom: 12,
        filter: ["in", ["get", "class"], ["literal", ["hospital", "clinic", "fire_station", "police", "fuel", "harbor"]]],
        layout: {
          visibility: "visible", "icon-image": ["match", ["get", "class"], ["hospital", "clinic"], "poi-medical", "fire_station", "poi-fire", "police", "poi-police", "fuel", "poi-fuel", "poi-port"],
          "icon-size": 1.15, "icon-allow-overlap": false,
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]], "text-font": ["Open Sans Semibold"], "text-size": 11,
          "text-offset": [0, 2], "text-anchor": "top", "text-optional": true
        },
        paint: { "text-color": theme.text, "text-halo-color": theme.textHalo, "text-halo-width": 1.6 }
      },
      {
        id: "poi-airports", type: "symbol", source: "osm", "source-layer": "aeroway", minzoom: 10, maxzoom: 12,
        filter: ["in", ["get", "class"], ["literal", ["aerodrome", "heliport"]]],
        layout: { visibility: "visible", "icon-image": "poi-airport", "icon-size": 1.1, "text-field": ["get", "ref"], "text-font": ["Open Sans Semibold"], "text-size": 11, "text-offset": [0, 2], "text-anchor": "top" },
        paint: { "text-color": theme.primary, "text-halo-color": theme.textHalo, "text-halo-width": 1.5 }
      },
      {
        id: "poi-explore", type: "symbol", source: "osm", "source-layer": "poi", minzoom: 13,
        filter: ["in", ["get", "class"], ["literal", ["restaurant", "fast_food", "lodging", "museum", "attraction", "grocery", "shop", "parking"]]],
        layout: {
          visibility: "none", "icon-image": ["match", ["get", "class"], ["restaurant", "fast_food"], "poi-food", "lodging", "poi-lodging", ["museum", "attraction"], "poi-attraction", ["grocery", "shop"], "poi-shopping", "poi-parking"],
          "icon-size": 1.08, "icon-allow-overlap": false,
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]], "text-font": ["Open Sans Semibold"], "text-size": 10.5,
          "text-offset": [0, 1.9], "text-anchor": "top", "text-optional": true
        },
        paint: { "text-color": theme.text, "text-halo-color": theme.textHalo, "text-halo-width": 1.5 }
      }
    ]
  };

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
    sprite: `/styles/${id}/sprite`,
    ...(theme.extrusion ? {
      light: { anchor: "viewport", color: theme.extrusion.light, intensity: 0.72, position: [1.15, 210, 35] }
    } : {}),
    layers: [
      { id: "background", type: "background", paint: { "background-color": theme.background } },
      ...featureLayers.urban,
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
      ...featureLayers.coastline,
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
      ...featureLayers.landmarks,
      ...(theme.glow ? [{
        id: "buildings-3d", type: "fill-extrusion", source: "osm", "source-layer": "building", minzoom: 13,
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": extrusionColor(theme),
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 3],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.94,
          "fill-extrusion-vertical-gradient": true
        }
      }] : []),
      ...featureLayers.grid,
      ...featureLayers.symbols,
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
  await buildSpriteAtlas(dirname(output), theme.symbols);
  console.log(`wrote ${output}`);
}
