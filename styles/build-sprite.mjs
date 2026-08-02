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

async function writeFileAtomic(path, data) {
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, data);
  await rename(temporaryPath, path);
}

const symbols = [
  { id: "shield-interstate", type: "shield", accent: "#ff2a9f", fill: "#03040b" },
  { id: "shield-us", type: "shield", accent: "#f6f8ff", fill: "#f6f8ff" },
  { id: "shield-state", type: "shield", accent: "#00eaff", fill: "#03040b" },
  { id: "shield-county", type: "shield", accent: "#8c62f4", fill: "#03040b" },
  { id: "poi-medical", icon: "hospital.svg", label: "Medical", accent: "#ff2a9f", silhouette: ["building", "medical-cross"] },
  { id: "poi-fire", icon: "flame.svg", label: "Fire", accent: "#ff2a9f", silhouette: ["outer-flame", "inner-flame"] },
  { id: "poi-police", icon: "shield.svg", label: "Police", accent: "#00eaff", silhouette: ["service-shield", "inner-field"] },
  { id: "poi-fuel", icon: "fuel.svg", label: "Fuel", accent: "#f2dc58", silhouette: ["pump-body", "display-window", "hose", "nozzle"] },
  { id: "poi-airport", icon: "plane.svg", label: "Airport", accent: "#00eaff", silhouette: ["fuselage", "wings", "tail"] },
  { id: "poi-port", icon: "anchor.svg", label: "Port", accent: "#00eaff", silhouette: ["anchor-ring", "anchor-stock", "anchor-flukes"] },
  { id: "poi-food", icon: "utensils.svg", label: "Food", accent: "#f2dc58", silhouette: ["fork", "knife"] },
  { id: "poi-lodging", icon: "bed.svg", label: "Lodging", accent: "#8c62f4", silhouette: ["bed-frame", "pillow"] },
  { id: "poi-attraction", icon: "star.svg", label: "Attraction", accent: "#f2dc58", silhouette: ["five-point-star", "center-field"] },
  { id: "poi-shopping", icon: "shopping-bag.svg", label: "Shopping", accent: "#ff2a9f", silhouette: ["bag", "handles"] },
  { id: "poi-parking", icon: "circle-parking.svg", label: "Parking", accent: "#8c62f4", silhouette: ["parking-ring", "letter-p"] }
];

function shieldSvg({ accent, fill }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <path d="M18 18h92v52c0 23-18 35-46 44C36 105 18 93 18 70Z" fill="#03040b" stroke="#03040b" stroke-width="12" stroke-linejoin="round"/>
  <path d="M18 18h92v52c0 23-18 35-46 44C36 105 18 93 18 70Z" fill="${fill}" stroke="#f6f8ff" stroke-width="7" stroke-linejoin="round"/>
  <path d="M18 18h92v52c0 23-18 35-46 44C36 105 18 93 18 70Z" fill="none" stroke="${accent}" stroke-width="4" stroke-linejoin="round"/>
  </svg>`;
}

async function markerSvg(symbol) {
  const source = await readFile(join(iconDirectory, symbol.icon), "utf8");
  const body = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1];
  if (!body) throw new Error(`Invalid Lucide SVG: ${symbol.icon}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <circle cx="64" cy="60" r="52" fill="#03040b" stroke="#03040b" stroke-width="10"/>
  <circle cx="64" cy="60" r="48" fill="#060711" stroke="#f6f8ff" stroke-width="4"/>
  <circle cx="64" cy="60" r="43" fill="none" stroke="${symbol.accent}" stroke-width="4"/>
  <g transform="translate(32 28) scale(2.6667)" fill="none" stroke="${symbol.accent}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">${body}</g>
  </svg>`;
}

export async function buildSpriteAtlas(outputDirectory) {
  const width = columns * size;
  const height = Math.ceil(symbols.length / columns) * size;
  const composites = [];
  const metadata = {};
  const designs = {};

  for (const [index, symbol] of symbols.entries()) {
    const left = index % columns * size;
    const top = Math.floor(index / columns) * size;
    const svg = symbol.type === "shield" ? shieldSvg(symbol) : await markerSvg(symbol);
    composites.push({ input: await sharp(Buffer.from(svg)).png().toBuffer(), left, top });
    metadata[symbol.id] = { width: size, height: size, x: left, y: top, pixelRatio };
    if (symbol.icon) {
      designs[symbol.id] = {
        label: symbol.label,
        silhouette: symbol.silhouette,
        accent: symbol.accent,
        rendering: "lucide-svg"
      };
    }
  }

  const atlas = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();
  const metadataJson = `${JSON.stringify(metadata, null, 2)}\n`;
  await writeFileAtomic(join(outputDirectory, "sprite.json"), metadataJson);
  await writeFileAtomic(join(outputDirectory, "sprite@2x.json"), metadataJson);
  await writeFileAtomic(join(outputDirectory, "sprite-design.json"), `${JSON.stringify(designs, null, 2)}\n`);
  await writeFileAtomic(join(outputDirectory, "sprite.png"), atlas);
  await writeFileAtomic(join(outputDirectory, "sprite@2x.png"), atlas);
}
