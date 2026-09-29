#!/usr/bin/env node
/**
 * dsh-compat-matrix CLI entry (M1 scaffold).
 * Real probe/run against dsh arrives in M2+.
 */

const HELP = `dsh-compat-matrix — plugin compatibility matrix for a specified dsh version

Usage:
  npx tsx src/cli.ts <command> [options]
  npm run help

Commands:
  probe   Probe plugin compatibility (NOT IMPLEMENTED — M2+)
  run     Run install → dump hang-layer → light load matrix (NOT IMPLEMENTED — M2+)
  help    Show this help

Options:
  -h, --help     Show this help
  -V, --version  Show version

Notes:
  - dump ≠ real boot. Hang-layer dump is not a full dsh boot.
  - This M1 scaffold does not call real dsh.
`;

function printHelp(): void {
  process.stdout.write(HELP);
}

function printVersion(): void {
  process.stdout.write("dsh-compat-matrix 0.1.0 (M1 scaffold)\n");
}

function stubCommand(name: string): void {
  process.stderr.write(
    `Command "${name}" is not implemented yet (planned for M2+).\n` +
      `Run with --help for available commands.\n`,
  );
  process.exitCode = 1;
}

function main(argv: string[]): void {
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

  if (cmd === "probe" || cmd === "run") {
    stubCommand(cmd);
    return;
  }

  process.stderr.write(`Unknown command: ${cmd}\n\n`);
  printHelp();
  process.exitCode = 1;
}

main(process.argv);
