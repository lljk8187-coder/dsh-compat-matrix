/** Runner — temp DSH_HOME + dsh process helpers (M2) + matrix run (M4) + targets (M5). */
export {
  createTempDshHome,
  type TempDshHome,
} from "./temp-home.js";
export {
  resolveDshBinary,
  runDsh,
  getDshVersion,
  DSH_MISSING_HINT,
  type RunDshOptions,
  type RunDshResult,
} from "./dsh.js";
export {
  DEFAULT_MATRIX_FIXTURES,
  parseOutDirArg,
  parseRunArgs,
  runMatrix,
  writeMatrixReportFiles,
  type ParseRunArgsResult,
  type RunMatrixOptions,
  type RunMatrixResult,
} from "./run-matrix.js";
export {
  loadTargets,
  type TargetPlugin,
  type TargetsFile,
} from "./targets.js";
