import * as maplibregl from "/vendor/maplibre-gl.mjs";
import { buildAtakXml } from "/atak.js";

const themes = {
  daylight: { name: "Daylight", color: "#f4f1ea" },
  midnight: { name: "Midnight", color: "#101820" }
};

let activeTheme = "daylight";
let activeMode = "vector";
let manifest = null;
try {
  const response = await fetch("/manifest.json", { cache: "no-store" });
  manifest = await response.json();
  document.querySelector("#region").textContent = manifest.region;
  const date = new Date(manifest.sourceTimestamp);
  document.querySelector("#freshness").textContent = `OSM data ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
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
        maxzoom: 14,
        attribution: "© OpenMapTiles © OpenStreetMap contributors"
      }
    },
    layers: [{ id: "atak-raster", type: "raster", source: "atak" }]
  };
}

function applyMapStyle() {
  const style = activeMode === "vector"
    ? `/styles/${activeTheme}/style.json`
    : rasterStyle(activeTheme);
  map.setStyle(style);
  document.documentElement.style.colorScheme = activeTheme === "midnight" ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = themes[activeTheme].color;
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
