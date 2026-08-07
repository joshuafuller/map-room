// Mutation testing: break one behavior at a time and require that a named test
// catches it. A suite that stays green against a mutant is not testing that
// behavior, however much coverage it reports.
import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = new URL("..", import.meta.url);
const requested = process.argv[2] ?? "all";
const baseUrl = process.env.BASE_URL ?? "http://localhost:8088";

const MUTANTS = [
  // A no-op control: the source is unchanged, so the suite must stay green and
  // this must be reported SURVIVED. If it ever reports KILLED, the harness is
  // rubber-stamping and every other verdict below is worthless.
  { suite: "unit", label: "NO-OP CONTROL (must survive)", file: "web/map-manager.js",
    find: "const formatBytes", replace: "const formatBytes", expect: "never matches anything", control: true },
  // Pure logic, caught by unit and property tests.
  { suite: "unit", label: "slug trims dashes", file: "web/map-manager.js",
    find: '.replace(/^-|-$/g, "")', replace: "", expect: "unsafe ID from" },
  { suite: "unit", label: "escapeHtml covers apostrophes", file: "web/map-manager.js",
    find: `"'": "&#39;"`, replace: `"\\u0000": "&#39;"`, expect: "escaping was not lossless" },
  { suite: "unit", label: "formatBytes guards non-finite sizes", file: "web/map-manager.js",
    find: 'if (!Number.isFinite(bytes)) return "Size unavailable";', replace: "", expect: "a non-finite size must read as unavailable" },
  { suite: "unit", label: "catalog results honour their limit", file: "web/map-manager.js",
    find: "const visibleRegions = regions.slice(0, Math.max(0, limit));", replace: "const visibleRegions = regions;",
    expect: "rendered more options than the limit allows" },
  { suite: "unit", label: "keyboard focus wraps inside the list", file: "web/map-manager.js",
    find: "count === 0 ? -1 : (current + direction + count) % count", replace: "current + direction",
    expect: "did not clear the focused option" },
  { suite: "unit", label: "only one build phase is live", file: "web/map-manager.js",
    find: 'index < activeIndex ? "complete" : failed ? "failed" : "current"', replace: '"current"',
    expect: "more than one phase claimed to be running" },
  { suite: "unit", label: "retry is offered only where it works", file: "web/map-manager.js",
    find: 'if (job.status !== "failed" || !["create", "rebuild"].includes(job.type)) return null;', replace: "",
    expect: "offered retry for a job that cannot be retried" },
  { suite: "unit", label: "request bodies must be JSON objects", file: "maintainer/src/api.js",
    find: 'if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {\n    throw clientError("Request body must be a JSON object");\n  }',
    replace: "", expect: "answered a client input with" },
  { suite: "unit", label: "malformed JSON is a client error", file: "maintainer/src/api.js",
    find: 'catch { throw clientError("Request body must be valid JSON"); }', replace: "catch (error) { throw error; }",
    expect: "answered a client input with" },
  { suite: "unit", label: "map IDs are length-bounded", file: "maintainer/src/map-library.js",
    find: "if (bounded && id.length > MAX_ID_LENGTH)", replace: "if (false)", expect: "passed validation and would fail later" },
  { suite: "unit", label: "internal failures are not echoed to the client", file: "maintainer/src/api.js",
    find: 'return json(response, 500, { error: "Map Room could not complete the request. Check the server logs." });',
    replace: "return json(response, 500, { error: error.message });", expect: "a filesystem path reached the client" },
  { suite: "unit", label: "status comes from the error, not its wording", file: "maintainer/src/api.js",
    find: "if (error.status) return json(response, error.status, { error: error.message });",
    replace: "if (/not found|not allowed|unknown|requires|must|too large|valid HTTPS/i.test(error.message)) return json(response, 400, { error: error.message });",
    expect: "tagged client error was reported as a server fault" },

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
    expect: "reported away from the form it belongs to" },
  { suite: "manager", label: "a filled form is guarded", file: "web/map-manager.js",
    find: 'document.querySelector("#manager-back").addEventListener("click", leaveCreateView);',
    replace: 'document.querySelector("#manager-back").addEventListener("click", () => showManagerView("library"));',
    expect: "discarded it without asking" },
  { suite: "manager", label: "a discarded form is cleared", file: "web/map-manager.js",
    find: '    resetCreateForm();\n    showManagerView("library");\n  });', replace: '    showManagerView("library");\n  });',
    expect: "reopened with its old values" },
  { suite: "manager", label: "rename happens in place", file: "web/map-manager.js",
    find: 'row.querySelector(".rename").addEventListener("click", () => {\n        openRows.add(map.id);',
    replace: 'row.querySelector(".rename").addEventListener("click", () => {\n        window.prompt("Map name", map.name);\n        openRows.add(map.id);',
    expect: "fell back to a browser dialog" },
  { suite: "manager", label: "polling does not clobber open rows", file: "web/map-manager.js",
    find: "if (mapState !== renderedMaps && openRows.size === 0)", replace: "if (mapState !== renderedMaps)",
    expect: "discarded the rename in progress" },
  { suite: "manager", label: "canceling a rename restores focus", file: "web/map-manager.js",
    find: '        actions.hidden = false;\n        row.querySelector(".rename").focus();', replace: "        actions.hidden = false;",
    expect: "restore focus to Rename" },
  { suite: "manager", label: "closing the manager clears row guards", file: "web/map-manager.js",
    find: "const close = () => { clearInterval(polling); polling = null; openRows.clear(); renderedMaps = null; dialog.close(); };",
    replace: "const close = () => { clearInterval(polling); polling = null; dialog.close(); };",
    expect: "froze the installed-map list" },
  { suite: "manager", label: "row guards are per row, not one slot", file: "web/map-manager.js",
    find: '      row.querySelector(".cancel-delete").addEventListener("click", () => {\n        openRows.delete(map.id);',
    replace: '      row.querySelector(".cancel-delete").addEventListener("click", () => {\n        openRows.clear();',
    expect: "let a refresh discard an open rename" },
  { suite: "manager", label: "escape closes an open row editor first", file: "web/map-manager.js",
    find: "    else if (openRow) openRow.closest(\".map-row\").querySelector(openRow.matches(\".rename-form\") ? \".cancel-rename\" : \".cancel-delete\").click();\n",
    replace: "", expect: "Escape while renaming closed the whole manager" },
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

// A mutant counts as killed only if the suite actually FAILED and the failure
// names this behavior. Matching output text alone is worthless: a test's name
// is printed when it passes too, so `expect` must be failure-only text and the
// exit status must confirm it.
async function survives({ suite, file, find, replace }) {
  const path = new URL(file, root);
  const original = await readFile(path, "utf8");
  if (!original.includes(find)) return { status: "STALE", detail: "mutation no longer applies to this source" };
  const restore = () => writeFileSync(fileURLToPath(path), original);
  process.on("SIGINT", restore);
  process.on("SIGTERM", restore);
  await writeFile(path, original.replace(find, replace));
  try {
    const [command, args] = suites[suite];
    const result = await run(command, args, { cwd: root, maxBuffer: 32 * 1024 * 1024 })
      .then(({ stdout, stderr }) => ({ stdout, stderr, failed: false }))
      .catch((error) => ({ stdout: error.stdout ?? "", stderr: error.stderr ?? "", failed: true }));
    return { output: `${result.stdout}${result.stderr}`, failed: result.failed };
  } finally {
    await writeFile(path, original);
    process.off("SIGINT", restore);
    process.off("SIGTERM", restore);
  }
}

const selected = MUTANTS.filter(({ suite }) => requested === "all" || requested === suite);
const skipManager = selected.some(({ suite }) => suite === "manager") && !await managerServerReachable();
if (skipManager) console.log(`SKIP manager mutants: no Map Room at ${baseUrl} (run npm run dev first)\n`);

const results = [];
for (const mutant of selected) {
  if (mutant.suite === "manager" && skipManager) { results.push([mutant, "SKIP", "no server"]); continue; }
  const { status, detail, output, failed } = await survives(mutant);
  if (status === "STALE") results.push([mutant, "STALE", detail]);
  else if (!failed) results.push([mutant, "SURVIVED", "the suite stayed green against this mutant"]);
  else if (!output.includes(mutant.expect)) {
    const caught = output.split("\n").filter((line) => line.startsWith("FAIL") || line.startsWith("✖")).slice(0, 2).join(" | ");
    results.push([mutant, "MISDIAGNOSED", `failed, but not on "${mutant.expect}" — ${caught}`]);
  } else results.push([mutant, "KILLED", mutant.expect]);
  const [, status_, detail_] = results.at(-1);
  console.log(`${status_.padEnd(9)} ${mutant.suite.padEnd(8)} ${mutant.label}${status_ === "KILLED" ? "" : ` — ${detail_}`}`);
}

const controls = results.filter(([mutant]) => mutant.control);
const brokenControl = controls.filter(([, status]) => status !== "SURVIVED");
const escaped = results.filter(([mutant, status]) => !mutant.control && ["SURVIVED", "STALE", "MISDIAGNOSED"].includes(status));
if (brokenControl.length) console.error("\nHARNESS BROKEN: a no-op control was reported as killed, so no verdict here can be trusted.");
const killed = results.filter(([mutant, status]) => !mutant.control && status === "KILLED").length;
const skipped = results.filter(([, status]) => status === "SKIP").length;
console.log(`\n${killed}/${selected.length - skipped - controls.length} mutants killed${skipped ? `, ${skipped} skipped` : ""} (${controls.length} control correctly survived)`);
if (escaped.length || brokenControl.length) {
  console.error(`\n${escaped.length} mutant(s) were not caught by any test:`);
  for (const [mutant, status, detail] of escaped) console.error(`  ${status} ${mutant.label} — ${detail}`);
  process.exit(1);
}
