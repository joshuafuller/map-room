import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("starts a clean local X display before the tile renderer", async () => {
  const script = await readFile("scripts/server-entrypoint.sh", "utf8");

  assert.match(script, /rm -f .*\.X99-lock.*X99/);
  assert.match(script, /Xvfb.*-screen 0 1280x1024x24.*-nolisten tcp/);
  assert.match(script, /until \[\[ -S \/tmp\/\.X11-unix\/X99 \]\]/);
  assert.ok(script.indexOf("until [[ -S /tmp/.X11-unix/X99 ]]") < script.indexOf("exec node"));
});
