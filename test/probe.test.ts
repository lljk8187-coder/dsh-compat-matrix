import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "src", "cli.ts");

const PATH_WITH_NODE22 = [
  "/home/box/.local/node22/bin",
  "/home/box/.local/bin",
  process.env.PATH ?? "",
].join(":");

function dshAvailable(): boolean {
  const sep = process.platform === "win32" ? ";" : ":";
  for (const dir of PATH_WITH_NODE22.split(sep)) {
    if (!dir) continue;
    try {
      accessSync(path.join(dir, "dsh"), constants.X_OK);
      return true;
    } catch {
      try {
        accessSync(path.join(dir, "dsh"), constants.F_OK);
        return true;
      } catch {
        // continue
      }
    }
  }
  return false;
}

type ProbeJson = {
  install_ok: boolean;
  config_hang_ok: boolean;
  load_ok: boolean;
  error_stage?: string;
  duration_ms?: number;
  packageName?: string;
};

async function runProbeCli(fixtureRel: string): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
  parsed: ProbeJson;
}> {
  const fixture = path.join(root, "fixtures", fixtureRel);
  const result = await new Promise<{
    status: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const child = spawn("npx", ["tsx", cli, "probe", fixture], {
      cwd: root,
      env: {
        ...process.env,
        npm_config_yes: "true",
        PATH: PATH_WITH_NODE22,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c: string) => {
      stdout += c;
    });
    child.stderr.on("data", (c: string) => {
      stderr += c;
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 240_000);
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });

  const jsonStart = result.stdout.indexOf("{");
  assert.ok(
    jsonStart >= 0,
    `expected JSON on stdout for ${fixtureRel}:\nstdout=${result.stdout}\nstderr=${result.stderr}`,
  );
  const parsed = JSON.parse(result.stdout.slice(jsonStart)) as ProbeJson;
  return { ...result, parsed };
}

describe("probe three-state fixtures", () => {
  it("hello-plugin → all three true when dsh installed, else skip", async (t) => {
    if (!dshAvailable()) {
      t.skip(
        "dsh not installed — install with: npm install -g @deepseek-ai/dsh (Node ≥22.19) and pnpm; CI may skip this test",
      );
      return;
    }

    const result = await runProbeCli("hello-plugin");
    assert.equal(
      result.status,
      0,
      `hello-plugin probe failed:\nstdout=${result.stdout}\nstderr=${result.stderr}`,
    );
    assert.equal(result.parsed.install_ok, true);
    assert.equal(result.parsed.config_hang_ok, true);
    assert.equal(result.parsed.load_ok, true);
    assert.equal(result.parsed.error_stage, undefined);
    assert.equal(typeof result.parsed.duration_ms, "number");
  });

  it("no-bundle-plugin → install true, hang false when dsh installed, else skip", async (t) => {
    if (!dshAvailable()) {
      t.skip(
        "dsh not installed — install with: npm install -g @deepseek-ai/dsh (Node ≥22.19) and pnpm; CI may skip this test",
      );
      return;
    }

    const result = await runProbeCli("no-bundle-plugin");
    assert.notEqual(
      result.status,
      0,
      `no-bundle-plugin expected non-zero exit:\nstdout=${result.stdout}\nstderr=${result.stderr}`,
    );
    assert.equal(result.parsed.install_ok, true);
    assert.equal(result.parsed.config_hang_ok, false);
    assert.equal(result.parsed.error_stage, "config_hang");
  });

  it("bad-patch-plugin → install false, error_stage install when dsh installed, else skip", async (t) => {
    if (!dshAvailable()) {
      t.skip(
        "dsh not installed — install with: npm install -g @deepseek-ai/dsh (Node ≥22.19) and pnpm; CI may skip this test",
      );
      return;
    }

    const result = await runProbeCli("bad-patch-plugin");
    assert.notEqual(
      result.status,
      0,
      `bad-patch-plugin expected non-zero exit:\nstdout=${result.stdout}\nstderr=${result.stderr}`,
    );
    assert.equal(result.parsed.install_ok, false);
    assert.equal(result.parsed.config_hang_ok, false);
    assert.equal(result.parsed.load_ok, false);
    assert.equal(result.parsed.error_stage, "install");
  });
});
