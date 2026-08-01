import * as maplibregl from "/vendor/maplibre-gl.mjs";
import { buildAtakXml, RASTER_MAX_ZOOM } from "/atak.js";
import { buildCoordinateGrid } from "/grid.js";

const themes = {
  daylight: { name: "Daylight", color: "#f4f1ea" },
  midnight: { name: "Midnight", color: "#101820" },
  cyberpunk: { name: "Cyberpunk Classic", color: "#060711" },
  "cyberpunk-tactical": { name: "Cyberpunk Tactical", color: "#03040b" }
};

let activeTheme = "daylight";
let activeMode = "vector";
let gridEnabled = false;
let manifest = null;
try {
  const response = await fetch("/manifest.json", { cache: "no-store" });
  manifest = await response.json();
  document.querySelector("#region").textContent = manifest.region;
  const date = new Date(manifest.sourceTimestamp);
  document.querySelector("#freshness").textContent = `OSM data ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  if (manifest.testTile) {
    document.querySelectorAll(".swatch").forEach((swatch) => {
      const id = swatch.closest("[data-theme]")?.dataset.theme;
      if (!id) return;
      swatch.style.backgroundImage = `linear-gradient(rgba(3, 4, 11, .08), rgba(3, 4, 11, .08)), url("/styles/${id}/${manifest.testTile}.png")`;
      swatch.classList.add("has-preview");
    });
  }
} catch {
  document.querySelector("#freshness").textContent = "Freshness unavailable";
  document.querySelector(".status-dot").style.background = "#c78d42";
}

const map = new maplibregl.Map({
  container: "map",
  style: "/styles/daylight/style.json",
  center: manifest?.displayCenter ?? manifest?.center?.slice(0, 2) ?? [0, 0],
  zoom: manifest?.displayZoom ?? manifest?.center?.[2] ?? 2,
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
        tiles: [`${window.location.origin}/styles/${id}/{z}/{x}/{y}.png`],
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
    ? `/styles/${activeTheme}/style.json`
    : rasterStyle(activeTheme);
  map.setStyle(style);
  map.once("style.load", updateCoordinateGrid);
  document.documentElement.style.colorScheme = activeTheme === "daylight" ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]').content = themes[activeTheme].color;
  document.documentElement.dataset.mapTheme = activeTheme;
  updateGridControl();
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

document.querySelectorAll(".theme").forEach((button) => {
  button.addEventListener("click", () => selectTheme(button.dataset.theme));
});

document.querySelectorAll(".mode").forEach((button) => {
  button.addEventListener("click", () => selectMode(button.dataset.mode));
});

document.querySelector("#atak-download").addEventListener("click", () => {
  const blob = new Blob([buildAtakXml(activeTheme, window.location.origin)], { type: "application/xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `map-room-${activeTheme}.xml`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("ATAK map source downloaded");
});

document.querySelector("#copy-raster").addEventListener("click", async () => {
  await navigator.clipboard.writeText(`${window.location.origin}/styles/${activeTheme}/{z}/{x}/{y}.png`);
  toast("Raster tile URL copied");
});

document.querySelector("#grid-toggle").addEventListener("click", () => {
  gridEnabled = !gridEnabled;
  updateGridControl();
  updateCoordinateGrid();
  toast(gridEnabled ? "Coordinate grid enabled" : "Coordinate grid disabled");
});

map.on("moveend", updateCoordinateGrid);
