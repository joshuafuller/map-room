import { transposeImageData, URLShieldRenderer } from "/vendor/americana-shield-renderer.mjs";

const routeParser = {
  parse(imageName) {
    const [prefix, network = "", ref = "", name = "", color = ""] = imageName.split("\n");
    return { prefix, network, ref, name, color, imageName };
  },
  format(network, ref, name) {
    return `shield\n${network}\n${ref}\n${name}\n`;
  }
};

function renderPoi(renderer, map, imageName) {
  const [, spriteEntry = "", colorEntry = ""] = imageName.split("\n");
  const sprite = spriteEntry.split("=")[1];
  const color = colorEntry.split("=")[1];
  const source = map.style.getImage(sprite);
  if (!source) return;

  const context = renderer.createGraphics({ width: source.data.width, height: source.data.height });
  transposeImageData(context, source, 0, false, color);
  const image = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
  map.addImage(imageName, { width: image.width, height: image.height, data: image.data }, {
    pixelRatio: renderer.pixelRatio()
  });
}

export function setupAmericana(map) {
  const renderer = new URLShieldRenderer("/vendor/americana-shields.json", routeParser)
    .filterImageID((imageName) => imageName?.startsWith("shield\n"))
    .filterNetwork((network) => !/^[lrni][chimpw]n$/.test(network))
    .renderOnMaplibreGL(map);

  map.on("styleimagemissing", ({ id }) => {
    if (!id?.startsWith("poi\n")) return;
    try {
      renderPoi(renderer, map, id);
    } catch (error) {
      console.error(`Could not render Americana POI ${JSON.stringify(id)}`, error);
    }
  });
}
