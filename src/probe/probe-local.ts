import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createTempDshHome,
  getDshVersion,
  resolveDshBinary,
  runDsh,
} from "../runner/index.js";

export type LoadOkStub = {
  status: "skipped";
  reason: string;
};

export type ProbeLocalResult = {
  pluginPath: string;
  dshHome: string;
  profile: string;
  install_ok: boolean;
  config_hang_ok: boolean;
  load_ok: LoadOkStub | null;
  dshVersion?: string;
  packageName?: string;
  error?: string;
  install_stderr?: string;
  dump_stderr?: string;
  dump_snippet?: string;
};

const INSTALL_TIMEOUT_MS = 180_000;
const DUMP_TIMEOUT_MS = 60_000;
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

function hangLayerSeen(dumpStdout: string, packageName?: string): boolean {
  const lines = dumpStdout.split(/\r?\n/);
  for (const line of lines) {
    if (packageName && line.includes(`# == ${packageName}`)) return true;
    if (/#\s*==\s*dsh-hello-plugin\b/.test(line)) return true;
    if (packageName && line.includes(packageName) && /#\s*==/.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * Probe a local plugin path: temp DSH_HOME → `dsh plugin add` → `--dump-config`
 * hang-layer check. Does not start web / full boot.
 */
export async function probeLocalPlugin(
  pluginPathInput: string,
  options: { profile?: string } = {},
): Promise<ProbeLocalResult> {
  const pluginPath = path.resolve(pluginPathInput);
  const profile = options.profile ?? DEFAULT_PROFILE;

  // Fail fast if dsh missing
  resolveDshBinary();

  try {
    await access(path.join(pluginPath, "package.json"));
  } catch {
    return {
      pluginPath,
      dshHome: "",
      profile,
      install_ok: false,
      config_hang_ok: false,
      load_ok: {
        status: "skipped",
        reason: "M2 lite; dump≠boot",
      },
      error: `plugin path missing package.json: ${pluginPath}`,
    };
  }

  const packageName = await readPackageName(pluginPath);
  const dshVersion = await getDshVersion();
  const temp = await createTempDshHome("dsh-compat-");
  const childEnv = { ...process.env, DSH_HOME: temp.dshHome };

  const base: ProbeLocalResult = {
    pluginPath,
    dshHome: temp.dshHome,
    profile,
    install_ok: false,
    config_hang_ok: false,
    load_ok: {
      status: "skipped",
      reason: "M2 lite; dump≠boot",
    },
    dshVersion,
    packageName,
  };

  try {
    const install = await runDsh(
      ["plugin", "--profile", profile, "add", pluginPath],
      { env: childEnv, timeoutMs: INSTALL_TIMEOUT_MS },
    );

    if (install.timedOut) {
      return {
        ...base,
        error: `dsh plugin add timed out after ${INSTALL_TIMEOUT_MS}ms`,
        install_stderr: snippet(install.stderr || install.stdout),
      };
    }

    if (install.code !== 0) {
      return {
        ...base,
        error: `dsh plugin add exited ${install.code}`,
        install_stderr: snippet(install.stderr || install.stdout),
      };
    }

    base.install_ok = true;

    const dump = await runDsh(["--profile", profile, "--dump-config"], {
      env: childEnv,
      timeoutMs: DUMP_TIMEOUT_MS,
    });

    if (dump.timedOut) {
      return {
        ...base,
        error: `dsh --dump-config timed out after ${DUMP_TIMEOUT_MS}ms`,
        dump_stderr: snippet(dump.stderr),
      };
    }

    if (dump.code !== 0) {
      return {
        ...base,
        error: `dsh --dump-config exited ${dump.code}`,
        dump_stderr: snippet(dump.stderr || dump.stdout),
      };
    }

    const config_hang_ok = hangLayerSeen(dump.stdout, packageName);
    return {
      ...base,
      config_hang_ok,
      dump_snippet: snippet(
        dump.stdout
          .split(/\r?\n/)
          .filter((l) => /#\s*==/.test(l) || (packageName ? l.includes(packageName) : false))
          .join("\n") || dump.stdout.slice(0, 400),
      ),
      error: config_hang_ok
        ? undefined
        : `hang-layer marker not found in dump-config (expected "# == ${packageName ?? "dsh-hello-plugin"}")`,
      dump_stderr: dump.stderr ? snippet(dump.stderr) : undefined,
    };
  } finally {
    await temp.cleanup();
  }
}
