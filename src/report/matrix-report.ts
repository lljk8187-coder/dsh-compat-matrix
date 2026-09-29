/** MatrixReport schema + JSON/MD writers (M4). */

export type MatrixRow = {
  plugin: string;
  path: string;
  packageName?: string;
  install_ok: boolean;
  config_hang_ok: boolean;
  load_ok: boolean;
  error_stage?: string;
  duration_ms: number;
  error?: string;
};

export type MatrixReport = {
  generated_at: string;
  dshVersion?: string;
  note?: string;
  rows: MatrixRow[];
};

/** Default note: dump/lite schema ≠ full boot. */
export const MATRIX_DUMP_NOTE =
  "dump ≠ boot — lite load via --dump-config-schema, not full boot";

export type ProbeLikeForRow = {
  pluginPath: string;
  packageName?: string;
  install_ok: boolean;
  config_hang_ok: boolean;
  load_ok: boolean;
  error_stage?: string;
  duration_ms: number;
  error?: string;
};

/** Map a probe result (or fake) into a MatrixRow. */
export function probeResultToRow(
  pluginLabel: string,
  result: ProbeLikeForRow,
): MatrixRow {
  const row: MatrixRow = {
    plugin: pluginLabel,
    path: result.pluginPath,
    install_ok: result.install_ok,
    config_hang_ok: result.config_hang_ok,
    load_ok: result.load_ok,
    duration_ms: result.duration_ms,
  };
  if (result.packageName !== undefined) row.packageName = result.packageName;
  if (result.error_stage !== undefined) row.error_stage = result.error_stage;
  if (result.error !== undefined) row.error = result.error;
  return row;
}

export function buildMatrixReport(input: {
  generated_at?: string;
  dshVersion?: string;
  note?: string;
  rows: MatrixRow[];
}): MatrixReport {
  const report: MatrixReport = {
    generated_at: input.generated_at ?? new Date().toISOString(),
    rows: input.rows,
  };
  if (input.dshVersion !== undefined) report.dshVersion = input.dshVersion;
  if (input.note !== undefined) report.note = input.note;
  else report.note = MATRIX_DUMP_NOTE;
  return report;
}

export function formatMatrixReportJson(report: MatrixReport): string {
  return JSON.stringify(report, null, 2) + "\n";
}

function cell(v: boolean | string | number): string {
  return String(v);
}

/** Markdown table: 插件 | install | hang | load | stage | ms */
export function formatMatrixReportMd(report: MatrixReport): string {
  const lines: string[] = [];
  lines.push("# dsh-compat-matrix report");
  lines.push("");
  lines.push(
    "> **dump ≠ boot** (lite load = `--dump-config-schema`, not full boot)",
  );
  if (report.note && report.note !== MATRIX_DUMP_NOTE) {
    lines.push(`> ${report.note}`);
  }
  lines.push("");
  lines.push(`- generated_at: \`${report.generated_at}\``);
  if (report.dshVersion) {
    lines.push(`- dshVersion: \`${report.dshVersion}\``);
  }
  const total = report.rows.length;
  const allOk = report.rows.filter(
    (r) => r.install_ok && r.config_hang_ok && r.load_ok,
  ).length;
  const installOk = report.rows.filter((r) => r.install_ok).length;
  const hangOk = report.rows.filter((r) => r.config_hang_ok).length;
  const loadOk = report.rows.filter((r) => r.load_ok).length;
  lines.push(
    `- summary: all-ok ${allOk}/${total}; install ${installOk}/${total}; hang ${hangOk}/${total}; load ${loadOk}/${total}`,
  );
  lines.push("");
  lines.push("| 插件 | install | hang | load | stage | ms |");
  lines.push("|------|---------|------|------|-------|----|");
  for (const r of report.rows) {
    const stage = r.error_stage ?? "";
    lines.push(
      `| ${r.plugin} | ${cell(r.install_ok)} | ${cell(r.config_hang_ok)} | ${cell(r.load_ok)} | ${stage} | ${cell(r.duration_ms)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function matrixAllOk(report: MatrixReport): boolean {
  return (
    report.rows.length > 0 &&
    report.rows.every((r) => r.install_ok && r.config_hang_ok && r.load_ok)
  );
}
