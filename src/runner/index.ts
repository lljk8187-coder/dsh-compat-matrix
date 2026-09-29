/** Runner — temp DSH_HOME + dsh process helpers (M2) + matrix run (M4). */
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
  runMatrix,
  writeMatrixReportFiles,
  type RunMatrixOptions,
  type RunMatrixResult,
} from "./run-matrix.js";
