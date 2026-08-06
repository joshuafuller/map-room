import * as maplibregl from "/vendor/maplibre-gl.mjs";
import { buildAtakVectorDescriptor, buildAtakXml, RASTER_MAX_ZOOM, RASTER_PIXEL_RATIO } from "/atak.js";
import { buildAtakImportUri, isLoopbackMapRoomUrl, normalizeAtakServerUrl } from "/atak-import.js";
import { buildAtakVectorStyle } from "/atak-vector.js";
import { buildingLayerIds } from "/buildings.js";
import { poiLayerIds, poiLayerVisibility } from "/poi-visibility.js";
import { setupMapManager } from "/map-manager.js";
import { loadMapStyle, versionMapAssetRequest } from "/map-assets.js";
import { renderQrSvg } from "/qr-code.js";
import { setupAmericana } from "/americana.js";

const themes = {
  daylight: { name: "Daylight", color: "#f4f1ea" },
  midnight: { name: "Midnight", color: "#101820" },
  "dark-blue": { name: "Dark Blue", color: "#07111f" },
  "dark-red": { name: "Dark Red", color: "#160909" },
  "dark-green": { name: "Dark Green", color: "#07120d" },
  cyberpunk: { name: "Cyberpunk Classic", color: "#060711" },
  "cyberpunk-tactical": { name: "Cyberpunk Tactical", color: "#03040b" }
};

let activeTheme = "daylight";
let activeMode = "vector";
let activeView = "all";
let buildings3dEnabled = true;
const regionCatalog = new Map();
let manifest = null;
let map = null;
let hasMaps = false;
const allViewPadding = () => window.innerWidth <= 680
  ? { top: 80, right: 40, bottom: 190, left: 40 }
  : { top: 90, right: 340, bottom: 70, left: 70 };
const panel = document.querySelector(".panel");
const panelToggle = document.querySelector("#panel-toggle");

function setPanelExpanded(expanded) {
  panel.classList.toggle("collapsed", !expanded);
  panelToggle.setAttribute("aria-expanded", String(expanded));
  panelToggle.setAttribute("aria-label", expanded ? "Close map controls" : "Open map controls");
  document.documentElement.dataset.controlsExpanded = String(expanded);
}

setPanelExpanded(false);
panelToggle.addEventListener("click", () => setPanelExpanded(panelToggle.getAttribute("aria-expanded") !== "true"));

function styleId(theme = activeTheme) {
  return `all-${theme}`;
}

function rasterStyleId(theme = activeTheme) {
  return styleId(theme === "daylight" ? "daylight-raster" : theme);
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

function vectorPublication() {
  return activeView === "all" ? null : regionCatalog.get(activeView);
}

function updateAtakVectorPresentation() {
  const publication = vectorPublication();
  const sourceButton = document.querySelector("#atak-vector-source");
  const shareButton = document.querySelector("#atak-vector-share");
  const styleButton = document.querySelector("#atak-vector-style");
  const archiveLink = document.querySelector("#atak-vector-map");
  const instructions = document.querySelector("#atak-vector-instructions");
  const offlineMessage = document.querySelector("#offline-message");
  sourceButton.disabled = !publication;
  shareButton.disabled = !publication;
  styleButton.disabled = !publication;
  archiveLink.hidden = !publication;
  if (!publication) {
    sourceButton.textContent = "Select one region above";
    shareButton.textContent = "Select one region above";
    instructions.textContent = "Choose an individual published map above. Map Room will generate a tiny ATAK source document that streams PBF tiles and can cache an area offline.";
    offlineMessage.textContent = "Select one region above to download its complete vector archive.";
    return;
  }
  const name = publication.name ?? publication.region;
  shareButton.textContent = `Add ${name} to ATAK / show QR`;
  sourceButton.textContent = `Download ${name} source (.json)`;
  archiveLink.href = `/atak/vector/${publication.id}.mbtiles`;
  archiveLink.download = `map-room-${publication.id}-vector.mbtiles`;
  archiveLink.textContent = `Download ${name} archive (.mbtiles)`;
  offlineMessage.textContent = `${name} will be copied as one ${formatBytes(publication.archiveBytes)} archive; Map Room is not needed after a successful ATAK import.`;
  instructions.innerHTML = `Import the small vector-source JSON in ATAK, then open that layer's options, select <strong>Set Layer Style</strong>, choose <strong>Import File</strong>, and import the Cyberpunk style. Open this page through the Map Room computer's LAN address, not localhost. ATAK may cache a selected area for offline use without downloading the complete archive.`;
}

const emptyStyle = { version: 8, name: "Empty Map Room", sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#dfe5e7" } }] };

async function loadRegionCatalog({ refreshMap = false } = {}) {
  const response = await fetch("/regions.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Region catalog returned HTTP ${response.status}`);
  const catalog = await response.json();
  hasMaps = catalog.regions.length > 0;
  document.querySelector("#atak-raster-share").disabled = !hasMaps;
  regionCatalog.clear();
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
  selector.replaceChildren();
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
  if (!regionCatalog.has(activeView)) activeView = "all";
  manifest = regionCatalog.get(activeView);
  selector.value = activeView;
  selector.disabled = catalog.regions.length === 0;
  updateRegionPresentation();
  updateAtakVectorPresentation();
  if (refreshMap && map) {
    applyMapStyle();
    if (manifest.bounds) map.fitBounds(manifest.bounds, { padding: allViewPadding(), duration: 0 });
    else map.jumpTo({ center: [0, 0], zoom: 2 });
  }
}

try {
  await loadRegionCatalog();
} catch {
  document.querySelector("#region-select").hidden = true;
  document.querySelector("#freshness").textContent = "Freshness unavailable";
  document.querySelector(".status-dot").style.background = "#c78d42";
}

const initialMapStyle = hasMaps
  ? await loadMapStyle(`/styles/${styleId("daylight")}/style.json`)
  : emptyStyle;

map = new maplibregl.Map({
  container: "map",
  style: initialMapStyle,
  center: manifest?.displayCenter ?? manifest?.center?.slice(0, 2) ?? [0, 0],
  zoom: manifest?.displayZoom ?? manifest?.center?.[2] ?? 2,
  bounds: manifest?.id === "all" ? manifest.bounds : undefined,
  fitBoundsOptions: { padding: allViewPadding() },
  hash: true,
  dragRotate: true,
  pitchWithRotate: true,
  transformRequest: versionMapAssetRequest
});

setupAmericana(map);
map.once("load", () => {
  document.documentElement.dataset.loadedMapTheme = activeTheme;
  updateBuildingLayers();
  updatePoiLayers();
});

map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

const toast = (message) => {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 1800);
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "regional";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

function rasterStyle(id) {
  return {
    version: 8,
    name: `${themes[id].name} — ATAK Raster Preview`,
    sources: {
      atak: {
        type: "raster",
        tiles: [`${window.location.origin}/styles/${rasterStyleId(id)}/{z}/{x}/{y}${RASTER_PIXEL_RATIO}.png`],
        tileSize: 256,
        minzoom: 0,
        maxzoom: RASTER_MAX_ZOOM,
        attribution: "© OpenMapTiles © OpenStreetMap contributors"
      }
    },
    layers: [{ id: "atak-raster", type: "raster", source: "atak" }]
  };
}

function updateBuildingControl() {
  const button = document.querySelector("#buildings-toggle");
  button.hidden = activeMode !== "vector";
  button.setAttribute("aria-pressed", String(buildings3dEnabled));
  document.querySelector("#rotate-hint").hidden = activeMode !== "vector";
}

function updateBuildingLayers() {
  for (const layerId of buildingLayerIds(map.getStyle())) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", buildings3dEnabled ? "visible" : "none");
    }
  }
}

function updatePoiLayers() {
  if (activeMode !== "vector") return;
  for (const layer of ["poi-essential", "poi-explore", "poi-parking"]) {
    const hudLayer = `${layer}-hud`;
    for (const layerId of poiLayerIds(map.getStyle(), layer)) {
      map.setLayoutProperty(layerId, "visibility", poiLayerVisibility({ enabled: true, buildings3dEnabled, hud: false }));
    }
    for (const layerId of poiLayerIds(map.getStyle(), hudLayer)) {
      map.setLayoutProperty(layerId, "visibility", poiLayerVisibility({ enabled: true, buildings3dEnabled, hud: true }));
    }
  }
  for (const layerId of poiLayerIds(map.getStyle(), "poi-airports-hud")) {
    map.setLayoutProperty(layerId, "visibility", buildings3dEnabled ? "visible" : "none");
  }
}

let styleRequestId = 0;

async function applyMapStyle() {
  const requestId = ++styleRequestId;
  const requestedTheme = activeTheme;
  const style = !hasMaps ? emptyStyle : activeMode === "vector"
    ? await loadMapStyle(`/styles/${styleId()}/style.json`)
    : rasterStyle(activeTheme);
  if (requestId !== styleRequestId) return;
  map.once("style.load", () => {
    updateBuildingLayers();
    updatePoiLayers();
    document.documentElement.dataset.loadedMapTheme = requestedTheme;
  });
  map.setStyle(style);
  document.documentElement.style.colorScheme = activeTheme === "daylight" ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]').content = themes[activeTheme].color;
  document.documentElement.dataset.mapTheme = activeTheme;
  updateBuildingControl();
  document.querySelector("#detail-hint").hidden = activeMode !== "vector";
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
  document.querySelector("#atak-vector-style").textContent = `2. Download ${themes[id].name} style (.json)`;
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
  updateAtakVectorPresentation();
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

const atakShareDialog = document.querySelector("#atak-share-dialog");
const atakServerStorageKey = "map-room-atak-server-url";
let pendingAtakShareKind = null;

function atakDefinitionPath(kind, publication) {
  return kind === "vector"
    ? `/api/atak/vector/${publication.id}.json`
    : `/api/atak/raster/${activeTheme}.xml`;
}

async function verifyAndRenderAtakShare(kind, rawServerUrl) {
  const publication = vectorPublication();
  const setup = document.querySelector("#atak-server-setup");
  const status = document.querySelector("#atak-server-status");
  const content = document.querySelector("#atak-share-content");
  status.textContent = "Checking the hosted setup file…";
  try {
    const serverUrl = normalizeAtakServerUrl(rawServerUrl);
    const path = atakDefinitionPath(kind, publication);
    const definitionUrl = `${serverUrl}${path}`;
    const response = await fetch(definitionUrl, { cache: "no-store" });
    const expectedType = kind === "vector" ? "application/json" : "application/xml";
    if (!response.ok || !response.headers.get("content-type")?.startsWith(expectedType)) {
      throw new Error(`Map Room did not return the expected ${kind} setup file`);
    }
    localStorage.setItem(atakServerStorageKey, serverUrl);
    document.querySelector("#atak-server-url").value = serverUrl;
    const importUri = buildAtakImportUri(definitionUrl);
    document.querySelector("#atak-share-qr").innerHTML = renderQrSvg(importUri);
    document.querySelector("#atak-add-link").href = importUri;
    document.querySelector("#atak-share-link").value = importUri;
    const definitionLink = document.querySelector("#atak-definition-link");
    definitionLink.href = definitionUrl;
    definitionLink.download = kind === "vector"
      ? `map-room-${publication.id}-atak-vector.json`
      : `map-room-${activeTheme}.xml`;
    const name = kind === "vector" ? (publication.name ?? publication.region) : themes[activeTheme].name;
    document.querySelector("#atak-share-details").textContent = kind === "vector"
      ? `This adds the small ${name} vector source. Keep Map Room reachable while streaming; then download and apply the selected style from the map controls.`
      : `This adds the ${name} raster source. Keep Map Room reachable because ATAK requests PNG tiles while you pan and zoom.`;
    document.querySelector("#atak-share-warning").hidden = true;
    setup.hidden = true;
    content.hidden = false;
  } catch (error) {
    content.hidden = true;
    setup.hidden = false;
    status.textContent = `${error.message}. Confirm this address opens Map Room from the ATAK device.`;
  }
}

async function openAtakShare(kind) {
  const publication = vectorPublication();
  if (kind === "vector" && !publication) return;
  pendingAtakShareKind = kind;

  const warning = document.querySelector("#atak-share-warning");
  const content = document.querySelector("#atak-share-content");
  const setup = document.querySelector("#atak-server-setup");
  const name = kind === "vector" ? (publication.name ?? publication.region) : themes[activeTheme].name;
  document.querySelector("#atak-share-title").textContent = `Add ${name} to ATAK`;
  atakShareDialog.showModal();
  content.hidden = true;

  if (isLoopbackMapRoomUrl(window.location.origin)) {
    warning.hidden = false;
    warning.innerHTML = `<strong>ATAK cannot use localhost.</strong> Enter the LAN address or DNS name that opens Map Room from the ATAK device. Map Room will check it before creating the QR.`;
    setup.hidden = false;
    const savedServerUrl = localStorage.getItem(atakServerStorageKey) ?? "";
    document.querySelector("#atak-server-url").value = savedServerUrl;
    document.querySelector("#atak-server-status").textContent = "The address stays in this browser and can be changed later.";
    if (savedServerUrl) await verifyAndRenderAtakShare(kind, savedServerUrl);
    return;
  }

  warning.hidden = true;
  setup.hidden = false;
  document.querySelector("#atak-server-status").textContent = "Checking this Map Room address…";
  await verifyAndRenderAtakShare(kind, window.location.origin);
}

document.querySelector("#atak-vector-share").addEventListener("click", () => openAtakShare("vector"));
document.querySelector("#atak-raster-share").addEventListener("click", () => openAtakShare("raster"));
document.querySelector("#atak-create-qr").addEventListener("click", () => {
  if (pendingAtakShareKind) verifyAndRenderAtakShare(pendingAtakShareKind, document.querySelector("#atak-server-url").value);
});
document.querySelector("#atak-change-server").addEventListener("click", () => {
  document.querySelector("#atak-share-content").hidden = true;
  document.querySelector("#atak-server-setup").hidden = false;
  const warning = document.querySelector("#atak-share-warning");
  warning.hidden = false;
  warning.innerHTML = `<strong>Choose the address ATAK will use.</strong> It must open this Map Room server from the ATAK device.`;
  document.querySelector("#atak-server-status").textContent = "The saved address will be replaced after the new setup file is verified.";
  document.querySelector("#atak-server-url").focus();
});
document.querySelector("#atak-share-close").addEventListener("click", () => atakShareDialog.close());
document.querySelector("#atak-copy-link").addEventListener("click", async () => {
  const input = document.querySelector("#atak-share-link");
  try {
    await navigator.clipboard.writeText(input.value);
    toast("ATAK setup link copied");
  } catch {
    input.select();
    toast("Select and copy the ATAK setup link");
  }
});

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

function downloadJson(payload, filename) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelector("#atak-vector-source").addEventListener("click", async () => {
  const publication = vectorPublication();
  if (!publication) return;
  const response = await fetch(`/data/${publication.id}.json`);
  if (!response.ok) throw new Error(`Could not load ${publication.name} TileJSON`);
  const tileJson = await response.json();
  const descriptor = buildAtakVectorDescriptor({
    publication,
    baseUrl: window.location.origin,
    tileJson
  });
  downloadJson(descriptor, `map-room-${publication.id}-atak-vector.json`);
  toast(`${publication.name} ATAK vector source downloaded`);
});

document.querySelector("#atak-vector-style").addEventListener("click", async () => {
  const publication = vectorPublication();
  if (!publication) return;
  const theme = activeTheme;
  const response = await fetch(`/styles/${theme}/style.json`);
  if (!response.ok) throw new Error(`Could not load ${theme} style`);
  const sourceStyle = await response.json();
  const style = buildAtakVectorStyle({
    theme,
    baseUrl: window.location.origin,
    sourceId: publication.id,
    sourceStyle
  });
  downloadJson(style, `map-room-${theme}-atak-vector.json`);
  toast(`${themes[theme].name} ATAK vector style downloaded`);
});

document.querySelector("#copy-raster").addEventListener("click", async () => {
  await navigator.clipboard.writeText(`${window.location.origin}/styles/${rasterStyleId()}/{z}/{x}/{y}${RASTER_PIXEL_RATIO}.png`);
  toast("Raster tile URL copied");
});

document.querySelector("#buildings-toggle").addEventListener("click", () => {
  buildings3dEnabled = !buildings3dEnabled;
  updateBuildingControl();
  updateBuildingLayers();
  updatePoiLayers();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  map.easeTo({
    zoom: buildings3dEnabled ? Math.max(map.getZoom(), 15) : map.getZoom(),
    pitch: buildings3dEnabled ? 58 : 0,
    bearing: buildings3dEnabled ? -18 : 0,
    duration: reduceMotion ? 0 : 650
  });
  toast(`3D buildings ${buildings3dEnabled ? "enabled" : "disabled"}`);
});

updateBuildingControl();
document.querySelector("#detail-hint").hidden = activeMode !== "vector";
setupMapManager({ onLibraryChanged: () => loadRegionCatalog({ refreshMap: true }) });
