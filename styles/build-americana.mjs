import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { withRealBuildingExtrusion } from "./building-extrusion.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const upstreamDirectory = join(here, "vendor", "americana");
const upstream = "https://github.com/osm-americana/openstreetmap-americana";
const upstreamCommit = "6098606aae8119de34a5de08e7bedc1ffdd712a8";
const fontMap = new Map([
  ["Americana-Regular", "Open Sans Regular"],
  ["Americana-Bold", "Open Sans Semibold"],
  ["Americana-Italic", "Open Sans Italic"],
  ["Americana-Bold-Italic", "Open Sans Italic"]
]);
const poiMinimumZooms = new Map([
  ["bus_stop", 17], ["tram_stop", 17],
  ["college", 16], ["university", 16], ["kindergarten", 16], ["school", 16],
  ["library", 16], ["museum", 16],
  ["bar", 17], ["pub", 17], ["cafe", 17], ["restaurant", 17], ["fast_food", 17],
  ["supermarket", 17], ["hotel", 17], ["motel", 17], ["guest_house", 17], ["hostel", 17],
  ["buddhist", 17], ["christian", 17], ["hindu", 17], ["jewish", 17], ["muslim", 17],
  ["sikh", 17], ["shinto", 17], ["taoist", 17], ["unitarian_universalist", 17],
  ["parking", 18]
]);

function localize(value) {
  if (typeof value === "string") return fontMap.get(value) ?? value;
  if (Array.isArray(value)) return value.map(localize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, localize(entry)]));
}

function staticPoiImages(value) {
  if (typeof value === "string") {
    const match = /^poi\nsprite=([^\n]+)/.exec(value);
    return match?.[1] ?? value;
  }
  if (Array.isArray(value)) return value.map(staticPoiImages);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, staticPoiImages(entry)]));
}

function deferDensePois(value) {
  if (!Array.isArray(value)) return value;
  const result = value.map(deferDensePois);
  if (result[0] !== "match") return result;
  for (let index = 2; index < result.length - 1; index += 2) {
    if (typeof result[index + 1] !== "number") continue;
    const labels = Array.isArray(result[index]) ? result[index] : [result[index]];
    const required = Math.max(0, ...labels.map((label) => poiMinimumZooms.get(label) ?? 0));
    if (required) result[index + 1] = Math.max(result[index + 1], required);
  }
  return result;
}

function rasterShieldLayer(layer) {
  const network = ["coalesce", ["get", "route_1_network"], ["get", "network"], ""];
  const reference = ["to-string", ["coalesce", ["get", "route_1_ref"], ["get", "ref"], ""]];
  const wide = [">=", ["length", reference], 3];
  const icon = (normal, expanded) => ["case", wide, expanded, normal];
  return {
    ...layer,
    filter: ["any", ["has", "route_1_ref"], ["has", "ref"]],
    layout: {
      "symbol-placement": "line",
      "symbol-spacing": 280,
      "icon-rotation-alignment": "viewport",
      "text-rotation-alignment": "viewport",
      "icon-image": ["match", network,
        "US:I", icon("shield_us_interstate_2", "shield_us_interstate_3"),
        "US:US", icon("shield_badge_2", "shield_badge_3"),
        "US:FL", icon("shield_us_fl_2", "shield_us_fl_3"),
        icon("shield_badge_2", "shield_badge_3")
      ],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 6, 1, 13, 1.25],
      "icon-allow-overlap": false,
      "text-field": reference,
      "text-font": ["Open Sans Semibold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 6,
        ["step", ["length", reference], 10, 3, 9, 4, 8],
        13, ["step", ["length", reference], 13, 3, 12, 4, 10]
      ],
      "text-offset": ["match", network, "US:I", ["literal", [0, 0.16]], ["literal", [0, 0]]],
      "text-allow-overlap": false
    },
    paint: {
      "text-color": ["match", network, "US:I", "#ffffff", "#000000"],
      "text-halo-color": ["match", network, "US:I", "#003f87", "#ffffff"],
      "text-halo-width": 0.35
    }
  };
}

export async function loadAmericanaShieldLayer({ id = "highway-shield" } = {}) {
  const source = JSON.parse(await readFile(join(upstreamDirectory, "style.json"), "utf8"));
  const shield = source.layers.find((layer) => layer.id === "highway-shield");
  if (!shield) throw new Error("Pinned Americana style does not contain its highway shield layer");
  return {
    ...localize(structuredClone(shield)),
    id,
    source: "osm"
  };
}

export async function copyAmericanaSpriteAtlas(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  for (const file of ["sprite.json", "sprite.png", "sprite@2x.json", "sprite@2x.png"]) {
    await copyFile(join(upstreamDirectory, "sprites", file), join(outputDirectory, file));
  }
}

export async function buildAmericanaDaylight() {
  const source = JSON.parse(await readFile(join(upstreamDirectory, "style.json"), "utf8"));
  const outputDirectory = join(here, "daylight");
  const style = localize(source);

  style.metadata = {
    "map-room:theme": "daylight",
    "map-room:tileset-schema": "openmaptiles-3.16",
    "map-room:style-version": "1.0.0",
    "map-room:upstream": upstream,
    "map-room:upstream-commit": upstreamCommit,
    "map-room:license": "CC0-1.0",
    "map-room:font-adaptation": "Americana font families mapped to locally packaged Open Sans glyphs"
  };
  style.sources = {
    osm: {
      type: "vector",
      url: "mbtiles://{osm}",
      attribution: "© OpenMapTiles © OpenStreetMap contributors"
    }
  };
  style.sprite = "{styleJsonFolder}/sprite";
  style.glyphs = "{fontstack}/{range}.pbf";
  style.layers = style.layers
    .filter((layer) => layer.source !== "dem")
    .map((layer) => {
      if (layer.source === "openmaptiles") layer.source = "osm";
      if (layer.id === "building") {
        layer.id = "buildings-3d";
        layer.layout = { ...layer.layout, visibility: "visible" };
        layer.paint = withRealBuildingExtrusion(layer.paint);
      }
      return layer;
    });
  const poiLayer = style.layers.find((layer) => layer.id === "poi");
  if (poiLayer) poiLayer.filter = deferDensePois(poiLayer.filter);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "style.json"), `${JSON.stringify(style)}\n`);
  await copyAmericanaSpriteAtlas(outputDirectory);
  await copyFile(join(upstreamDirectory, "sprites", "sprite.json"), join(outputDirectory, "atak-sprite.json"));
  await copyFile(join(upstreamDirectory, "sprites", "sprite.png"), join(outputDirectory, "atak-sprite.png"));

  const browserShieldLayer = await loadAmericanaShieldLayer({ id: "road-shields" });
  await writeFile(join(here, "..", "web", "vendor", "americana-shield-layer.json"), `${JSON.stringify(browserShieldLayer)}\n`);

  const rasterDirectory = join(here, "daylight-raster");
  const rasterStyle = staticPoiImages(structuredClone(style));
  rasterStyle.name = "Americana Daylight — Server-rendered";
  rasterStyle.metadata = { ...rasterStyle.metadata, "map-room:renderer": "tileserver-gl" };
  rasterStyle.layers = rasterStyle.layers.map((layer) => layer.id === "highway-shield" ? rasterShieldLayer(layer) : layer);
  await mkdir(rasterDirectory, { recursive: true });
  await writeFile(join(rasterDirectory, "style.json"), `${JSON.stringify(rasterStyle)}\n`);
  await copyAmericanaSpriteAtlas(rasterDirectory);
}
