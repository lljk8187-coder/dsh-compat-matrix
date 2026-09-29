import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accessSync,
  constants,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { loadTargets, parseRunArgs } from "../src/runner/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "src", "cli.ts");
const exampleTargets = path.join(root, "targets.example.json");

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

describe("loadTargets", () => {
  it("parses targets.example.json → 3 plugins with expected paths", async () => {
    const targets = await loadTargets(exampleTargets);
    assert.equal(targets.dshVersion, "0.1.7-rc.2");
    assert.equal(targets.plugins.length, 3);
    assert.deepEqual(targets.plugins[0], {
      id: "hello",
      path: "fixtures/hello-plugin",
    });
    assert.deepEqual(targets.plugins[1], {
      id: "no-bundle",
      path: "fixtures/no-bundle-plugin",
    });
    assert.deepEqual(targets.plugins[2], {
      id: "bad-patch",
      path: "fixtures/bad-patch-plugin",
    });
  });

  it("rejects bad JSON", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dsh-compat-targets-"));
    try {
      const bad = path.join(dir, "bad.json");
      writeFileSync(bad, "{ not json", "utf8");
      await assert.rejects(
        () => loadTargets(bad),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.match(err.message, /Invalid JSON/i);
          return true;
        },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects empty plugins[]", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dsh-compat-targets-"));
    try {
      const empty = path.join(dir, "empty.json");
      writeFileSync(empty, JSON.stringify({ plugins: [] }), "utf8");
      await assert.rejects(
        () => loadTargets(empty),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.match(err.message, /empty/i);
          return true;
        },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects missing path", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dsh-compat-targets-"));
    try {
      const missing = path.join(dir, "missing-path.json");
      writeFileSync(
        missing,
        JSON.stringify({ plugins: [{ id: "x" }] }),
        "utf8",
      );
      await assert.rejects(
        () => loadTargets(missing),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.match(err.message, /path/i);
          return true;
        },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("parseRunArgs", () => {
  it("defaults outDir to ./out without targets", () => {
    assert.deepEqual(parseRunArgs([]), { outDir: "./out" });
  });
  it("parses --targets and --out-dir space forms", () => {
    assert.deepEqual(
      parseRunArgs(["--targets", "targets.example.json", "--out-dir", "./o"]),
      { outDir: "./o", targetsPath: "targets.example.json" },
    );
  });
  it("parses --targets= and --out-dir= forms", () => {
    assert.deepEqual(
      parseRunArgs(["--targets=t.json", "--out-dir=./eq"]),
      { outDir: "./eq", targetsPath: "t.json" },
    );
  });
});

describe("cli run --targets smoke", () => {
  it("writes 3 rows + report files when dsh installed, else skip", async (t) => {
    if (!dshAvailable()) {
      t.skip(
        "dsh not installed — install with: npm install -g @deepseek-ai/dsh (Node ≥22.19) and pnpm; CI may skip this test",
      );
      return;
    }

    const outDir = mkdtempSync(path.join(tmpdir(), "dsh-compat-targets-run-"));
    try {
      const result = await new Promise<{
        status: number | null;
        stdout: string;
        stderr: string;
      }>((resolve) => {
        const child = spawn(
          "npx",
          [
            "tsx",
            cli,
            "run",
            "--targets",
            "targets.example.json",
            "--out-dir",
            outDir,
          ],
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

      assert.notEqual(
        result.status,
        0,
        `expected exit ≠0 with neg fixtures:\nstdout=${result.stdout}\nstderr=${result.stderr}`,
      );

      const jsonPath = path.join(outDir, "report.json");
      const mdPath = path.join(outDir, "report.md");
      const json = JSON.parse(readFileSync(jsonPath, "utf8")) as {
        rows: { plugin: string }[];
        note?: string;
      };
      const md = readFileSync(mdPath, "utf8");
      assert.ok(Array.isArray(json.rows) && json.rows.length === 3);
      assert.equal(json.rows[0]!.plugin, "hello");
      assert.equal(json.rows[1]!.plugin, "no-bundle");
      assert.equal(json.rows[2]!.plugin, "bad-patch");
      assert.match(md, /dump ≠ boot/);
      assert.match(md, /\| hello \|/);
    } finally {
      try {
        rmSync(outDir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    }
  });
});
