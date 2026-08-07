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

const catalogResultGroups = (regions, limit = 40) => {
  const visibleRegions = regions.slice(0, Math.max(0, limit));
  return {
    groups: groupCatalogRegions(visibleRegions),
    total: regions.length,
    visible: visibleRegions.length,
    truncated: regions.length > visibleRegions.length
  };
};

const catalogShortcutRegions = (maps, recent) => {
  const shortcuts = [];
  const seen = new Set();
  for (const map of maps) {
    const catalogId = map.source?.catalogId;
    if (!catalogId || seen.has(catalogId)) continue;
    seen.add(catalogId);
    shortcuts.push({ id: catalogId, name: map.name, group: "Installed maps", installed: true });
  }
  for (const item of recent) {
    if (!item?.id || !item?.name || seen.has(item.id)) continue;
    seen.add(item.id);
    shortcuts.push({ id: item.id, name: item.name, group: "Recent regions" });
  }
  return shortcuts;
};

const moveCatalogFocus = (current, direction, count) => count === 0 ? -1 : (current + direction + count) % count;

const jobPresentation = (job, now = Date.now()) => {
  const started = Date.parse(job.startedAt ?? job.createdAt);
  const ended = job.completedAt ? Date.parse(job.completedAt) : now;
  const elapsed = `${job.completedAt ? "Completed in" : ""}${job.completedAt ? " " : ""}${formatDuration(ended - started)}${job.completedAt ? "" : " elapsed"}`;
  const progress = job.progress;
  const phases = {
    queued: ["Waiting for another map", "Queued — the current map build must finish first"],
    starting: ["Starting build", "Preparing the map build"],
    downloading: [job.sourceMode === "resumed" ? "Resuming source" : "Downloading source", progress?.percent === null || progress?.percent === undefined
      ? `${job.sourceMode === "resumed" ? "Resuming" : "Downloading"} source · ${formatBytes(progress?.completedBytes)}`
      : `${job.sourceMode === "resumed" ? "Resuming" : "Downloading"} source · ${progress.percent}% · ${formatBytes(progress.completedBytes)} of ${formatBytes(progress.totalBytes)}${progress.bytesPerSecond ? ` · ${formatBytes(progress.bytesPerSecond)}/s` : ""}${Number.isFinite(progress.etaSeconds) ? ` · about ${formatDuration(progress.etaSeconds * 1000)} left` : ""}`],
    building: ["Generating vector tiles", `${job.sourceMode === "reused" ? "Reusing verified source · " : job.sourceMode === "resumed" ? "Resumed source complete · " : ""}Generating vector tiles with Planetiler — still working`],
    configuring: ["Inspecting map", "Inspecting the completed map archive"],
    activating: ["Publishing map", "Publishing the map and refreshing the tile service"],
    complete: ["Map ready", "Build and publication complete"],
    failed: ["Build failed", "Map build failed"]
  };
  const [title, detail] = phases[job.phase] ?? ["Working", job.phase ?? "Working"];
  const error = /OutOfMemoryError|Java heap space/i.test(job.error ?? "")
    ? "The map build ran out of memory. Retry with 4 GB; larger regions may need 8 GB or more."
    : job.error?.split("\n")[0] ?? null;
  return { title, detail, elapsed, error };
};

const retryAction = (job) => {
  if (job.status !== "failed" || !["create", "rebuild"].includes(job.type)) return null;
  if (/OutOfMemoryError|Java heap space/i.test(job.error ?? "")) {
    const nextMemory = ({ "4g": "8g", "8g": "12g", "12g": "16g", "16g": "16g" })[job.buildMemory] ?? "4g";
    return { label: `Retry with ${nextMemory.replace("g", " GB")}`, buildMemory: nextMemory };
  }
  return { label: "Retry build", buildMemory: null };
};

const slug = (value) => value.toLowerCase().normalize("NFKD").replace(/\p{Mark}+/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function setupMapManager({ onLibraryChanged = async () => {} } = {}) {
  const dialog = document.querySelector("#map-manager");
  const status = document.querySelector("#manager-status");
  const sourceType = document.querySelector("#map-source-type");
  const search = document.querySelector("#catalog-search");
  const region = document.querySelector("#catalog-region");
  const results = document.querySelector("#catalog-results");
  const summary = document.querySelector("#catalog-summary");
  const name = document.querySelector("#map-name");
  const id = document.querySelector("#map-id");
  const libraryView = document.querySelector("#manager-library-view");
  const createView = document.querySelector("#manager-create-view");
  const addMap = document.querySelector("#manager-add-map");
  const managerTitle = document.querySelector("#manager-title");
  const form = document.querySelector("#map-create-form");
  const createStatus = document.querySelector("#create-status");
  const discard = document.querySelector("#create-discard");
  const jobsSection = document.querySelector("#jobs-section");
  const upload = document.querySelector("#map-upload");
  const sourceUrl = document.querySelector("#map-source-url");
  let polling = null;
  let rowInteraction = null;
  let completedJobs = new Set();
  let renderedMaps = null;
  let renderedJobs = null;
  let installedMaps = [];
  let catalogOptions = [];
  let focusedCatalogOption = -1;
  let catalogRequest = 0;
  let suggestedId = "";

  const loadRecentRegions = () => {
    try {
      const value = JSON.parse(localStorage.getItem("map-room-recent-regions") ?? "[]");
      return Array.isArray(value) ? value.slice(0, 5) : [];
    } catch { return []; }
  };

  const rememberRegion = (item) => {
    try {
      const recent = [{ id: item.id, name: item.name, group: item.group }, ...loadRecentRegions().filter(({ id: recentId }) => recentId !== item.id)].slice(0, 5);
      localStorage.setItem("map-room-recent-regions", JSON.stringify(recent));
    } catch { /* Private browsing may disable storage. */ }
  };

  const request = async (url, options) => {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
    return payload;
  };

  // Report each outcome next to the work that produced it, never on the view the operator just left.
  const setStatus = (message, error = false) => {
    const target = createView.hidden ? status : createStatus;
    const other = createView.hidden ? createStatus : status;
    other.textContent = "";
    target.textContent = message;
    target.style.color = error ? "#8a342d" : "#315e54";
  };

  const showManagerView = (view, { focus = true, clearStatus = true } = {}) => {
    const creating = view === "create";
    libraryView.hidden = creating;
    createView.hidden = !creating;
    managerTitle.textContent = creating ? "Create map" : "Manage maps";
    discard.hidden = true;
    if (clearStatus) { status.textContent = ""; createStatus.textContent = ""; }
    closeCatalog();
    if (!focus) return;
    if (creating) (sourceType.value === "catalog" ? search : sourceType).focus();
    else addMap.focus();
  };

  const createDirty = () => Boolean(name.value.trim() || search.value.trim() || region.value || sourceUrl.value.trim() || upload.files.length);

  const resetCreateForm = () => {
    form.reset();
    region.value = "";
    suggestedId = "";
    updateSourceFields();
    summary.textContent = "Search by region, country, provider ID, or geographic group.";
  };

  // Backing out of a half-filled form is only safe if the operator meant it.
  const leaveCreateView = () => {
    if (!createDirty()) { resetCreateForm(); showManagerView("library"); return; }
    closeCatalog();
    discard.hidden = false;
    document.querySelector("#create-keep").focus();
  };

  const renderJobs = (jobs) => {
    const target = document.querySelector("#map-jobs");
    jobsSection.hidden = jobs.length === 0;
    if (jobs.length === 0) { target.replaceChildren(); return; }
    target.replaceChildren(...[...jobs].reverse().map((job) => {
      const row = document.createElement("article");
      row.className = "job-row";
      const percent = job.progress?.percent;
      const presentation = jobPresentation(job);
      const retry = retryAction(job);
      const steps = jobPhaseSteps(job).map(({ id: stepId, label, state: stepState }) => `<li class="job-step ${stepState}"${stepState === "current" || stepState === "failed" ? ' aria-current="step"' : ""}><span class="job-step-dot" aria-hidden="true"></span><span>${escapeHtml(label)}</span><span class="sr-only">${escapeHtml(stepState)}</span></li>`).join("");
      row.innerHTML = `<div class="job-row-head"><div><strong>${escapeHtml(job.name ?? job.regionId)}</strong><span class="map-meta">${escapeHtml(presentation.detail)} · ${escapeHtml(presentation.elapsed)}</span></div><span class="job-state ${job.status === "failed" ? "failed" : ""}">${escapeHtml(presentation.title)}</span></div><ol class="job-steps" aria-label="Map build phases">${steps}</ol>${percent === null || percent === undefined ? "" : `<progress class="job-progress" max="100" value="${Number(percent)}">${Number(percent)}%</progress>`}${presentation.error ? `<p class="job-error"></p>` : ""}${retry ? `<div class="job-actions"><button class="small-action retry-job" type="button">${escapeHtml(retry.label)}</button></div>` : ""}`;
      if (presentation.error) row.querySelector(".job-error").textContent = presentation.error;
      if (retry) row.querySelector(".retry-job").addEventListener("click", () => action(
        () => request(`/api/jobs/${job.id}/retry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buildMemory: retry.buildMemory }) }),
        "Map retry queued"
      ));
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
      row.innerHTML = `<div class="map-row-head"><div><strong></strong><span class="map-meta"></span></div></div><div class="map-actions"><button class="small-action rename" type="button">Rename</button><button class="small-action rebuild" type="button" ${map.canRebuild ? "" : "disabled"}>Rebuild</button><button class="small-action danger delete" type="button">Delete</button></div><form class="rename-form" hidden><label class="sr-only" for="rename-${escapeHtml(map.id)}">Map name</label><input id="rename-${escapeHtml(map.id)}" class="rename-input" maxlength="120" required /><div class="rename-actions"><button class="small-action cancel-rename" type="button">Cancel</button><button class="small-action save-rename" type="submit">Save name</button></div></form><div class="delete-confirm" role="group" hidden><p class="delete-question"></p><div class="delete-confirm-actions"><button class="small-action cancel-delete" type="button">Cancel</button><button class="small-action danger confirm-delete" type="button">Delete map</button></div></div>`;
      row.querySelector("strong").textContent = map.name;
      row.querySelector(".map-meta").textContent = `${map.id} · ${formatBytes(map.archiveBytes)} · ${describeSource(map.source)} · built ${generated}`;
      row.querySelector(".delete-question").textContent = `Are you sure you want to delete ${map.name}?`;
      const renameForm = row.querySelector(".rename-form");
      const renameInput = row.querySelector(".rename-input");
      const actions = row.querySelector(".map-actions");
      const closeRename = () => {
        rowInteraction = null;
        renameForm.hidden = true;
        actions.hidden = false;
        row.querySelector(".rename").focus();
      };
      row.querySelector(".rename").addEventListener("click", () => {
        rowInteraction = map.id;
        renameInput.value = map.name;
        renameForm.hidden = false;
        actions.hidden = true;
        renameInput.focus();
        renameInput.select();
      });
      row.querySelector(".cancel-rename").addEventListener("click", closeRename);
      renameForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const next = renameInput.value.trim();
        if (!next || next === map.name) { closeRename(); return; }
        rowInteraction = null;
        renderedMaps = null;
        await action(() => request(`/api/maps/${map.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: next }) }), "Map renamed", true);
      });
      row.querySelector(".rebuild").addEventListener("click", () => action(() => request(`/api/maps/${map.id}/rebuild`, { method: "POST" }), "Rebuild queued"));
      row.querySelector(".delete").addEventListener("click", () => {
        rowInteraction = map.id;
        row.querySelector(".delete-confirm").hidden = false;
        row.querySelector(".cancel-delete").focus();
      });
      row.querySelector(".cancel-delete").addEventListener("click", () => {
        rowInteraction = null;
        row.querySelector(".delete-confirm").hidden = true;
        row.querySelector(".delete").focus();
      });
      row.querySelector(".confirm-delete").addEventListener("click", async () => {
        rowInteraction = null;
        renderedMaps = null;
        await action(() => request(`/api/maps/${map.id}?confirm=${encodeURIComponent(map.id)}`, { method: "DELETE" }), "Map deleted", true);
      });
      return row;
    }));
  };

  const refresh = async () => {
    const { maps, jobs } = await request("/api/maps");
    installedMaps = maps;
    const mapState = JSON.stringify(maps);
    const activeClock = jobs.some(({ status: jobStatus }) => jobStatus === "queued" || jobStatus === "running") ? Math.floor(Date.now() / 1000) : null;
    const jobState = JSON.stringify([jobs, activeClock]);
    // Re-rendering a row would destroy an open rename editor or delete confirmation mid-use.
    if (mapState !== renderedMaps && rowInteraction === null) { renderMaps(maps); renderedMaps = mapState; }
    if (jobState !== renderedJobs) { renderJobs(jobs); renderedJobs = jobState; }
    const newlyCompleted = jobs.filter(({ status, id: jobId }) => status === "complete" && !completedJobs.has(jobId));
    completedJobs = new Set(jobs.filter(({ status }) => status === "complete").map(({ id: jobId }) => jobId));
    if (newlyCompleted.length) await onLibraryChanged();
  };

  const action = async (operation, message, libraryChanged = false) => {
    try { await operation(); setStatus(message); await refresh(); if (libraryChanged) await onLibraryChanged(); return true; }
    catch (error) { setStatus(error.message, true); return false; }
  };

  const closeCatalog = () => {
    results.hidden = true;
    search.setAttribute("aria-expanded", "false");
    search.removeAttribute("aria-activedescendant");
    focusedCatalogOption = -1;
  };

  const focusCatalogOption = (index) => {
    focusedCatalogOption = index;
    const options = [...results.querySelectorAll(".catalog-option")];
    options.forEach((option, optionIndex) => {
      const active = optionIndex === index;
      option.classList.toggle("active", active);
      option.setAttribute("aria-selected", String(active));
    });
    if (index < 0) search.removeAttribute("aria-activedescendant");
    else {
      search.setAttribute("aria-activedescendant", options[index].id);
      options[index].scrollIntoView({ block: "nearest" });
    }
  };

  const chooseCatalogRegion = (item) => {
    region.value = item.id;
    search.value = item.name;
    name.value = item.name;
    suggestedId = slug(item.name);
    id.value = suggestedId;
    rememberRegion(item);
    summary.textContent = `${item.name} selected · ${item.group || item.id}`;
    closeCatalog();
  };

  const renderCatalogResults = (regions, { shortcuts = false } = {}) => {
    const result = catalogResultGroups(regions);
    catalogOptions = result.groups.flatMap(({ regions: items }) => items);
    results.replaceChildren();
    let optionIndex = 0;
    for (const group of result.groups) {
      const section = document.createElement("section");
      section.className = "catalog-result-group";
      section.setAttribute("role", "group");
      section.setAttribute("aria-label", group.label);
      const heading = document.createElement("p");
      heading.className = "catalog-group-label";
      heading.textContent = group.label;
      section.append(heading);
      for (const item of group.regions) {
        const option = document.createElement("button");
        option.id = `catalog-option-${optionIndex}`;
        option.className = "catalog-option";
        option.type = "button";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.dataset.regionId = item.id;
        option.innerHTML = `<strong>${escapeHtml(item.name)}</strong><span>${escapeHtml([item.isoCode, item.group, item.id].filter(Boolean).join(" · "))}</span>`;
        option.addEventListener("pointerdown", (event) => event.preventDefault());
        option.addEventListener("click", () => chooseCatalogRegion(item));
        section.append(option);
        optionIndex += 1;
      }
      results.append(section);
    }
    focusedCatalogOption = -1;
    results.hidden = result.visible === 0;
    search.setAttribute("aria-expanded", String(result.visible > 0));
    if (shortcuts) summary.textContent = result.visible ? "Installed and recently selected regions." : "Type at least 2 characters to search every available region.";
    else if (result.total === 0) summary.textContent = "No regions match this search.";
    else if (result.truncated) summary.textContent = `Showing ${result.visible} of ${result.total} matches. Keep typing to narrow the results.`;
    else summary.textContent = `${result.total} ${result.total === 1 ? "region" : "regions"} in ${result.groups.length} geographic ${result.groups.length === 1 ? "group" : "groups"}.`;
  };

  const showCatalogShortcuts = () => renderCatalogResults(catalogShortcutRegions(installedMaps, loadRecentRegions()), { shortcuts: true });

  const searchCatalog = async () => {
    const query = search.value.trim();
    region.value = "";
    if (query.length < 2) { showCatalogShortcuts(); return; }
    const requestId = ++catalogRequest;
    summary.textContent = "Searching regional catalog…";
    try {
      const { regions } = await request(`/api/catalog?q=${encodeURIComponent(query)}`);
      if (requestId === catalogRequest) renderCatalogResults(regions);
    } catch (error) {
      if (requestId !== catalogRequest) return;
      closeCatalog();
      summary.textContent = "Regional catalog could not be loaded. Try again.";
      setStatus(error.message, true);
    }
  };

  const updateSourceFields = () => {
    for (const type of ["catalog", "upload", "url"]) {
      const fields = document.querySelector(`#${type}-fields`);
      const active = sourceType.value === type;
      fields.hidden = !active;
      for (const control of fields.querySelectorAll("input, select")) control.disabled = !active;
    }
    document.querySelector("#map-upload").required = sourceType.value === "upload";
    document.querySelector("#map-source-url").required = sourceType.value === "url";
  };
  sourceType.addEventListener("change", updateSourceFields);
  updateSourceFields();
  search.addEventListener("focus", () => {
    if (search.value.trim().length < 2) showCatalogShortcuts();
  });
  search.addEventListener("input", () => {
    clearTimeout(search.timeout);
    if (search.value.trim().length < 2) showCatalogShortcuts();
    else search.timeout = setTimeout(searchCatalog, 250);
  });
  search.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
    // Escape belongs to the open list first, and only then to the creation view.
    if (event.key === "Escape") { if (!results.hidden) { event.preventDefault(); closeCatalog(); } return; }
    if (event.key === "Enter") {
      if (focusedCatalogOption >= 0) { event.preventDefault(); chooseCatalogRegion(catalogOptions[focusedCatalogOption]); }
      return;
    }
    event.preventDefault();
    if (results.hidden && search.value.trim().length < 2) showCatalogShortcuts();
    focusCatalogOption(moveCatalogFocus(focusedCatalogOption, event.key === "ArrowDown" ? 1 : -1, catalogOptions.length));
  });
  search.addEventListener("blur", () => setTimeout(closeCatalog, 100));
  name.addEventListener("input", () => {
    const nextSuggestion = slug(name.value);
    if (!id.value || id.value === suggestedId) id.value = nextSuggestion;
    suggestedId = nextSuggestion;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const type = sourceType.value;
    const created = await action(async () => {
      if (type === "upload") {
        const file = document.querySelector("#map-upload").files[0];
        if (!file) throw new Error("Choose an .osm.pbf file");
        return request(`/api/maps/import?id=${encodeURIComponent(id.value)}&name=${encodeURIComponent(name.value)}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: file });
      }
      if (type === "catalog" && !region.value) throw new Error("Choose a map region from the search results");
      return request("/api/maps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceType: type, catalogId: region.value, url: document.querySelector("#map-source-url").value, id: id.value, name: name.value }) });
    }, "Map build queued");
    if (created) {
      resetCreateForm();
      showManagerView("library", { focus: false });
      setStatus("Map build queued");
      document.querySelector("#jobs-title").focus();
    }
  });
  addMap.addEventListener("click", () => showManagerView("create"));
  document.querySelector("#manager-back").addEventListener("click", leaveCreateView);
  document.querySelector("#create-keep").addEventListener("click", () => {
    discard.hidden = true;
    document.querySelector("#manager-back").focus();
  });
  document.querySelector("#create-discard-confirm").addEventListener("click", () => {
    resetCreateForm();
    showManagerView("library");
  });
  document.querySelector("#manage-maps").addEventListener("click", async () => {
    showManagerView("library", { focus: false });
    dialog.showModal();
    await action(async () => { await refresh(); showCatalogShortcuts(); }, "Map library ready");
    polling = setInterval(() => refresh().catch((error) => setStatus(error.message, true)), 2000);
  });
  const close = () => { clearInterval(polling); polling = null; dialog.close(); };
  document.querySelector("#manager-close").addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (!discard.hidden) discard.hidden = true;
    else if (!createView.hidden) leaveCreateView();
    else close();
  });

  return { refresh, formatBytes, slug };
}

export { catalogResultGroups, catalogShortcutRegions, describeSource, escapeHtml, formatBytes, groupCatalogRegions, jobPhaseSteps, jobPresentation, moveCatalogFocus, retryAction, slug };
