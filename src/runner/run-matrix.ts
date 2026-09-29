/**
 * Matrix run orchestrator (M4): serial probe of default fixtures → report.json + report.md.
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

export const DEFAULT_MATRIX_FIXTURES = [
  "fixtures/hello-plugin",
  "fixtures/no-bundle-plugin",
  "fixtures/bad-patch-plugin",
] as const;

export type RunMatrixOptions = {
  /** Output directory (relative to cwd or absolute). Default `./out`. */
  outDir?: string;
  /** Fixture paths relative to cwd. Default DEFAULT_MATRIX_FIXTURES. */
  fixtures?: readonly string[];
  cwd?: string;
};

export type RunMatrixResult = {
  report: MatrixReport;
  outDir: string;
  jsonPath: string;
  mdPath: string;
  allOk: boolean;
};

/** Parse `--out-dir <path>` or `--out-dir=<path>`; default `./out`. */
export function parseOutDirArg(args: string[]): string {
  let outDir = "./out";
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
    }
  }
  return outDir;
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
 * Probe each fixture serially, always write report.json + report.md under out-dir.
 * Prefer writing a preflight-error report when dsh is missing (exit handled by CLI).
 */
export async function runMatrix(
  options: RunMatrixOptions = {},
): Promise<RunMatrixResult> {
  const cwd = options.cwd ?? process.cwd();
  const outDirAbs = path.resolve(cwd, options.outDir ?? "./out");
  const fixtures = options.fixtures ?? DEFAULT_MATRIX_FIXTURES;

  let preflightError: string | undefined;
  try {
    resolveDshBinary();
  } catch (err) {
    preflightError = err instanceof Error ? err.message : String(err);
  }

  if (preflightError) {
    const rows: MatrixRow[] = fixtures.map((rel) => ({
      plugin: rel,
      path: path.resolve(cwd, rel),
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

  for (const rel of fixtures) {
    const abs = path.resolve(cwd, rel);
    try {
      const result = await probeLocalPlugin(abs);
      if (!dshVersion && result.dshVersion) {
        dshVersion = result.dshVersion;
      }
      rows.push(probeResultToRow(rel, result));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rows.push({
        plugin: rel,
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
