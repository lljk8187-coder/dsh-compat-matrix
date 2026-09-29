import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { parseOutDirArg } from "../src/runner/index.js";

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

describe("parseOutDirArg", () => {
  it("defaults to ./out", () => {
    assert.equal(parseOutDirArg([]), "./out");
  });
  it("accepts --out-dir <path>", () => {
    assert.equal(parseOutDirArg(["--out-dir", "./tmp-out"]), "./tmp-out");
  });
  it("accepts --out-dir=<path>", () => {
    assert.equal(parseOutDirArg(["--out-dir=./eq-out"]), "./eq-out");
  });
});

describe("cli run smoke", () => {
  it("writes report.json + report.md when dsh installed, else skip", async (t) => {
    if (!dshAvailable()) {
      t.skip(
        "dsh not installed — install with: npm install -g @deepseek-ai/dsh (Node ≥22.19) and pnpm; CI may skip this test",
      );
      return;
    }

    const outDir = mkdtempSync(path.join(tmpdir(), "dsh-compat-run-"));
    try {
      const result = await new Promise<{
        status: number | null;
        stdout: string;
        stderr: string;
      }>((resolve) => {
        const child = spawn(
          "npx",
          ["tsx", cli, "run", "--out-dir", outDir],
          {
            cwd: root,
            env: {
              ...process.env,
              npm_config_yes: "true",
              PATH: PATH_WITH_NODE22,
            },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
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
        }, 600_000);
        child.on("close", (status) => {
          clearTimeout(timer);
          resolve({ status, stdout, stderr });
        });
      });

      // Default fixtures include neg cases → expect non-zero
      assert.notEqual(
        result.status,
        0,
        `expected exit ≠0 with neg fixtures:\nstdout=${result.stdout}\nstderr=${result.stderr}`,
      );

      const jsonPath = path.join(outDir, "report.json");
      const mdPath = path.join(outDir, "report.md");
      const json = JSON.parse(readFileSync(jsonPath, "utf8")) as {
        rows: unknown[];
        note?: string;
      };
      const md = readFileSync(mdPath, "utf8");
      assert.ok(Array.isArray(json.rows) && json.rows.length === 3);
      assert.match(md, /dump ≠ boot/);
      assert.match(md, /\| 插件 \| install \| hang \| load \| stage \| ms \|/);
      assert.match(md, /fixtures\/hello-plugin/);
    } finally {
      try {
        rmSync(outDir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    }
  });
});
