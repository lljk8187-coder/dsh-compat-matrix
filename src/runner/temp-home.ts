import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type TempDshHome = {
  /** Absolute path of the temporary DSH_HOME directory. */
  dshHome: string;
  /** Best-effort recursive remove; errors are swallowed. */
  cleanup: () => Promise<void>;
};

/**
 * Create an isolated DSH_HOME under the OS temp dir.
 * Callers must set `DSH_HOME` only on child process env — never write to ~/.dsh.
 */
export async function createTempDshHome(
  prefix = "dsh-compat-",
): Promise<TempDshHome> {
  const dshHome = await mkdtemp(path.join(tmpdir(), prefix));
  return {
    dshHome,
    cleanup: async () => {
      try {
        await rm(dshHome, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}
