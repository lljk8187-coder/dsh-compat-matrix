/** Report helpers — probe JSON/summary (M3) + MatrixReport writers (M4). */

export function formatProbeJson(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

export function formatProbeSummary(result: {
  install_ok: boolean;
  config_hang_ok: boolean;
  load_ok: boolean;
  error_stage?: string;
  packageName?: string;
  dshVersion?: string;
  duration_ms?: number;
  error?: string;
}): string {
  const name = result.packageName ?? "plugin";
  const ver = result.dshVersion ? ` dsh=${result.dshVersion}` : "";
  const dur =
    typeof result.duration_ms === "number"
      ? ` ${result.duration_ms}ms`
      : "";
  if (result.install_ok && result.config_hang_ok && result.load_ok) {
    return `OK: ${name} install+config_hang+load${ver}${dur}`;
  }
  const stage = result.error_stage ? ` stage=${result.error_stage}` : "";
  return (
    `FAIL: ${name} install_ok=${result.install_ok}` +
    ` config_hang_ok=${result.config_hang_ok}` +
    ` load_ok=${result.load_ok}${stage}${ver}${dur}` +
    `${result.error ? ` — ${result.error}` : ""}`
  );
}

export {
  MATRIX_DUMP_NOTE,
  buildMatrixReport,
  formatMatrixReportJson,
  formatMatrixReportMd,
  matrixAllOk,
  probeResultToRow,
  type MatrixReport,
  type MatrixRow,
  type ProbeLikeForRow,
} from "./matrix-report.js";
