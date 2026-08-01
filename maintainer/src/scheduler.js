export function shouldCheckForUpdates({ lastCheckedAt, intervalHours, now = Date.now() }) {
  if (!lastCheckedAt) return true;
  return now - Date.parse(lastCheckedAt) >= intervalHours * 60 * 60 * 1000;
}
