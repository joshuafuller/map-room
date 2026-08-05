import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

export class TileSupervisor {
  constructor({ command = process.execPath, args = ["/usr/src/app/", "--config", "/data/archive/runtime/config.json", "--port", "8081"], spawnImpl = spawn, fetchImpl = fetch } = {}) {
    this.command = command;
    this.args = args;
    this.spawnImpl = spawnImpl;
    this.fetchImpl = fetchImpl;
    this.child = null;
  }

  async restart(enabled = true) {
    await this.stop();
    if (!enabled) return;
    this.child = this.spawnImpl(this.command, this.args, { stdio: "inherit", env: process.env });
    this.child.once("exit", () => { this.child = null; });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const response = await this.fetchImpl("http://127.0.0.1:8081/health");
        if (response.ok) return;
      } catch {}
      await delay(250);
    }
    await this.stop();
    throw new Error("Tile server did not become ready");
  }

  async stop() {
    const child = this.child;
    if (!child) return;
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    });
    this.child = null;
  }
}
