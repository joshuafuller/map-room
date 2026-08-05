let revision = null;

async function checkForChanges() {
  try {
    const response = await fetch("/api/dev/revision", { cache: "no-store" });
    if (response.status === 404) return;
    if (!response.ok) throw new Error(`Development revision returned HTTP ${response.status}`);
    const current = (await response.text()).trim();
    if (revision && current !== revision) window.location.reload();
    revision = current;
  } catch {
    // A watched backend restart briefly interrupts polling. Keep trying until
    // the replacement process is ready and exposes its new revision.
  }
  window.setTimeout(checkForChanges, 750);
}

checkForChanges();
