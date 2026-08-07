// Mutation testing: break one behavior at a time and require that a named test
// catches it. A suite that stays green against a mutant is not testing that
// behavior, however much coverage it reports.
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = new URL("..", import.meta.url);
const requested = process.argv[2] ?? "all";
const baseUrl = process.env.BASE_URL ?? "http://localhost:8088";

const MUTANTS = [
  // Pure logic, caught by unit and property tests.
  { suite: "unit", label: "slug trims dashes", file: "web/map-manager.js",
    find: '.replace(/^-|-$/g, "")', replace: "", expect: "URL-safe" },
  { suite: "unit", label: "escapeHtml covers apostrophes", file: "web/map-manager.js",
    find: `"'": "&#39;"`, replace: `"\\u0000": "&#39;"`, expect: "escaping leaves no markup" },
  { suite: "unit", label: "formatBytes guards non-finite sizes", file: "web/map-manager.js",
    find: 'if (!Number.isFinite(bytes)) return "Size unavailable";', replace: "", expect: "byte sizes always render" },
  { suite: "unit", label: "catalog results honour their limit", file: "web/map-manager.js",
    find: "const visibleRegions = regions.slice(0, Math.max(0, limit));", replace: "const visibleRegions = regions;",
    expect: "catalog results never exceed" },
  { suite: "unit", label: "keyboard focus wraps inside the list", file: "web/map-manager.js",
    find: "count === 0 ? -1 : (current + direction + count) % count", replace: "current + direction",
    expect: "keyboard focus stays inside" },
  { suite: "unit", label: "only one build phase is live", file: "web/map-manager.js",
    find: 'index < activeIndex ? "complete" : failed ? "failed" : "current"', replace: '"current"',
    expect: "four phases with one live step" },
  { suite: "unit", label: "retry is offered only where it works", file: "web/map-manager.js",
    find: 'if (job.status !== "failed" || !["create", "rebuild"].includes(job.type)) return null;', replace: "",
    expect: "retry is offered only where it can work" },
  { suite: "unit", label: "request bodies must be JSON objects", file: "maintainer/src/api.js",
    find: 'if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {\n    throw new Error("Request body must be a JSON object");\n  }',
    replace: "", expect: "malformed request bodies" },
  { suite: "unit", label: "malformed JSON is a client error", file: "maintainer/src/api.js",
    find: 'catch { throw new Error("Request body must be valid JSON"); }', replace: "catch (error) { throw error; }",
    expect: "malformed request bodies" },
  { suite: "unit", label: "map IDs are length-bounded", file: "maintainer/src/map-library.js",
    find: "|| id.length > MAX_ID_LENGTH", replace: "", expect: "map IDs are bounded" },

  // Manager workflow, caught by the browser suite.
  { suite: "manager", label: "Escape is scoped to the region list", file: "web/map-manager.js",
    find: 'if (event.key === "Escape") { if (!results.hidden) { event.preventDefault(); closeCatalog(); } return; }',
    replace: 'if (event.key === "Escape") { closeCatalog(); return; }', expect: "abandoned the creation view" },
  { suite: "manager", label: "build activity hides when empty", file: "web/map-manager.js",
    find: "jobsSection.hidden = jobs.length === 0;", replace: "jobsSection.hidden = false;",
    expect: "empty build activity section" },
  { suite: "manager", label: "the dialog title tracks the view", file: "web/map-manager.js",
    find: 'managerTitle.textContent = creating ? "Create map" : "Manage maps";',
    replace: 'managerTitle.textContent = "Manage maps";', expect: "did not name the creation view" },
  { suite: "manager", label: "creation errors appear beside the form", file: "web/map-manager.js",
    find: "const target = createView.hidden ? status : createStatus;", replace: "const target = status;",
    expect: "source workflows" },
  { suite: "manager", label: "a filled form is guarded", file: "web/map-manager.js",
    find: 'document.querySelector("#manager-back").addEventListener("click", leaveCreateView);',
    replace: 'document.querySelector("#manager-back").addEventListener("click", () => showManagerView("library"));',
    expect: "discarded it without asking" },
  { suite: "manager", label: "a discarded form is cleared", file: "web/map-manager.js",
    find: '    resetCreateForm();\n    showManagerView("library");\n  });', replace: '    showManagerView("library");\n  });',
    expect: "reopened with its old values" },
  { suite: "manager", label: "rename happens in place", file: "web/map-manager.js",
    find: 'row.querySelector(".rename").addEventListener("click", () => {\n        rowInteraction = map.id;',
    replace: 'row.querySelector(".rename").addEventListener("click", () => {\n        window.prompt("Map name", map.name);\n        rowInteraction = map.id;',
    expect: "fell back to a browser dialog" },
  { suite: "manager", label: "polling does not clobber open rows", file: "web/map-manager.js",
    find: "if (mapState !== renderedMaps && rowInteraction === null)", replace: "if (mapState !== renderedMaps)",
    expect: "discarded the rename in progress" },
  { suite: "manager", label: "canceling a rename restores focus", file: "web/map-manager.js",
    find: '        actions.hidden = false;\n        row.querySelector(".rename").focus();', replace: "        actions.hidden = false;",
    expect: "restore focus to Rename" },
  { suite: "manager", label: "the library names only its sections", file: "web/index.html",
    find: '          <div class="manager-section-head">',
    replace: '          <div><p class="eyebrow">Your maps</p><h3>Map library</h3></div>\n          <div class="manager-section-head">',
    expect: "restated its own title" },
  { suite: "manager", label: "the creation view has no second title", file: "web/index.html",
    find: '          <button id="manager-back" class="manager-back" type="button">← Back to library</button>',
    replace: '          <button id="manager-back" class="manager-back" type="button">← Back to library</button>\n          <h3>Add a map</h3>',
    expect: "repeated the dialog title" }
];

const suites = {
  unit: ["npm", ["run", "test:unit"]],
  manager: ["npm", ["run", "test:manager"]]
};

async function managerServerReachable() {
  try { return (await fetch(`${baseUrl}/api/maps`)).ok; }
  catch { return false; }
}

async function survives({ suite, file, find, replace }) {
  const path = new URL(file, root);
  const original = await readFile(path, "utf8");
  if (!original.includes(find)) return { status: "STALE", detail: "mutation no longer applies to this source" };
  await writeFile(path, original.replace(find, replace));
  try {
    const [command, args] = suites[suite];
    const { stdout, stderr } = await run(command, args, { cwd: root, maxBuffer: 32 * 1024 * 1024 })
      .catch((error) => ({ stdout: error.stdout ?? "", stderr: error.stderr ?? "", failed: true }));
    return { output: `${stdout}${stderr}` };
  } finally {
    await writeFile(path, original);
  }
}

const selected = MUTANTS.filter(({ suite }) => requested === "all" || requested === suite);
const skipManager = selected.some(({ suite }) => suite === "manager") && !await managerServerReachable();
if (skipManager) console.log(`SKIP manager mutants: no Map Room at ${baseUrl} (run npm run dev first)\n`);

const results = [];
for (const mutant of selected) {
  if (mutant.suite === "manager" && skipManager) { results.push([mutant, "SKIP", "no server"]); continue; }
  const { status, detail, output } = await survives(mutant);
  if (status === "STALE") results.push([mutant, "STALE", detail]);
  else if (!output.includes(mutant.expect)) {
    const caught = output.split("\n").filter((line) => line.startsWith("FAIL") || line.startsWith("✖")).slice(0, 2).join(" | ");
    results.push([mutant, "SURVIVED", caught || "no test failed"]);
  } else results.push([mutant, "KILLED", mutant.expect]);
  const [, status_, detail_] = results.at(-1);
  console.log(`${status_.padEnd(9)} ${mutant.suite.padEnd(8)} ${mutant.label}${status_ === "KILLED" ? "" : ` — ${detail_}`}`);
}

const escaped = results.filter(([, status]) => status === "SURVIVED" || status === "STALE");
const killed = results.filter(([, status]) => status === "KILLED").length;
const skipped = results.filter(([, status]) => status === "SKIP").length;
console.log(`\n${killed}/${selected.length - skipped} mutants killed${skipped ? `, ${skipped} skipped` : ""}`);
if (escaped.length) {
  console.error(`\n${escaped.length} mutant(s) were not caught by any test:`);
  for (const [mutant, status, detail] of escaped) console.error(`  ${status} ${mutant.label} — ${detail}`);
  process.exit(1);
}
