/**
 * Matrix run orchestrator (M4/M5): serial probe of fixtures or targets plugins → report.json + report.md.
 * Uses temp DSH_HOME only (via probeLocalPlugin); never ~/.dsh; no web / real-net.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { probeLocalPlugin } from "../probe/index.js";
import {
  MATRIX_DUMP_NOTE,
  buildMatrixReport,
  formatMatrixReportJson,
  formatMatrixReportMd,
  matrixAllOk,
  probeResultToRow,
  type MatrixReport,
  type MatrixRow,
} from "../report/matrix-report.js";
import { getDshVersion, resolveDshBinary } from "./dsh.js";
import type { TargetPlugin } from "./targets.js";

export const DEFAULT_MATRIX_FIXTURES = [
  "fixtures/hello-plugin",
  "fixtures/no-bundle-plugin",
  "fixtures/bad-patch-plugin",
] as const;

export type RunMatrixOptions = {
  /** Output directory (relative to cwd or absolute). Default `./out`. */
  outDir?: string;
  /** Fixture paths relative to cwd. Default DEFAULT_MATRIX_FIXTURES when plugins unset. */
  fixtures?: readonly string[];
  /**
   * Targets plugins (M5). When set, preferred over fixtures.
   * MatrixRow.plugin uses id when present, else path.
   */
  plugins?: readonly TargetPlugin[];
  cwd?: string;
};

export type RunMatrixResult = {
  report: MatrixReport;
  outDir: string;
  jsonPath: string;
  mdPath: string;
  allOk: boolean;
};

export type ParseRunArgsResult = {
  outDir: string;
  targetsPath?: string;
};

/** Parse `--out-dir <path>` or `--out-dir=<path>`; default `./out`. */
export function parseOutDirArg(args: string[]): string {
  return parseRunArgs(args).outDir;
}

/**
 * Parse `run` flags: `--out-dir` / `--out-dir=` and `--targets` / `--targets=`.
 * Returns `{ outDir, targetsPath? }`.
 */
export function parseRunArgs(args: string[]): ParseRunArgsResult {
  let outDir = "./out";
  let targetsPath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--out-dir=")) {
      const v = a.slice("--out-dir=".length);
      outDir = v.length > 0 ? v : "./out";
    } else if (a === "--out-dir") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        outDir = next;
        i++;
      }
    } else if (a.startsWith("--targets=")) {
      const v = a.slice("--targets=".length);
      if (v.length > 0) targetsPath = v;
    } else if (a === "--targets") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        targetsPath = next;
        i++;
      }
    }
  }
  return targetsPath !== undefined ? { outDir, targetsPath } : { outDir };
}

type ProbeEntry = {
  /** MatrixRow.plugin label */
  label: string;
  /** Absolute or cwd-relative path for probing */
  path: string;
};

function resolveEntries(
  options: RunMatrixOptions,
): ProbeEntry[] {
  if (options.plugins && options.plugins.length > 0) {
    return options.plugins.map((p) => ({
      label: p.id && p.id.trim() !== "" ? p.id.trim() : p.path,
      path: p.path,
    }));
  }
  const fixtures = options.fixtures ?? DEFAULT_MATRIX_FIXTURES;
  return fixtures.map((rel) => ({
    label: rel,
    path: rel,
  }));
}

export async function writeMatrixReportFiles(
  outDirAbs: string,
  report: MatrixReport,
): Promise<{ jsonPath: string; mdPath: string }> {
  await mkdir(outDirAbs, { recursive: true });
  const jsonPath = path.join(outDirAbs, "report.json");
  const mdPath = path.join(outDirAbs, "report.md");
  await writeFile(jsonPath, formatMatrixReportJson(report), "utf8");
  await writeFile(mdPath, formatMatrixReportMd(report), "utf8");
  return { jsonPath, mdPath };
}

/**
 * Probe each entry serially, always write report.json + report.md under out-dir.
 * Prefer writing a preflight-error report when dsh is missing (exit handled by CLI).
 * Accepts either fixtures[] (M4 default) or targets plugins (M5).
 */
export async function runMatrix(
  options: RunMatrixOptions = {},
): Promise<RunMatrixResult> {
  const cwd = options.cwd ?? process.cwd();
  const outDirAbs = path.resolve(cwd, options.outDir ?? "./out");
  const entries = resolveEntries(options);

  let preflightError: string | undefined;
  try {
    resolveDshBinary();
  } catch (err) {
    preflightError = err instanceof Error ? err.message : String(err);
  }

  if (preflightError) {
    const rows: MatrixRow[] = entries.map((e) => ({
      plugin: e.label,
      path: path.resolve(cwd, e.path),
      install_ok: false,
      config_hang_ok: false,
      load_ok: false,
      error_stage: "preflight",
      duration_ms: 0,
      error: preflightError,
    }));
    const report = buildMatrixReport({
      note: `${MATRIX_DUMP_NOTE}; preflight: dsh missing`,
      rows,
    });
    const paths = await writeMatrixReportFiles(outDirAbs, report);
    return {
      report,
      outDir: outDirAbs,
      ...paths,
      allOk: false,
    };
  }

  const rows: MatrixRow[] = [];
  let dshVersion: string | undefined;

  for (const entry of entries) {
    const abs = path.resolve(cwd, entry.path);
    try {
      const result = await probeLocalPlugin(abs);
      if (!dshVersion && result.dshVersion) {
        dshVersion = result.dshVersion;
      }
      rows.push(probeResultToRow(entry.label, result));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rows.push({
        plugin: entry.label,
        path: abs,
        install_ok: false,
        config_hang_ok: false,
        load_ok: false,
        error_stage: "preflight",
        duration_ms: 0,
        error: message,
      });
    }
  }

  if (!dshVersion) {
    dshVersion = await getDshVersion();
  }

  const report = buildMatrixReport({
    dshVersion,
    note: MATRIX_DUMP_NOTE,
    rows,
  });
  const paths = await writeMatrixReportFiles(outDirAbs, report);
  return {
    report,
    outDir: outDirAbs,
    ...paths,
    allOk: matrixAllOk(report),
  };
}
