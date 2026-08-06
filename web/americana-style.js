const defaultTemplateUrl = "/vendor/americana-shield-layer.json";
let templatePromise;

async function loadTemplate({ fetcher = globalThis.fetch, templateUrl = defaultTemplateUrl } = {}) {
  templatePromise ??= fetcher(templateUrl).then(async (response) => {
    if (!response.ok) throw new Error(`Americana shield layer request failed (${response.status})`);
    return response.json();
  }).catch((error) => {
    templatePromise = undefined;
    throw error;
  });
  return templatePromise;
}

export async function applyAmericanaShields(style, options = {}) {
  const fixedLayers = style?.layers?.filter(({ id }) => id === "road-shields" || id.startsWith("road-shields--")) ?? [];
  if (fixedLayers.length === 0) return structuredClone(style);
  const template = options.template ?? await loadTemplate(options);
  const adapted = structuredClone(style);
  adapted.layers = adapted.layers.map((layer) => {
    if (layer.id !== "road-shields" && !layer.id.startsWith("road-shields--")) return layer;
    return {
      ...structuredClone(template),
      id: layer.id,
      source: layer.source
    };
  });
  return adapted;
}
