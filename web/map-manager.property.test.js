import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {
  catalogResultGroups, catalogShortcutRegions, describeSource, escapeHtml, formatBytes,
  groupCatalogRegions, jobPhaseSteps, jobPresentation, moveCatalogFocus, retryAction, slug
} from "./map-manager.js";

const anyText = fc.string({ unit: fc.constantFrom(...`<>&"'/\\ -_.0123456789abcXYZÄé漢字🌍\u0000\u200b`) , maxLength: 40 });

const region = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  name: anyText,
  group: fc.option(anyText, { nil: undefined }),
  isoCode: fc.option(fc.string({ maxLength: 5 }), { nil: undefined })
});

const job = fc.record({
  id: fc.string({ maxLength: 8 }),
  name: fc.option(anyText, { nil: undefined }),
  regionId: fc.string({ maxLength: 8 }),
  type: fc.constantFrom("create", "rebuild", "delete", "unknown"),
  status: fc.constantFrom("queued", "running", "complete", "failed"),
  phase: fc.constantFrom("queued", "starting", "downloading", "building", "configuring", "activating", "complete", "failed", "unknown", undefined),
  lastPhase: fc.option(fc.constantFrom("downloading", "building", "configuring", "activating"), { nil: undefined }),
  sourceMode: fc.option(fc.constantFrom("resumed", "reused", "fresh"), { nil: undefined }),
  buildMemory: fc.option(fc.constantFrom("4g", "8g", "12g", "16g"), { nil: undefined }),
  createdAt: fc.constant(new Date(0).toISOString()),
  startedAt: fc.option(fc.constant(new Date(0).toISOString()), { nil: undefined }),
  completedAt: fc.option(fc.constant(new Date(1000).toISOString()), { nil: undefined }),
  error: fc.option(anyText, { nil: null }),
  progress: fc.option(fc.record({
    percent: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
    completedBytes: fc.option(fc.nat(), { nil: undefined }),
    totalBytes: fc.option(fc.nat(), { nil: undefined }),
    bytesPerSecond: fc.option(fc.nat(), { nil: undefined }),
    etaSeconds: fc.option(fc.nat(), { nil: undefined })
  }), { nil: null })
});

test("a generated stable ID is always URL-safe and settled", () => {
  fc.assert(fc.property(anyText, (value) => {
    const generated = slug(value);
    assert.match(generated, /^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, `unsafe ID from ${JSON.stringify(value)}`);
    assert.equal(slug(generated), generated, "slug was not idempotent");
  }));
});

test("escaping leaves no markup a browser could execute", () => {
  fc.assert(fc.property(anyText, (value) => {
    const escaped = escapeHtml(value);
    assert.ok(!/[<>]/.test(escaped), `raw angle bracket survived: ${escaped}`);
    assert.ok(!/["']/.test(escaped), `raw quote survived: ${escaped}`);
    // Escaping must be lossless: decoding returns exactly what went in.
    const decoded = escaped
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
    assert.equal(decoded, String(value), "escaping was not lossless");
  }));
});

// Bounded to real byte counts (up to an exabyte); beyond ~1e21 JavaScript
// itself switches to exponential notation, which no disk can reach.
test("byte sizes always render as one readable unit", () => {
  fc.assert(fc.property(fc.oneof(
    fc.nat(), fc.double({ min: 0, max: 2 ** 60, noNaN: true }),
    fc.constant(NaN), fc.constant(Infinity), fc.constant(-Infinity)
  ), (value) => {
    const rendered = formatBytes(value);
    assert.equal(typeof rendered, "string");
    assert.ok(rendered.length > 0);
    if (Number.isFinite(value)) assert.match(rendered, /^\d+(\.\d)? (B|KB|MB|GB|TB)$/);
    else assert.equal(rendered, "Size unavailable", "a non-finite size must read as unavailable");
  }));
});

test("larger archives never read as smaller units", () => {
  fc.assert(fc.property(fc.nat({ max: 2 ** 50 }), fc.nat({ max: 2 ** 50 }), (left, right) => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    const unitOf = (bytes) => units.indexOf(formatBytes(bytes).split(" ")[1]);
    if (left <= right) assert.ok(unitOf(left) <= unitOf(right));
  }));
});

test("grouping a catalog keeps every region exactly once", () => {
  fc.assert(fc.property(fc.array(region, { maxLength: 60 }), (regions) => {
    const grouped = groupCatalogRegions(regions).flatMap(({ regions: items }) => items);
    assert.equal(grouped.length, regions.length, "grouping lost or duplicated regions");
    for (const item of regions) assert.ok(grouped.includes(item));
  }));
});

test("catalog results never exceed their limit and report truncation honestly", () => {
  fc.assert(fc.property(fc.array(region, { maxLength: 80 }), fc.integer({ min: -3, max: 30 }), (regions, limit) => {
    const result = catalogResultGroups(regions, limit);
    assert.equal(result.total, regions.length);
    assert.ok(result.visible <= Math.max(0, limit), "rendered more options than the limit allows");
    assert.ok(result.visible <= result.total);
    assert.equal(result.truncated, result.total > result.visible);
    assert.equal(result.groups.flatMap(({ regions: items }) => items).length, result.visible);
  }));
});

test("catalog shortcuts never repeat a region", () => {
  fc.assert(fc.property(
    fc.array(fc.record({ name: anyText, source: fc.option(fc.record({ catalogId: fc.string({ maxLength: 8 }) }), { nil: undefined }) }), { maxLength: 20 }),
    fc.array(fc.record({ id: fc.string({ maxLength: 8 }), name: anyText, group: fc.option(anyText, { nil: undefined }) }), { maxLength: 20 }),
    (maps, recent) => {
      const shortcuts = catalogShortcutRegions(maps, recent);
      const ids = shortcuts.map(({ id }) => id);
      assert.equal(new Set(ids).size, ids.length, "shortcut list offered the same region twice");
      assert.ok(shortcuts.every(({ id, name }) => id && name !== undefined));
    }
  ));
});

test("keyboard focus stays inside the result list", () => {
  fc.assert(fc.property(fc.integer({ min: -1, max: 40 }), fc.constantFrom(1, -1), fc.nat({ max: 40 }), (current, direction, count) => {
    const next = moveCatalogFocus(current, direction, count);
    if (count === 0) assert.equal(next, -1, "an empty result list did not clear the focused option");
    else assert.ok(next >= 0 && next < count, `focus escaped to ${next} of ${count}`);
  }));
});

test("every build reports four phases with one live step", () => {
  fc.assert(fc.property(job, (value) => {
    const steps = jobPhaseSteps(value);
    assert.equal(steps.length, 4);
    assert.ok(steps.every(({ state }) => ["complete", "current", "failed", "future"].includes(state)));
    assert.ok(steps.filter(({ state }) => state === "current").length <= 1, "more than one phase claimed to be running");
    assert.ok(steps.filter(({ state }) => state === "failed").length <= 1);
    if (value.status === "complete") assert.ok(steps.every(({ state }) => state === "complete"));
    // Completed phases never appear after unfinished ones.
    const order = steps.map(({ state }) => state === "complete" ? 0 : 1);
    assert.deepEqual(order, [...order].sort(), "a finished phase followed an unfinished one");
  }));
});

test("any job shape produces printable progress text", () => {
  fc.assert(fc.property(job, (value) => {
    const presentation = jobPresentation(value, 5000);
    for (const field of ["title", "detail", "elapsed"]) {
      assert.equal(typeof presentation[field], "string", `${field} was not printable`);
      assert.ok(presentation[field].length > 0);
      assert.ok(!presentation[field].includes("NaN"), `${field} leaked NaN: ${presentation[field]}`);
      assert.ok(!presentation[field].includes("undefined"), `${field} leaked undefined: ${presentation[field]}`);
    }
    assert.ok(presentation.error === null || typeof presentation.error === "string");
    assert.ok(!presentation.error?.includes("\n"), "a multi-line stack trace reached the operator");
  }));
});

test("retry is offered only where it can work, and never lowers memory", () => {
  const rank = { "4g": 1, "8g": 2, "12g": 3, "16g": 4 };
  fc.assert(fc.property(job, (value) => {
    const retry = retryAction(value);
    if (value.status !== "failed" || !["create", "rebuild"].includes(value.type)) {
      assert.equal(retry, null, "offered retry for a job that cannot be retried");
      return;
    }
    assert.equal(typeof retry.label, "string");
    assert.ok(retry.label.length > 0);
    if (retry.buildMemory) {
      assert.ok(["4g", "8g", "12g", "16g"].includes(retry.buildMemory));
      if (value.buildMemory) assert.ok(rank[retry.buildMemory] >= rank[value.buildMemory], "retry proposed less memory than the failed build used");
    }
  }));
});

test("a source is always described without leaking a raw object", () => {
  fc.assert(fc.property(fc.option(fc.record({
    type: fc.option(fc.constantFrom("upload", "catalog", "url"), { nil: undefined }),
    catalogId: fc.option(fc.string({ maxLength: 10 }), { nil: undefined }),
    url: fc.option(fc.oneof(fc.webUrl(), anyText), { nil: undefined }),
    file: fc.option(anyText, { nil: undefined })
  }), { nil: undefined }), (source) => {
    const described = describeSource(source);
    assert.equal(typeof described, "string");
    assert.ok(described.length > 0);
    assert.ok(!described.includes("[object"), "an object reached the operator as text");
  }));
});
