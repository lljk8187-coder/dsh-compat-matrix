import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "src", "cli.ts");

describe("cli --help", () => {
  it("prints usage and stub commands", () => {
    const result = spawnSync("npx", ["tsx", cli, "--help"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, npm_config_yes: "true" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /dsh-compat-matrix/);
    assert.match(result.stdout, /probe/);
    assert.match(result.stdout, /run/);
    assert.match(result.stdout, /NOT IMPLEMENTED/);
  });
});
