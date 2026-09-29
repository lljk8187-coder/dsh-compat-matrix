#!/usr/bin/env node
/**
 * dsh-compat-matrix CLI entry (M5: targets serial batch + MatrixReport).
 */

import { probeLocalPlugin } from "./probe/index.js";
import { formatProbeJson, formatProbeSummary } from "./report/index.js";
import {
  loadTargets,
  parseRunArgs,
  runMatrix,
} from "./runner/index.js";

const HELP = `dsh-compat-matrix — plugin compatibility matrix for a specified dsh version

Usage:
  npx tsx src/cli.ts <command> [options]
  npm run help

Commands:
  probe <path>              Probe a local plugin: install → hang-layer → lite schema load
  run [--targets <file>] [--out-dir ./out]
                            Probe fixtures (default) or targets file serially; write report.json + report.md (M5)
  help                      Show this help

Options:
  -h, --help                Show this help
  -V, --version             Show version
  --out-dir <dir>           Output directory for \`run\` (default: ./out); also --out-dir=<dir>
  --targets <file>          Targets JSON for \`run\` (local path plugins); also --targets=<file>

Examples:
  npx tsx src/cli.ts probe fixtures/hello-plugin
  npx tsx src/cli.ts probe fixtures/no-bundle-plugin
  npx tsx src/cli.ts probe fixtures/bad-patch-plugin
  npx tsx src/cli.ts run --out-dir ./out
  npx tsx src/cli.ts run --out-dir=./out
  npx tsx src/cli.ts run --targets targets.example.json --out-dir ./out-m5
  npx tsx src/cli.ts run --targets=targets.example.json --out-dir=./out-m5

Default fixtures for \`run\` without --targets (fixed order):
  1. fixtures/hello-plugin
  2. fixtures/no-bundle-plugin
  3. fixtures/bad-patch-plugin

Targets file (see targets.example.json):
  { "dshVersion": "optional doc-only", "plugins": [ { "id": "hello", "path": "fixtures/hello-plugin" } ] }
  - path required (relative to cwd or absolute)
  - id optional but preferred as MatrixRow.plugin label
  - dshVersion is documentation only — does NOT switch dsh binaries

Requirements (probe / run):
  - Node ≥22.19 for dsh
  - dsh on PATH: npm install -g @deepseek-ai/dsh
  - pnpm on PATH: npm install -g pnpm
  - export PATH so node22 + dsh bins are found

Notes:
  - dump ≠ real boot. Hang-layer dump and --dump-config-schema are not a full dsh boot.
  - load_ok is lite schema only (schema ≠ 全量 boot).
  - Overall success (exit 0) only when install_ok && config_hang_ok && load_ok (all rows for run).
  - With the three default fixtures / targets.example, \`run\` is expected to exit ≠0 (neg cases) — that is OK.
  - probe/run use a temporary DSH_HOME only; never writes to ~/.dsh.
  - Sample report paths: out/report.json, out/report.md
  - M5: targets serial batch. No M6 CI, no real-net npm plugins in defaults/examples.
`;

function printHelp(): void {
  process.stdout.write(HELP);
}

function printVersion(): void {
  process.stdout.write("dsh-compat-matrix 0.5.0 (M5 targets serial batch)\n");
}

async function runProbe(pluginPath: string | undefined): Promise<void> {
  if (!pluginPath) {
    process.stderr.write(
      "Usage: npx tsx src/cli.ts probe <plugin-path>\n" +
        "Example: npx tsx src/cli.ts probe fixtures/hello-plugin\n",
    );
    process.exitCode = 1;
    return;
  }

  try {
    const result = await probeLocalPlugin(pluginPath);
    process.stdout.write(formatProbeJson(result) + "\n");
    process.stderr.write(formatProbeSummary(result) + "\n");
    process.exitCode =
      result.install_ok && result.config_hang_ok && result.load_ok ? 0 : 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failure = {
      pluginPath,
      dshHome: "",
      profile: "compat-probe",
      install_ok: false,
      config_hang_ok: false,
      load_ok: false,
      duration_ms: 0,
      error_stage: "preflight" as const,
      error: message,
    };
    process.stdout.write(formatProbeJson(failure) + "\n");
    process.stderr.write(formatProbeSummary(failure) + "\n");
    process.exitCode = 1;
  }
}

async function runMatrixCmd(args: string[]): Promise<void> {
  const { outDir, targetsPath } = parseRunArgs(args);
  try {
    let plugins;
    if (targetsPath) {
      const targets = await loadTargets(targetsPath);
      plugins = targets.plugins;
    }
    const result = await runMatrix(
      plugins ? { outDir, plugins } : { outDir },
    );
    process.stdout.write(
      JSON.stringify(
        {
          outDir: result.outDir,
          jsonPath: result.jsonPath,
          mdPath: result.mdPath,
          allOk: result.allOk,
          rows: result.report.rows.length,
          dshVersion: result.report.dshVersion,
          generated_at: result.report.generated_at,
          targets: targetsPath ?? null,
        },
        null,
        2,
      ) + "\n",
    );
    process.stderr.write(
      `Wrote ${result.jsonPath} and ${result.mdPath}` +
        ` (allOk=${result.allOk}, rows=${result.report.rows.length})\n`,
    );
    process.exitCode = result.allOk ? 0 : 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`run failed: ${message}\n`);
    process.exitCode = 1;
  }
}

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  const cmd = args[0];

  if (
    args.length === 0 ||
    cmd === "help" ||
    cmd === "--help" ||
    cmd === "-h"
  ) {
    printHelp();
    return;
  }

  if (cmd === "--version" || cmd === "-V") {
    printVersion();
    return;
  }

  if (cmd === "probe") {
    await runProbe(args[1]);
    return;
  }

  if (cmd === "run") {
    await runMatrixCmd(args.slice(1));
    return;
  }

  process.stderr.write(`Unknown command: ${cmd}\n\n`);
  printHelp();
  process.exitCode = 1;
}

main(process.argv).catch((err) => {
  process.stderr.write(String(err) + "\n");
  process.exitCode = 1;
});
