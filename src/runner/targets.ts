/**
 * Targets file loader (M5): local path plugins for serial batch probe.
 * dshVersion is documentation-only — never switches dsh binaries.
 */
import { readFile } from "node:fs/promises";

export type TargetPlugin = {
  /** Preferred MatrixRow.plugin label when present. */
  id?: string;
  /** Plugin path relative to cwd or absolute (required). */
  path: string;
};

export type TargetsFile = {
  /** Optional documentation only — ignored for execution / binary selection. */
  dshVersion?: string;
  plugins: TargetPlugin[];
};

/**
 * Load and validate a targets JSON file.
 * Rejects empty plugins[], missing/empty path, or invalid JSON with clear Error.
 */
export async function loadTargets(filePath: string): Promise<TargetsFile> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read targets file ${filePath}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in targets file ${filePath}: ${message}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `Targets file ${filePath}: expected a JSON object with a "plugins" array`,
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (!("plugins" in obj)) {
    throw new Error(
      `Targets file ${filePath}: missing required "plugins" array`,
    );
  }

  if (!Array.isArray(obj.plugins)) {
    throw new Error(
      `Targets file ${filePath}: "plugins" must be an array`,
    );
  }

  if (obj.plugins.length === 0) {
    throw new Error(
      `Targets file ${filePath}: "plugins" must not be empty`,
    );
  }

  const plugins: TargetPlugin[] = [];
  for (let i = 0; i < obj.plugins.length; i++) {
    const item = obj.plugins[i];
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(
        `Targets file ${filePath}: plugins[${i}] must be an object with a "path" string`,
      );
    }
    const p = item as Record<string, unknown>;
    if (typeof p.path !== "string" || p.path.trim() === "") {
      throw new Error(
        `Targets file ${filePath}: plugins[${i}] missing required non-empty "path"`,
      );
    }
    const plugin: TargetPlugin = { path: p.path.trim() };
    if (typeof p.id === "string" && p.id.trim() !== "") {
      plugin.id = p.id.trim();
    }
    plugins.push(plugin);
  }

  const result: TargetsFile = { plugins };
  if (typeof obj.dshVersion === "string" && obj.dshVersion.trim() !== "") {
    result.dshVersion = obj.dshVersion.trim();
  }
  return result;
}
