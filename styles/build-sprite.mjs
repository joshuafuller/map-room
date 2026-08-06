import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const iconDirectory = join(here, "..", "node_modules", "lucide-static", "icons");
const size = 128;
const pixelRatio = 4;
const columns = 4;
const atakScale = 4;

async function writeFileAtomic(path, data) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, data);
  await rename(temporaryPath, path);
}

const symbols = [
  { id: "shield-interstate", type: "shield", accent: "emergency", fill: "shieldFill" },
  { id: "shield-us", type: "shield", accent: "frame", fill: "lightFill" },
  { id: "shield-state", type: "shield", accent: "service", fill: "shieldFill" },
  { id: "shield-county", type: "shield", accent: "leisure", fill: "shieldFill" },
  { id: "poi-medical", icon: "hospital.svg", label: "Medical", accent: "emergency", silhouette: ["building", "medical-cross"] },
  { id: "poi-fire", icon: "flame.svg", label: "Fire", accent: "emergency", silhouette: ["outer-flame", "inner-flame"] },
  { id: "poi-police", icon: "shield.svg", label: "Police", accent: "service", silhouette: ["service-shield", "inner-field"] },
  { id: "poi-fuel", icon: "fuel.svg", label: "Fuel", accent: "utility", silhouette: ["pump-body", "display-window", "hose", "nozzle"] },
  { id: "poi-airport", icon: "plane.svg", label: "Airport", accent: "service", silhouette: ["fuselage", "wings", "tail"] },
  { id: "poi-port", icon: "anchor.svg", label: "Port", accent: "service", silhouette: ["anchor-ring", "anchor-stock", "anchor-flukes"] },
  { id: "poi-food", icon: "utensils.svg", label: "Food", accent: "utility", silhouette: ["fork", "knife"] },
  { id: "poi-lodging", icon: "bed.svg", label: "Lodging", accent: "leisure", silhouette: ["bed-frame", "pillow"] },
  { id: "poi-attraction", icon: "star.svg", label: "Attraction", accent: "utility", silhouette: ["five-point-star", "center-field"] },
  { id: "poi-shopping", icon: "shopping-bag.svg", label: "Shopping", accent: "emergency", silhouette: ["bag", "handles"] },
  { id: "poi-parking", icon: "circle-parking.svg", label: "Parking", accent: "leisure", silhouette: ["parking-ring", "letter-p"] }
];

function shieldSvg({ accent, fill }, palette) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <path d="M18 18h92v52c0 23-18 35-46 44C36 105 18 93 18 70Z" fill="${palette.shadow}" stroke="${palette.shadow}" stroke-width="12" stroke-linejoin="round"/>
  <path d="M18 18h92v52c0 23-18 35-46 44C36 105 18 93 18 70Z" fill="${palette[fill]}" stroke="${palette.frame}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M18 18h92v52c0 23-18 35-46 44C36 105 18 93 18 70Z" fill="none" stroke="${palette[accent]}" stroke-width="4" stroke-linejoin="round"/>
  </svg>`;
}

async function markerSvg(symbol, palette) {
  const source = await readFile(join(iconDirectory, symbol.icon), "utf8");
  const body = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1];
  if (!body) throw new Error(`Invalid Lucide SVG: ${symbol.icon}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <circle cx="64" cy="60" r="52" fill="${palette.shadow}" stroke="${palette.shadow}" stroke-width="10"/>
  <circle cx="64" cy="60" r="48" fill="${palette.markerFill}" stroke="${palette.frame}" stroke-width="4"/>
  <circle cx="64" cy="60" r="43" fill="none" stroke="${palette[symbol.accent]}" stroke-width="4"/>
  <g transform="translate(32 28) scale(2.6667)" fill="none" stroke="${palette[symbol.accent]}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">${body}</g>
  </svg>`;
}

export async function buildSpriteAtlas(outputDirectory, palette) {
  const width = columns * size;
  const height = Math.ceil(symbols.length / columns) * size;
  const composites = [];
  const metadata = {};
  const designs = {};

  for (const [index, symbol] of symbols.entries()) {
    const left = index % columns * size;
    const top = Math.floor(index / columns) * size;
    const svg = symbol.type === "shield" ? shieldSvg(symbol, palette) : await markerSvg(symbol, palette);
    composites.push({ input: await sharp(Buffer.from(svg)).png().toBuffer(), left, top });
    metadata[symbol.id] = { width: size, height: size, x: left, y: top, pixelRatio };
    if (symbol.icon) {
      designs[symbol.id] = {
        label: symbol.label,
        silhouette: symbol.silhouette,
        accent: palette[symbol.accent],
        rendering: "lucide-svg"
      };
    }
  }

  const atlas = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();
  const atakMetadata = Object.fromEntries(Object.entries(metadata).map(([id, symbol]) => [id, {
    width: symbol.width / atakScale,
    height: symbol.height / atakScale,
    x: symbol.x / atakScale,
    y: symbol.y / atakScale,
    pixelRatio: 1
  }]));
  const atakAtlas = await sharp(atlas)
    .resize(width / atakScale, height / atakScale)
    .png()
    .toBuffer();
  const metadataJson = `${JSON.stringify(metadata, null, 2)}\n`;
  await writeFileAtomic(join(outputDirectory, "sprite.json"), metadataJson);
  await writeFileAtomic(join(outputDirectory, "sprite@2x.json"), metadataJson);
  await writeFileAtomic(join(outputDirectory, "sprite-design.json"), `${JSON.stringify(designs, null, 2)}\n`);
  await writeFileAtomic(join(outputDirectory, "sprite.png"), atlas);
  await writeFileAtomic(join(outputDirectory, "sprite@2x.png"), atlas);
  await writeFileAtomic(join(outputDirectory, "atak-sprite.json"), `${JSON.stringify(atakMetadata, null, 2)}\n`);
  await writeFileAtomic(join(outputDirectory, "atak-sprite.png"), atakAtlas);
}
