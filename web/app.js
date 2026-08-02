import * as maplibregl from "/vendor/maplibre-gl.mjs";
import { buildAtakXml, RASTER_MAX_ZOOM, RASTER_PIXEL_RATIO } from "/atak.js";
import { buildCoordinateGrid } from "/grid.js";

const themes = {
  daylight: { name: "Daylight", color: "#f4f1ea" },
  midnight: { name: "Midnight", color: "#101820" },
  cyberpunk: { name: "Cyberpunk Classic", color: "#060711" },
  "cyberpunk-tactical": { name: "Cyberpunk Tactical", color: "#03040b" }
};

let activeTheme = "daylight";
let activeMode = "vector";
let activeView = "all";
let gridEnabled = false;
const poiPresets = { essential: true, explore: false };
const regionCatalog = new Map();
let manifest = null;
const allViewPadding = () => window.innerWidth <= 680
  ? { top: 80, right: 40, bottom: 190, left: 40 }
  : { top: 90, right: 340, bottom: 70, left: 70 };

function styleId(theme = activeTheme) {
  return `all-${theme}`;
}

function updateRegionPresentation() {
  if (!manifest) return;
  document.querySelector("#region").textContent = manifest.name ?? manifest.region;
  const date = new Date(manifest.sourceTimestamp);
  document.querySelector("#freshness").textContent = Number.isNaN(date.getTime())
    ? "Freshness unavailable"
    : `Map data ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  if (manifest.testTile) {
    document.querySelectorAll(".swatch").forEach((swatch) => {
      const id = swatch.closest("[data-theme]")?.dataset.theme;
      if (!id) return;
      swatch.style.backgroundImage = `linear-gradient(rgba(3, 4, 11, .08), rgba(3, 4, 11, .08)), url("/styles/${styleId(id)}/${manifest.testTile}.png")`;
      swatch.classList.add("has-preview");
    });
  }
}

try {
  const response = await fetch("/regions.json", { cache: "no-store" });
  const catalog = await response.json();
  manifest = {
    id: "all",
    name: catalog.name,
    bounds: catalog.bounds,
    displayCenter: catalog.center,
    displayZoom: catalog.displayZoom,
    testTile: catalog.previewTile,
    sourceTimestamp: catalog.sourceTimestamp
  };
  regionCatalog.set("all", manifest);
  const selector = document.querySelector("#region-select");
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = catalog.name;
  selector.append(allOption);
  for (const region of catalog.regions) {
    regionCatalog.set(region.id, region);
    const option = document.createElement("option");
    option.value = region.id;
    option.textContent = region.name ?? region.region;
    selector.append(option);
  }
  selector.value = activeView;
  selector.disabled = catalog.regions.length === 0;
  updateRegionPresentation();
} catch {
  document.querySelector("#region-select").hidden = true;
  document.querySelector("#freshness").textContent = "Freshness unavailable";
  document.querySelector(".status-dot").style.background = "#c78d42";
}

const map = new maplibregl.Map({
  container: "map",
  style: `/styles/${styleId("daylight")}/style.json`,
  center: manifest?.displayCenter ?? manifest?.center?.slice(0, 2) ?? [0, 0],
  zoom: manifest?.displayZoom ?? manifest?.center?.[2] ?? 2,
  bounds: manifest?.id === "all" ? manifest.bounds : undefined,
  fitBoundsOptions: { padding: allViewPadding() },
  hash: true
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

const toast = (message) => {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 1800);
};

function rasterStyle(id) {
  return {
    version: 8,
    name: `${themes[id].name} — ATAK Raster Preview`,
    sources: {
      atak: {
        type: "raster",
        tiles: [`${window.location.origin}/styles/${styleId(id)}/{z}/{x}/{y}${RASTER_PIXEL_RATIO}.png`],
        tileSize: 256,
        minzoom: 0,
        maxzoom: RASTER_MAX_ZOOM,
        attribution: "© OpenMapTiles © OpenStreetMap contributors"
      }
    },
    layers: [{ id: "atak-raster", type: "raster", source: "atak" }]
  };
}

function updateGridControl() {
  const button = document.querySelector("#grid-toggle");
  button.hidden = activeTheme !== "cyberpunk-tactical" || activeMode !== "vector";
  button.setAttribute("aria-pressed", String(gridEnabled));
}

function updatePoiControls() {
  document.querySelector("#poi-controls").hidden = activeMode !== "vector";
  document.querySelectorAll("[data-poi-preset]").forEach((button) => {
    button.setAttribute("aria-pressed", String(poiPresets[button.dataset.poiPreset]));
  });
}

function updatePoiLayers() {
  if (activeMode !== "vector") return;
  for (const [preset, enabled] of Object.entries(poiPresets)) {
    const layer = `poi-${preset}`;
    if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", enabled ? "visible" : "none");
  }
}

function updateCoordinateGrid() {
  if (activeTheme !== "cyberpunk-tactical" || activeMode !== "vector") return;
  const source = map.getSource("coordinate-grid");
  if (!source) return;
  const bounds = map.getBounds();
  source.setData(buildCoordinateGrid({
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth()
  }));
  map.setLayoutProperty("coordinate-grid", "visibility", gridEnabled ? "visible" : "none");
}

function applyMapStyle() {
  const style = activeMode === "vector"
    ? `/styles/${styleId()}/style.json`
    : rasterStyle(activeTheme);
  map.setStyle(style);
  map.once("style.load", () => {
    updateCoordinateGrid();
    updatePoiLayers();
  });
  document.documentElement.style.colorScheme = activeTheme === "daylight" ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]').content = themes[activeTheme].color;
  document.documentElement.dataset.mapTheme = activeTheme;
  updateGridControl();
  updatePoiControls();
}

function selectTheme(id) {
  if (!themes[id] || id === activeTheme) return;
  activeTheme = id;
  applyMapStyle();
  document.querySelectorAll(".theme").forEach((button) => {
    const selected = button.dataset.theme === id;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  toast(`${themes[id].name} map selected`);
}

function selectMode(mode) {
  if (!["vector", "raster"].includes(mode) || mode === activeMode) return;
  activeMode = mode;
  applyMapStyle();
  document.querySelectorAll(".mode").forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  document.querySelector("#mode-detail").textContent = mode === "raster"
    ? "The exact server-rendered PNG/XYZ tiles requested by ATAK."
    : "Interactive vector tiles rendered by your browser.";
  toast(mode === "raster" ? "ATAK raster preview enabled" : "Vector preview enabled");
}

function selectView(id) {
  const catalogRegion = regionCatalog.get(id);
  if (id === activeView || !catalogRegion) return;
  activeView = id;
  manifest = catalogRegion;
  updateRegionPresentation();
  if (id === "all" && manifest.bounds) {
    map.fitBounds(manifest.bounds, { padding: allViewPadding(), duration: 0 });
  } else {
    map.jumpTo({
      center: manifest.displayCenter ?? manifest.center?.slice(0, 2) ?? [0, 0],
      zoom: manifest.displayZoom ?? manifest.center?.[2] ?? 2
    });
  }
  toast(`${manifest.name ?? manifest.region} map selected`);
}

document.querySelectorAll(".theme").forEach((button) => {
  button.addEventListener("click", () => selectTheme(button.dataset.theme));
});

document.querySelectorAll(".mode").forEach((button) => {
  button.addEventListener("click", () => selectMode(button.dataset.mode));
});

document.querySelector("#region-select").addEventListener("change", (event) => selectView(event.target.value));

document.querySelector("#atak-download").addEventListener("click", () => {
  const blob = new Blob([buildAtakXml({
    theme: activeTheme,
    baseUrl: window.location.origin
  })], { type: "application/xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `map-room-${activeTheme}.xml`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("ATAK map source downloaded");
});

document.querySelector("#copy-raster").addEventListener("click", async () => {
  await navigator.clipboard.writeText(`${window.location.origin}/styles/${styleId()}/{z}/{x}/{y}${RASTER_PIXEL_RATIO}.png`);
  toast("Raster tile URL copied");
});

document.querySelector("#grid-toggle").addEventListener("click", () => {
  gridEnabled = !gridEnabled;
  updateGridControl();
  updateCoordinateGrid();
  toast(gridEnabled ? "Coordinate grid enabled" : "Coordinate grid disabled");
});

document.querySelectorAll("[data-poi-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    const preset = button.dataset.poiPreset;
    poiPresets[preset] = !poiPresets[preset];
    updatePoiControls();
    updatePoiLayers();
    toast(`${preset === "essential" ? "Essential" : "Explore"} intel ${poiPresets[preset] ? "enabled" : "disabled"}`);
  });
});

map.on("moveend", updateCoordinateGrid);
updatePoiControls();
