const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "Size unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
};

const describeSource = (source) => {
  if (source?.catalogId) return `Catalog · ${source.catalogId}`;
  if (source?.type === "upload" || source?.file) return "Uploaded PBF";
  if (source?.url) {
    try { return `HTTPS · ${new URL(source.url).hostname}`; } catch { return "HTTPS source"; }
  }
  return "Source unavailable";
};

const formatDuration = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainder}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const BUILD_PHASES = [
  { id: "acquire", label: "Acquire", phases: ["starting", "downloading"] },
  { id: "tiles", label: "Tiles", phases: ["building"] },
  { id: "check", label: "Check", phases: ["configuring"] },
  { id: "publish", label: "Publish", phases: ["activating"] }
];

const jobPhaseSteps = (job) => {
  if (job.status === "complete" || job.phase === "complete") return BUILD_PHASES.map((step) => ({ ...step, state: "complete" }));
  const failed = job.status === "failed" || job.phase === "failed";
  const activePhase = failed ? job.lastPhase : job.phase;
  const activeIndex = BUILD_PHASES.findIndex(({ phases }) => phases.includes(activePhase));
  return BUILD_PHASES.map((step, index) => ({
    ...step,
    state: activeIndex < 0 || index > activeIndex ? "future" : index < activeIndex ? "complete" : failed ? "failed" : "current"
  }));
};

const groupCatalogRegions = (regions) => {
  const groups = new Map();
  for (const region of regions) {
    const label = region.group || "Other regions";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(region);
  }
  return [...groups]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, items]) => ({ label, regions: items.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)) }));
};

const jobPresentation = (job, now = Date.now()) => {
  const started = Date.parse(job.startedAt ?? job.createdAt);
  const ended = job.completedAt ? Date.parse(job.completedAt) : now;
  const elapsed = `${job.completedAt ? "Completed in" : ""}${job.completedAt ? " " : ""}${formatDuration(ended - started)}${job.completedAt ? "" : " elapsed"}`;
  const progress = job.progress;
  const phases = {
    queued: ["Waiting for another map", "Queued — the current map build must finish first"],
    starting: ["Starting build", "Preparing the map build"],
    downloading: ["Downloading source", progress?.percent === null || progress?.percent === undefined
      ? `Downloading source · ${formatBytes(progress?.completedBytes)}`
      : `Downloading source · ${progress.percent}% · ${formatBytes(progress.completedBytes)} of ${formatBytes(progress.totalBytes)}${progress.bytesPerSecond ? ` · ${formatBytes(progress.bytesPerSecond)}/s` : ""}${Number.isFinite(progress.etaSeconds) ? ` · about ${formatDuration(progress.etaSeconds * 1000)} left` : ""}`],
    building: ["Generating vector tiles", "Generating vector tiles with Planetiler — still working"],
    configuring: ["Inspecting map", "Inspecting the completed map archive"],
    activating: ["Publishing map", "Publishing the map and refreshing the tile service"],
    complete: ["Map ready", "Build and publication complete"],
    failed: ["Build failed", "Map build failed"]
  };
  const [title, detail] = phases[job.phase] ?? ["Working", job.phase ?? "Working"];
  const error = /OutOfMemoryError|Java heap space/i.test(job.error ?? "")
    ? "The map build ran out of memory. Restart with MAP_ROOM_BUILD_MEMORY=4g (or higher for large regions) and retry."
    : job.error?.split("\n")[0] ?? null;
  return { title, detail, elapsed, error };
};

const slug = (value) => value.toLowerCase().normalize("NFKD").replace(/\p{Mark}+/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function setupMapManager({ onLibraryChanged = async () => {} } = {}) {
  const dialog = document.querySelector("#map-manager");
  const status = document.querySelector("#manager-status");
  const sourceType = document.querySelector("#map-source-type");
  const search = document.querySelector("#catalog-search");
  const region = document.querySelector("#catalog-region");
  const name = document.querySelector("#map-name");
  const id = document.querySelector("#map-id");
  let polling = null;
  let completedJobs = new Set();
  let renderedMaps = null;
  let renderedJobs = null;

  const request = async (url, options) => {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
    return payload;
  };

  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.style.color = error ? "#8a342d" : "#315e54";
  };

  const renderJobs = (jobs) => {
    const target = document.querySelector("#map-jobs");
    if (jobs.length === 0) { target.innerHTML = '<p class="empty-state">No map jobs yet.</p>'; return; }
    target.replaceChildren(...[...jobs].reverse().map((job) => {
      const row = document.createElement("article");
      row.className = "job-row";
      const percent = job.progress?.percent;
      const presentation = jobPresentation(job);
      const steps = jobPhaseSteps(job).map(({ id: stepId, label, state: stepState }) => `<li class="job-step ${stepState}"${stepState === "current" || stepState === "failed" ? ' aria-current="step"' : ""}><span class="job-step-dot" aria-hidden="true"></span><span>${escapeHtml(label)}</span><span class="sr-only">${escapeHtml(stepState)}</span></li>`).join("");
      row.innerHTML = `<div class="job-row-head"><div><strong>${escapeHtml(job.name ?? job.regionId)}</strong><span class="map-meta">${escapeHtml(presentation.detail)} · ${escapeHtml(presentation.elapsed)}</span></div><span class="job-state ${job.status === "failed" ? "failed" : ""}">${escapeHtml(presentation.title)}</span></div><ol class="job-steps" aria-label="Map build phases">${steps}</ol>${percent === null || percent === undefined ? "" : `<progress class="job-progress" max="100" value="${Number(percent)}">${Number(percent)}%</progress>`}${presentation.error ? `<p class="job-error"></p>` : ""}`;
      if (presentation.error) row.querySelector(".job-error").textContent = presentation.error;
      return row;
    }));
  };

  const renderMaps = (maps) => {
    const target = document.querySelector("#installed-maps");
    if (maps.length === 0) { target.innerHTML = '<p class="empty-state">No maps installed. Add the first one above.</p>'; return; }
    target.replaceChildren(...maps.map((map) => {
      const row = document.createElement("article");
      row.className = "map-row";
      const generated = map.generatedAt ? new Date(map.generatedAt).toLocaleDateString() : "Unknown build date";
      row.innerHTML = `<div class="map-row-head"><div><strong></strong><span class="map-meta"></span></div></div><div class="map-actions"><button class="small-action rename" type="button">Rename</button><button class="small-action rebuild" type="button" ${map.canRebuild ? "" : "disabled"}>Rebuild</button><button class="small-action danger delete" type="button">Delete</button></div><div class="delete-confirm" hidden><input aria-label="Type map ID to confirm deletion" placeholder="Type ${map.id}" /><button class="small-action danger confirm-delete" type="button">Delete permanently</button></div>`;
      row.querySelector("strong").textContent = map.name;
      row.querySelector(".map-meta").textContent = `${map.id} · ${formatBytes(map.archiveBytes)} · ${describeSource(map.source)} · built ${generated}`;
      row.querySelector(".rename").addEventListener("click", async () => {
        const next = window.prompt("Map name", map.name);
        if (!next || next === map.name) return;
        await action(() => request(`/api/maps/${map.id}`, { method: "PATCH", body: JSON.stringify({ name: next }) }), "Map renamed", true);
      });
      row.querySelector(".rebuild").addEventListener("click", () => action(() => request(`/api/maps/${map.id}/rebuild`, { method: "POST" }), "Rebuild queued"));
      row.querySelector(".delete").addEventListener("click", () => { row.querySelector(".delete-confirm").hidden = false; row.querySelector(".delete-confirm input").focus(); });
      row.querySelector(".confirm-delete").addEventListener("click", async () => {
        const confirmation = row.querySelector(".delete-confirm input").value;
        await action(() => request(`/api/maps/${map.id}?confirm=${encodeURIComponent(confirmation)}`, { method: "DELETE" }), "Map deleted", true);
      });
      return row;
    }));
  };

  const refresh = async () => {
    const { maps, jobs } = await request("/api/maps");
    const mapState = JSON.stringify(maps);
    const activeClock = jobs.some(({ status: jobStatus }) => jobStatus === "queued" || jobStatus === "running") ? Math.floor(Date.now() / 1000) : null;
    const jobState = JSON.stringify([jobs, activeClock]);
    if (mapState !== renderedMaps) { renderMaps(maps); renderedMaps = mapState; }
    if (jobState !== renderedJobs) { renderJobs(jobs); renderedJobs = jobState; }
    const newlyCompleted = jobs.filter(({ status, id: jobId }) => status === "complete" && !completedJobs.has(jobId));
    completedJobs = new Set(jobs.filter(({ status }) => status === "complete").map(({ id: jobId }) => jobId));
    if (newlyCompleted.length) await onLibraryChanged();
  };

  const action = async (operation, message, libraryChanged = false) => {
    try { await operation(); setStatus(message); await refresh(); if (libraryChanged) await onLibraryChanged(); }
    catch (error) { setStatus(error.message, true); }
  };

  const searchCatalog = async () => {
    const { regions } = await request(`/api/catalog?q=${encodeURIComponent(search.value)}`);
    const groups = groupCatalogRegions(regions);
    region.replaceChildren();
    const prompt = document.createElement("option");
    prompt.value = "";
    prompt.textContent = regions.length ? "Choose a region" : "No matching regions";
    region.append(prompt);
    for (const group of groups) {
      const options = document.createElement("optgroup");
      options.label = group.label;
      for (const item of group.regions) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = `${item.name}${item.isoCode ? ` (${item.isoCode})` : ""}`;
        option.dataset.name = item.name;
        options.append(option);
      }
      region.append(options);
    }
    const summary = document.querySelector("#catalog-summary");
    summary.textContent = regions.length === 0 ? "No regions match this search." : `${regions.length} ${regions.length === 1 ? "region" : "regions"} in ${groups.length} geographic ${groups.length === 1 ? "group" : "groups"}.`;
  };

  const updateSourceFields = () => {
    for (const type of ["catalog", "upload", "url"]) {
      const fields = document.querySelector(`#${type}-fields`);
      const active = sourceType.value === type;
      fields.hidden = !active;
      for (const control of fields.querySelectorAll("input, select")) control.disabled = !active;
    }
    region.required = sourceType.value === "catalog";
    document.querySelector("#map-upload").required = sourceType.value === "upload";
    document.querySelector("#map-source-url").required = sourceType.value === "url";
  };
  sourceType.addEventListener("change", updateSourceFields);
  updateSourceFields();
  search.addEventListener("input", () => { clearTimeout(search.timeout); search.timeout = setTimeout(() => action(searchCatalog, "Catalog updated"), 250); });
  region.addEventListener("change", () => {
    const option = region.selectedOptions[0];
    if (!option?.value) return;
    name.value = option.dataset.name;
    id.value = slug(option.dataset.name);
  });
  document.querySelector("#map-create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const type = sourceType.value;
    await action(async () => {
      if (type === "upload") {
        const file = document.querySelector("#map-upload").files[0];
        if (!file) throw new Error("Choose an .osm.pbf file");
        return request(`/api/maps/import?id=${encodeURIComponent(id.value)}&name=${encodeURIComponent(name.value)}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: file });
      }
      return request("/api/maps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceType: type, catalogId: region.value, url: document.querySelector("#map-source-url").value, id: id.value, name: name.value }) });
    }, "Map build queued");
  });
  document.querySelector("#manage-maps").addEventListener("click", async () => {
    dialog.showModal();
    await action(async () => { await Promise.all([refresh(), searchCatalog()]); }, "Map library ready");
    polling = setInterval(() => refresh().catch((error) => setStatus(error.message, true)), 2000);
  });
  const close = () => { clearInterval(polling); polling = null; dialog.close(); };
  document.querySelector("#manager-close").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });

  return { refresh, formatBytes, slug };
}

export { describeSource, escapeHtml, formatBytes, groupCatalogRegions, jobPhaseSteps, jobPresentation, slug };
