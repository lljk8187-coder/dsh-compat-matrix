#!/usr/bin/env node
/**
 * dsh-compat-matrix CLI entry (M2: local probe with temp DSH_HOME).
 */

import { probeLocalPlugin } from "./probe/index.js";
import { formatProbeJson, formatProbeSummary } from "./report/index.js";

const HELP = `dsh-compat-matrix — plugin compatibility matrix for a specified dsh version

Usage:
  npx tsx src/cli.ts <command> [options]
  npm run help

Commands:
  probe <path>   Probe a local plugin: install → --dump-config hang-layer (M2)
  run            Run full matrix (NOT YET — M3+)
  help           Show this help

Options:
  -h, --help     Show this help
  -V, --version  Show version

Examples:
  npx tsx src/cli.ts probe fixtures/hello-plugin
  npx tsx src/cli.ts probe /abs/path/to/plugin

Requirements (probe):
  - Node ≥22.19 for dsh
  - dsh on PATH: npm install -g @deepseek-ai/dsh
  - pnpm on PATH: npm install -g pnpm
  - export PATH so node22 + dsh bins are found

Notes:
  - dump ≠ real boot. Hang-layer dump is not a full dsh boot.
  - probe uses a temporary DSH_HOME only; never writes to ~/.dsh.
  - load_ok is stubbed in M2 (skipped; dump≠boot).
`;

function printHelp(): void {
  process.stdout.write(HELP);
}

function printVersion(): void {
  process.stdout.write("dsh-compat-matrix 0.2.0 (M2 probe)\n");
}

async function runProbe(pluginPath: string | undefined): Promise<void> {
  if (!pluginPath) {
    process.stderr.write(
      'Usage: npx tsx src/cli.ts probe <plugin-path>\n' +
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
      result.install_ok && result.config_hang_ok ? 0 : 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failure = {
      pluginPath,
      dshHome: "",
      profile: "compat-probe",
      install_ok: false,
      config_hang_ok: false,
      load_ok: {
        status: "skipped",
        reason: "M2 lite; dump≠boot",
      },
      error: message,
    };
    process.stdout.write(formatProbeJson(failure) + "\n");
    process.stderr.write(formatProbeSummary(failure) + "\n");
    process.exitCode = 1;
  }
}

function stubRun(): void {
  process.stderr.write(
    'Command "run" is not implemented yet (planned for M3+ matrix).\n' +
      "Use `probe <path>` for a single local plugin in M2.\n",
  );
  process.exitCode = 1;
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
    stubRun();
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
