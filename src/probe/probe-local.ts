import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createTempDshHome,
  getDshVersion,
  resolveDshBinary,
  runDsh,
} from "../runner/index.js";

export type ErrorStage = "install" | "config_hang" | "load" | "preflight";

export type ProbeLocalResult = {
  pluginPath: string;
  dshHome: string;
  profile: string;
  install_ok: boolean;
  config_hang_ok: boolean;
  /** Lite load via `--dump-config-schema` after successful install. Not a full boot. */
  load_ok: boolean;
  duration_ms: number;
  error_stage?: ErrorStage;
  dshVersion?: string;
  packageName?: string;
  error?: string;
  install_stderr?: string;
  dump_stderr?: string;
  schema_stderr?: string;
  dump_snippet?: string;
};

const INSTALL_TIMEOUT_MS = 180_000;
const DUMP_TIMEOUT_MS = 60_000;
const SCHEMA_TIMEOUT_MS = 60_000;
const DEFAULT_PROFILE = "compat-probe";

function snippet(text: string, max = 800): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + "…";
}

async function readPackageName(pluginPath: string): Promise<string | undefined> {
  try {
    const raw = await readFile(path.join(pluginPath, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { name?: string };
    return typeof pkg.name === "string" ? pkg.name : undefined;
  } catch {
    return undefined;
  }
}

/** Hang-layer marker: `# == <packageName>` (packageName only; no hello hardcode). */
function hangLayerSeen(dumpStdout: string, packageName?: string): boolean {
  if (!packageName) return false;
  const marker = `# == ${packageName}`;
  for (const line of dumpStdout.split(/\r?\n/)) {
    if (line.includes(marker)) return true;
  }
  return false;
}

function deriveErrorStage(
  install_ok: boolean,
  config_hang_ok: boolean,
  load_ok: boolean,
): ErrorStage | undefined {
  if (install_ok && config_hang_ok && load_ok) return undefined;
  if (!install_ok) return "install";
  if (!config_hang_ok) return "config_hang";
  if (!load_ok) return "load";
  return undefined;
}

/**
 * Probe a local plugin path: temp DSH_HOME → `dsh plugin add` → `--dump-config`
 * hang-layer check → lite `--dump-config-schema` load.
 * Does not start web / full boot. dump-config-schema ≠ 全量 boot.
 */
export async function probeLocalPlugin(
  pluginPathInput: string,
  options: { profile?: string } = {},
): Promise<ProbeLocalResult> {
  const started = Date.now();
  const pluginPath = path.resolve(pluginPathInput);
  const profile = options.profile ?? DEFAULT_PROFILE;

  const withDuration = (
    partial: Omit<ProbeLocalResult, "duration_ms">,
  ): ProbeLocalResult => ({
    ...partial,
    duration_ms: Date.now() - started,
  });

  // Fail fast if dsh missing (caller may catch → preflight)
  resolveDshBinary();

  try {
    await access(path.join(pluginPath, "package.json"));
  } catch {
    return withDuration({
      pluginPath,
      dshHome: "",
      profile,
      install_ok: false,
      config_hang_ok: false,
      load_ok: false,
      error_stage: "preflight",
      error: `plugin path missing package.json: ${pluginPath}`,
    });
  }

  const packageName = await readPackageName(pluginPath);
  const dshVersion = await getDshVersion();
  const temp = await createTempDshHome("dsh-compat-");
  const childEnv = { ...process.env, DSH_HOME: temp.dshHome };

  let install_ok = false;
  let config_hang_ok = false;
  let load_ok = false;
  let error: string | undefined;
  let install_stderr: string | undefined;
  let dump_stderr: string | undefined;
  let schema_stderr: string | undefined;
  let dump_snippet: string | undefined;

  try {
    const install = await runDsh(
      ["plugin", "--profile", profile, "add", pluginPath],
      { env: childEnv, timeoutMs: INSTALL_TIMEOUT_MS },
    );

    if (install.timedOut) {
      error = `dsh plugin add timed out after ${INSTALL_TIMEOUT_MS}ms`;
      install_stderr = snippet(install.stderr || install.stdout);
    } else if (install.code !== 0) {
      error = `dsh plugin add exited ${install.code}`;
      install_stderr = snippet(install.stderr || install.stdout);
    } else {
      install_ok = true;
      // Keep install warnings (e.g. "declares no dsh.bundle") if present
      if (install.stderr?.trim()) {
        install_stderr = snippet(install.stderr);
      }
    }

    if (install_ok) {
      const dump = await runDsh(["--profile", profile, "--dump-config"], {
        env: childEnv,
        timeoutMs: DUMP_TIMEOUT_MS,
      });

      if (dump.timedOut) {
        error =
          error ??
          `dsh --dump-config timed out after ${DUMP_TIMEOUT_MS}ms`;
        dump_stderr = snippet(dump.stderr);
      } else if (dump.code !== 0) {
        error = error ?? `dsh --dump-config exited ${dump.code}`;
        dump_stderr = snippet(dump.stderr || dump.stdout);
      } else {
        config_hang_ok = hangLayerSeen(dump.stdout, packageName);
        dump_snippet = snippet(
          dump.stdout
            .split(/\r?\n/)
            .filter(
              (l) =>
                /#\s*==/.test(l) ||
                (packageName ? l.includes(packageName) : false),
            )
            .join("\n") || dump.stdout.slice(0, 400),
        );
        if (dump.stderr?.trim()) {
          dump_stderr = snippet(dump.stderr);
        }
        if (!config_hang_ok) {
          error =
            error ??
            `hang-layer marker not found in dump-config (expected "# == ${packageName ?? "<packageName>"}")`;
        }
      }

      // Lite load: --dump-config-schema (only after successful install)
      const schema = await runDsh(
        ["--profile", profile, "--dump-config-schema"],
        { env: childEnv, timeoutMs: SCHEMA_TIMEOUT_MS },
      );

      if (schema.timedOut) {
        load_ok = false;
        schema_stderr = snippet(schema.stderr || schema.stdout);
        if (config_hang_ok) {
          error =
            error ??
            `dsh --dump-config-schema timed out after ${SCHEMA_TIMEOUT_MS}ms`;
        }
      } else if (schema.code !== 0) {
        load_ok = false;
        schema_stderr = snippet(schema.stderr || schema.stdout);
        if (config_hang_ok) {
          error =
            error ?? `dsh --dump-config-schema exited ${schema.code}`;
        }
      } else {
        load_ok = true;
        if (schema.stderr?.trim()) {
          schema_stderr = snippet(schema.stderr);
        }
      }
    }
    // else: install failed → load_ok stays false; skip schema
  } finally {
    await temp.cleanup();
  }

  const error_stage = deriveErrorStage(install_ok, config_hang_ok, load_ok);

  return withDuration({
    pluginPath,
    dshHome: temp.dshHome,
    profile,
    install_ok,
    config_hang_ok,
    load_ok,
    error_stage,
    dshVersion,
    packageName,
    error,
    install_stderr,
    dump_stderr,
    schema_stderr,
    dump_snippet,
  });
}
