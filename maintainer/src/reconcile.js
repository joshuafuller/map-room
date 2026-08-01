export function planReconciliation({ selections = [], installed = [] }) {
  const installedByRegion = new Map(installed.map((map) => [map.regionId, map]));
  const seen = new Set();
  const jobs = [];

  for (const selection of selections) {
    if (!selection.enabled || seen.has(selection.regionId)) continue;
    seen.add(selection.regionId);
    const local = installedByRegion.get(selection.regionId);
    if (!local) {
      jobs.push({ type: "install", regionId: selection.regionId, reason: "missing" });
      continue;
    }
    if (selection.autoUpdate && local.availableTimestamp && local.sourceTimestamp &&
        Date.parse(local.availableTimestamp) > Date.parse(local.sourceTimestamp)) {
      jobs.push({ type: "update", regionId: selection.regionId, reason: "source-newer" });
    }
  }
  return jobs;
}
