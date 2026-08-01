export class ProgressTracker {
  constructor({ startedAt = Date.now() } = {}) {
    this.startedAt = startedAt;
  }

  update({ completedBytes, totalBytes, now = Date.now() }) {
    const elapsedSeconds = Math.max((now - this.startedAt) / 1000, 0.001);
    const bytesPerSecond = Math.round(completedBytes / elapsedSeconds);
    const percent = totalBytes ? Math.min(100, Math.round((completedBytes / totalBytes) * 1000) / 10) : null;
    const remainingBytes = totalBytes ? Math.max(0, totalBytes - completedBytes) : null;
    const etaSeconds = remainingBytes !== null && bytesPerSecond > 0
      ? Math.ceil(remainingBytes / bytesPerSecond)
      : null;
    return { completedBytes, totalBytes, percent, bytesPerSecond, etaSeconds };
  }
}
