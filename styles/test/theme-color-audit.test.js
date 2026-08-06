import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const coloredThemes = ["midnight", "dark-blue", "dark-red", "dark-green", "cyberpunk", "cyberpunk-tactical"];

function oklab(hex) {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}

function colorDistance(first, second) {
  const left = oklab(first);
  const right = oklab(second);
  return Math.hypot(...left.map((channel, index) => channel - right[index])) * 100;
}

function colorLiterals(value, result = []) {
  if (typeof value === "string" && /^(?:#|hsl)/i.test(value)) result.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => colorLiterals(entry, result));
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => colorLiterals(entry, result));
  return result;
}

test("keeps Daylight paint colors identical to pinned upstream Americana", async () => {
  const upstream = JSON.parse(await readFile("styles/vendor/americana/style.json", "utf8"));
  const daylight = JSON.parse(await readFile("styles/daylight/style.json", "utf8"));
  const expected = colorLiterals(upstream.layers.filter(({ source }) => source !== "dem").map(({ paint }) => paint));
  const actual = colorLiterals(daylight.layers.map(({ paint }) => paint));
  assert.deepEqual(actual, expected);
});

test("keeps solid waterways perceptually distinct from every road class", async () => {
  for (const theme of coloredThemes) {
    const style = JSON.parse(await readFile(`styles/${theme}/style.json`, "utf8"));
    const layers = Object.fromEntries(style.layers.map((layer) => [layer.id, layer]));
    const water = layers.waterways.paint["line-color"];
    const roadExpression = layers.roads.paint["line-color"];
    const roadColors = colorLiterals(roadExpression);

    for (const road of roadColors) {
      assert.ok(colorDistance(water, road) >= 10,
        `${theme} water ${water} is too close to road ${road}`);
    }
  }
});
