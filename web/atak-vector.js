const themeNames = {
  daylight: "Daylight",
  midnight: "Midnight",
  cyberpunk: "Cyberpunk Classic",
  "cyberpunk-tactical": "Cyberpunk Tactical"
};

const roadGroups = [
  { id: "motorway", classes: ["motorway", "trunk"], value: "motorway" },
  { id: "primary", classes: ["primary"], value: "primary" },
  { id: "secondary", classes: ["secondary"], value: "secondary" },
  { id: "tertiary", classes: ["tertiary"], value: "tertiary" },
  { id: "minor", classes: ["minor", "service"], value: "minor" },
  { id: "path", classes: ["path", "track"], value: "path" }
];

const poiGroups = {
  "poi-essential": [
    { id: "medical", classes: ["hospital", "clinic"], icon: "poi-medical" },
    { id: "fire", classes: ["fire_station"], icon: "poi-fire" },
    { id: "police", classes: ["police"], icon: "poi-police" },
    { id: "fuel", classes: ["fuel"], icon: "poi-fuel" },
    { id: "port", classes: ["harbor"], icon: "poi-port" }
  ],
  "poi-explore": [
    { id: "food", classes: ["restaurant", "fast_food"], icon: "poi-food" },
    { id: "lodging", classes: ["lodging"], icon: "poi-lodging" },
    { id: "attraction", classes: ["museum", "attraction"], icon: "poi-attraction" },
    { id: "shopping", classes: ["grocery", "shop"], icon: "poi-shopping" },
    { id: "parking", classes: ["parking"], icon: "poi-parking" }
  ]
};

function matchLabel(label, value) {
  return Array.isArray(label) ? label.includes(value) : label === value;
}

function resolveForClass(value, className) {
  if (!Array.isArray(value)) return value;
  if (value[0] === "match") {
    for (let index = 2; index < value.length - 1; index += 2) {
      if (matchLabel(value[index], className)) return resolveForClass(value[index + 1], className);
    }
    return resolveForClass(value.at(-1), className);
  }
  if (value[0] === "interpolate" && value[2]?.[0] === "zoom") {
    const stops = [];
    for (let index = 3; index < value.length; index += 2) {
      stops.push([value[index], resolveForClass(value[index + 1], className)]);
    }
    return { base: 1, stops };
  }
  return value;
}

function legacyFilter(filter) {
  if (!Array.isArray(filter)) return filter;
  const [operator, property, values] = filter;
  if (operator === "in" && property?.[0] === "get" && values?.[0] === "literal") {
    return ["in", property[1], ...values[1]];
  }
  if (operator === "==" && property?.[0] === "get") return ["==", property[1], values];
  return [operator, ...filter.slice(1).map(legacyFilter)];
}

function propertyToken(value) {
  const properties = [];
  const visit = (entry) => {
    if (!Array.isArray(entry)) return;
    if (entry[0] === "get") properties.push(entry[1]);
    entry.slice(1).forEach(visit);
  };
  visit(value);
  return `{${properties.at(-1) ?? "name"}}`;
}

function legacyValue(value, property) {
  if (!Array.isArray(value)) return value;
  if (property === "text-field") return propertyToken(value);
  if (value[0] === "interpolate" && value[2]?.[0] === "zoom") {
    const stops = [];
    for (let index = 3; index < value.length; index += 2) {
      stops.push([value[index], legacyValue(value[index + 1], property)]);
    }
    return { base: 1, stops };
  }
  if (["match", "case", "coalesce", "step"].includes(value[0])) return legacyValue(value.at(-1), property);
  if (value[0] === "get") return propertyToken(value);
  if (value[0] === "literal") return value[1];
  return value.map((entry) => legacyValue(entry, property));
}

function legacyProperties(properties = {}) {
  return Object.fromEntries(Object.entries(properties).map(([name, value]) => [name, legacyValue(value, name)]));
}

function legacyLayer(layer) {
  if (layer.filter) layer.filter = legacyFilter(layer.filter);
  if (layer.layout) layer.layout = legacyProperties(layer.layout);
  if (layer.paint) layer.paint = legacyProperties(layer.paint);
  return layer;
}

function expandRoadLayer(layer) {
  return roadGroups.map((group) => {
    const road = structuredClone(layer);
    road.id = `${layer.id}-${group.id}`;
    road.filter = ["in", "class", ...group.classes];
    if (road.paint) {
      road.paint = Object.fromEntries(Object.entries(road.paint).map(([name, value]) => [name, resolveForClass(value, group.value)]));
    }
    return legacyLayer(road);
  });
}

function expandPoiLayer(layer) {
  return poiGroups[layer.id].map((group) => {
    const poi = structuredClone(layer);
    poi.id = `${layer.id}-${group.id}`;
    poi.filter = ["in", "class", ...group.classes];
    poi.layout.visibility = "visible";
    poi.layout["icon-image"] = group.icon;
    poi.layout["text-field"] = "{name}";
    return legacyLayer(poi);
  });
}

function expandRoadShields(layer) {
  const groups = [
    { id: "interstate", networks: ["US:I", "us-interstate"], icon: "shield-interstate" },
    { id: "us", networks: ["US:US", "us-highway"], icon: "shield-us" },
    { id: "state", networks: ["US:FL", "us-state"], icon: "shield-state" },
    { id: "county", networks: ["US:FL:CR"], icon: "shield-county" }
  ];
  return groups.map((group) => {
    const shield = structuredClone(layer);
    shield.id = `${layer.id}-${group.id}`;
    shield.filter = ["any", ["in", "network", ...group.networks], ["in", "route_1_network", ...group.networks]];
    shield.layout["icon-image"] = group.icon;
    shield.layout["text-field"] = "{ref}";
    shield.paint["text-color"] = group.id === "us" ? "#080912" : "#f4f7ff";
    shield.paint["text-halo-color"] = group.id === "us" ? "#f4f7ff" : "#060711";
    shield.paint["text-halo-width"] = group.id === "us" ? 0.65 : 1.8;
    return legacyLayer(shield);
  });
}

function atakLayers(layers) {
  return layers.flatMap((layer) => {
    if (["roads-glow", "roads-casing", "roads"].includes(layer.id)) return expandRoadLayer(layer);
    if (poiGroups[layer.id]) return expandPoiLayer(layer);
    if (layer.id === "road-shields") return expandRoadShields(layer);
    if (layer.id === "poi-airports") {
      layer["source-layer"] = "aerodrome_label";
      delete layer.filter;
      layer.layout["text-field"] = "{name}";
    }
    if (layer.id === "buildings-3d") {
      layer.layout.visibility = "visible";
      layer.paint["fill-extrusion-height"] = { property: "render_height", type: "identity", default: 3 };
      layer.paint["fill-extrusion-base"] = { property: "render_min_height", type: "identity", default: 0 };
    }
    return legacyLayer(layer);
  });
}

function normalizeBaseUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("ATAK base URL must be an absolute HTTP or HTTPS URL");
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("ATAK base URL must be an absolute HTTP or HTTPS URL without credentials, query, or fragment");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function buildAtakVectorStyle({ theme, baseUrl, sourceId = "florida", sourceStyle }) {
  const themeName = themeNames[theme];
  if (!themeName) throw new Error(`Unknown ATAK theme: ${theme}`);
  if (!sourceStyle || sourceStyle.version !== 8 || !sourceStyle.sources || !Array.isArray(sourceStyle.layers)) {
    throw new Error("ATAK vector styling requires a Mapbox Style Specification v8 document");
  }

  const base = normalizeBaseUrl(baseUrl);
  const style = structuredClone(sourceStyle);
  const authoredSource = sourceStyle.sources.osm?.type === "vector" ? "osm" : sourceId;
  if (sourceStyle.sources[authoredSource]?.type !== "vector") {
    throw new Error(`ATAK vector source is unavailable: ${sourceId}`);
  }
  const layerSuffix = `--${authoredSource}`;
  style.name = `Map Room - ${themeName} - ATAK Vector`;
  style.sprite = `${base}/styles/${theme}/sprite`;
  style.glyphs = `${base}/fonts/{fontstack}/{range}.pbf`;
  style.sources = { osm: { type: "vector", url: `${base}/data/${sourceId}.json` } };
  style.layers = style.layers
    .filter((layer) => !layer.source || layer.source === authoredSource)
    .map((layer) => {
      if (!layer.source) return layer;
      layer.source = "osm";
      if (layer.id.endsWith(layerSuffix)) layer.id = layer.id.slice(0, -layerSuffix.length);
      return layer;
    });
  style.layers = atakLayers(style.layers);
  return style;
}
