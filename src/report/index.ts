/** Report helpers — minimal JSON formatting (M2). Matrix files arrive in M4+. */

export function formatProbeJson(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

export function formatProbeSummary(result: {
  install_ok: boolean;
  config_hang_ok: boolean;
  packageName?: string;
  dshVersion?: string;
  error?: string;
}): string {
  const name = result.packageName ?? "plugin";
  const ver = result.dshVersion ? ` dsh=${result.dshVersion}` : "";
  if (result.install_ok && result.config_hang_ok) {
    return `OK: ${name} install+config_hang${ver}`;
  }
  return `FAIL: ${name} install_ok=${result.install_ok} config_hang_ok=${result.config_hang_ok}${ver}${result.error ? ` — ${result.error}` : ""}`;
}
