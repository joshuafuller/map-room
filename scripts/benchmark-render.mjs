import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:8088";
const limits = {
  coldLoadMs: 4000,
  styleResourceMs: 250,
  styleEncodedBytes: 100_000,
  settledFps: 50,
  transitionMs: 1500,
  transitionLongTaskMs: 2500
};
const themes = [
  "midnight",
  "dark-blue",
  "dark-red",
  "dark-green",
  "cyberpunk",
  "cyberpunk-tactical",
  "daylight"
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);

await page.addInitScript(() => {
  window.__mapRoomLongTasks = [];
  new PerformanceObserver((entries) => {
    window.__mapRoomLongTasks.push(...entries.getEntries().map(({ startTime, duration }) => ({
      startTime,
      duration
    })));
  }).observe({ type: "longtask", buffered: true });
});

const started = performance.now();
await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.locator(".maplibregl-canvas").waitFor({ state: "visible" });
await page.waitForFunction(() => document.documentElement.dataset.loadedMapTheme === "daylight");
const coldLoadMs = performance.now() - started;
await page.waitForTimeout(1000);

const styleResource = await page.evaluate(() => {
  const entry = performance.getEntriesByType("resource")
    .find(({ name }) => name.includes("/browser-styles/all-daylight/style.json"));
  return entry ? {
    durationMs: entry.duration,
    encodedBytes: entry.encodedBodySize,
    decodedBytes: entry.decodedBodySize
  } : null;
});

const settledFps = await page.evaluate(() => new Promise((resolve) => {
  let frames = 0;
  const startedAt = performance.now();
  const sample = (now) => {
    frames += 1;
    if (now - startedAt >= 1000) {
      resolve(frames * 1000 / (now - startedAt));
      return;
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}));

await page.locator("#panel-toggle").click();
const transitions = [];
for (const theme of themes) {
  await page.evaluate(() => { window.__mapRoomLongTasks = []; });
  const transitionStarted = performance.now();
  await page.locator(`[data-theme="${theme}"]`).click();
  await page.waitForFunction((expected) =>
    document.documentElement.dataset.loadedMapTheme === expected, theme);
  const loadMs = performance.now() - transitionStarted;
  await page.waitForTimeout(theme === "daylight" ? 1200 : 300);
  const longTasks = await page.evaluate(() => window.__mapRoomLongTasks);
  transitions.push({
    theme,
    loadMs,
    longTaskMs: longTasks.reduce((total, task) => total + task.duration, 0),
    longestTaskMs: Math.max(0, ...longTasks.map(({ duration }) => duration))
  });
}

await browser.close();

const report = {
  baseUrl,
  measuredAt: new Date().toISOString(),
  coldLoadMs,
  styleResource,
  settledFps,
  transitions,
  limits
};
console.log(JSON.stringify(report, null, 2));

const failures = [];
if (coldLoadMs > limits.coldLoadMs) failures.push(`cold load ${coldLoadMs.toFixed(0)}ms exceeded ${limits.coldLoadMs}ms`);
if (!styleResource) failures.push("browser-ready Daylight style resource was not observed");
if (styleResource?.durationMs > limits.styleResourceMs) failures.push(`style resource ${styleResource.durationMs.toFixed(0)}ms exceeded ${limits.styleResourceMs}ms`);
if (styleResource?.encodedBytes > limits.styleEncodedBytes) failures.push(`style transfer ${styleResource.encodedBytes} bytes exceeded ${limits.styleEncodedBytes}`);
if (settledFps < limits.settledFps) failures.push(`settled frame rate ${settledFps.toFixed(1)}fps fell below ${limits.settledFps}fps`);
for (const transition of transitions) {
  if (transition.loadMs > limits.transitionMs) failures.push(`${transition.theme} load ${transition.loadMs.toFixed(0)}ms exceeded ${limits.transitionMs}ms`);
  if (transition.longTaskMs > limits.transitionLongTaskMs) failures.push(`${transition.theme} long tasks ${transition.longTaskMs.toFixed(0)}ms exceeded ${limits.transitionLongTaskMs}ms`);
}
if (failures.length) throw new Error(`Render benchmark failed:\n- ${failures.join("\n- ")}`);
