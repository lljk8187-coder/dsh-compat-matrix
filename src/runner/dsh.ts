import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";

export type RunDshOptions = {
  /** Extra / override env for the child (merged over process.env). */
  env?: NodeJS.ProcessEnv;
  /** Kill after this many ms. Default 60_000. */
  timeoutMs?: number;
  cwd?: string;
};

export type RunDshResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
};

export const DSH_MISSING_HINT =
  "dsh binary not found on PATH. Install with: npm install -g @deepseek-ai/dsh " +
  "(requires Node ≥22.19) and pnpm (npm install -g pnpm). " +
  'Ensure PATH includes your node22 and global bin dirs, e.g. export PATH="/home/box/.local/node22/bin:/home/box/.local/bin:$PATH".';

/**
 * Resolve `dsh` from PATH. Throws a clear install hint if missing.
 */
export function resolveDshBinary(): string {
  const pathEnv = process.env.PATH ?? "";
  const sep = process.platform === "win32" ? ";" : ":";
  const names =
    process.platform === "win32"
      ? ["dsh.exe", "dsh.cmd", "dsh.bat", "dsh"]
      : ["dsh"];

  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        accessSync(file, constants.X_OK);
        return file;
      } catch {
        try {
          accessSync(file, constants.F_OK);
          return file;
        } catch {
          // continue
        }
      }
    }
  }
  throw new Error(DSH_MISSING_HINT);
}

/**
 * Run `dsh` with argv (without the binary name). Captures stdout/stderr.
 */
export function runDsh(
  argv: string[],
  options: RunDshOptions = {},
): Promise<RunDshResult> {
  const binary = resolveDshBinary();
  const timeoutMs = options.timeoutMs ?? 60_000;
  const env = { ...process.env, ...options.env };

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(binary, argv, {
      env,
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const finish = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code, signal, timedOut });
    };

    child.on("error", (err) => {
      stderr += (stderr ? "\n" : "") + String(err);
      finish(1, null);
    });
    child.on("close", (code, signal) => {
      finish(code, signal);
    });
  });
}

/** Best-effort `dsh --version` string, or undefined. */
export async function getDshVersion(): Promise<string | undefined> {
  try {
    const r = await runDsh(["--version"], { timeoutMs: 15_000 });
    const line = (r.stdout || r.stderr).trim().split("\n")[0]?.trim();
    return line || undefined;
  } catch {
    return undefined;
  }
}
