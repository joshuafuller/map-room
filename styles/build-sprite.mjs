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
const atakShieldFit = {
  "shield-interstate": { content: [5, 5, 27, 24], stretchX: [[14, 18]] },
  "shield-us": { content: [7, 5, 25, 24], stretchX: [[14, 18]] },
  "shield-state": { content: [5, 6, 27, 26], stretchX: [[14, 18]] },
  "shield-county": { content: [4, 7, 28, 25], stretchX: [[14, 18]] }
};
const shieldPaths = {
  "shield-interstate": "M7 26h114v42c0 19-21 32-57 42C28 100 7 87 7 68Z",
  "shield-interstate-wide": "M7 26h146v42c0 19-26 32-73 42C33 100 7 87 7 68Z",
  "shield-us": "M17 22c16 7 31 1 47-7 16 8 31 14 47 7l7 31c-3 27-21 46-54 59-33-13-51-32-54-59Z",
  "shield-us-wide": "M21 22c20 7 39 1 59-7 20 8 39 14 59 7l9 31c-4 27-26 46-68 59-42-13-64-32-68-59Z",
  "shield-state": "M17 25h94q10 0 10 10v58q0 10-10 10H17Q7 103 7 93V35q0-10 10-10Z",
  "shield-state-wide": "M17 25h126q10 0 10 10v58q0 10-10 10H17Q7 103 7 93V35q0-10 10-10Z",
  "shield-county": "M17 24h94l10 12v56l-10 12H17L7 92V36Z"
};
const atakShieldPaths = {
  "shield-interstate": "M18 18h92v52c0 23-18 35-46 44C36 105 18 93 18 70Z",
  "shield-us": "M28 14C40 20 52 14 64 9c12 5 24 11 36 5l8 40c-3 29-19 50-44 62C39 104 23 83 20 54Z",
  "shield-state": "M32 16h64q12 0 12 12v68q0 12-12 12H32q-12 0-12-12V28q0-12 12-12Z",
  "shield-county": "M24 18h80l10 14v64l-10 14H24L14 96V32Z"
};

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
  { id: "poi-parking", icon: "circle-parking.svg", label: "Parking", accent: "leisure", silhouette: ["parking-ring", "letter-p"] },
  { id: "shield-interstate-wide", type: "shield", accent: "emergency", fill: "shieldFill", browserOnly: true, wide: true },
  { id: "shield-us-wide", type: "shield", accent: "frame", fill: "lightFill", browserOnly: true, wide: true },
  { id: "shield-state-wide", type: "shield", accent: "service", fill: "shieldFill", browserOnly: true, wide: true }
];

function shieldSvg({ id, accent, fill }, palette) {
  const path = shieldPaths[id];
  const baseId = id.replace(/-wide$/, "");
  const viewBoxWidth = id.endsWith("-wide") ? 160 : 128;
  if (baseId === "shield-interstate") return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} 128">
  <defs><clipPath id="interstate-field"><path d="${path}"/></clipPath></defs>
  <path d="${path}" fill="#174a7e" stroke="#111827" stroke-width="12" stroke-linejoin="round"/>
  <path d="${path}" fill="#174a7e"/>
  <path d="M0 18h${viewBoxWidth}v36H0z" fill="#c8323e" clip-path="url(#interstate-field)"/>
  <path d="${path}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round"/>
  <path d="${path}" fill="none" stroke="#111827" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
  const colors = {
    "shield-us": { field: "#ffffff", border: "#111827" },
    "shield-state": { field: "#ffffff", border: "#087b91" },
    "shield-county": { field: "#fff1c2", border: "#6b4f1d" }
  }[baseId];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} 128">
  <path d="${path}" fill="${colors.field}" stroke="#111827" stroke-width="12" stroke-linejoin="round"/>
  <path d="${path}" fill="${colors.field}" stroke="${colors.border}" stroke-width="7" stroke-linejoin="round"/>
  </svg>`;
}

function atakShieldSvg({ id, accent, fill }, palette) {
  const path = atakShieldPaths[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <path d="${path}" fill="${palette.shadow}" stroke="${palette.shadow}" stroke-width="12" stroke-linejoin="round"/>
  <path d="${path}" fill="${palette[fill]}" stroke="${palette.frame}" stroke-width="7" stroke-linejoin="round"/>
  <path d="${path}" fill="none" stroke="${palette[accent]}" stroke-width="4" stroke-linejoin="round"/>
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
  const atakComposites = [];
  const metadata = {};
  const designs = {};

  for (const [index, symbol] of symbols.entries()) {
    const cellLeft = index % columns * size;
    const cellTop = Math.floor(index / columns) * size;
    const spriteWidth = symbol.type === "shield" ? (symbol.wide ? 120 : 96) : size;
    const spriteHeight = symbol.type === "shield" ? 96 : size;
    const left = cellLeft + Math.floor((size - spriteWidth) / 2);
    const top = cellTop + Math.floor((size - spriteHeight) / 2);
    const svg = symbol.type === "shield" ? shieldSvg(symbol, palette) : await markerSvg(symbol, palette);
    composites.push({ input: await sharp(Buffer.from(svg)).resize(spriteWidth, spriteHeight).png().toBuffer(), left, top });
    if (!symbol.browserOnly) {
      const atakSvg = symbol.type === "shield" ? atakShieldSvg(symbol, palette) : svg;
      atakComposites.push({
        input: await sharp(Buffer.from(atakSvg)).resize(size / atakScale, size / atakScale).png().toBuffer(),
        left: cellLeft / atakScale,
        top: cellTop / atakScale
      });
    }
    metadata[symbol.id] = {
      width: spriteWidth, height: spriteHeight, x: left, y: top,
      pixelRatio: symbol.type === "shield" ? 3 : pixelRatio
    };
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
  const atakMetadata = Object.fromEntries(symbols.filter(({ browserOnly }) => !browserOnly).map((entry, index) => [entry.id, {
    width: size / atakScale,
    height: size / atakScale,
    x: index % columns * size / atakScale,
    y: Math.floor(index / columns) * size / atakScale,
    pixelRatio: 1,
    ...(atakShieldFit[entry.id] ?? {})
  }]));
  const atakHeight = Math.ceil(symbols.filter(({ browserOnly }) => !browserOnly).length / columns) * size / atakScale;
  const atakAtlas = await sharp({
    create: {
      width: width / atakScale,
      height: atakHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(atakComposites)
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
