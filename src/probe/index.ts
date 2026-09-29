/** Probe stubs — compatibility probing against a dsh version (M2+). */
export function notImplemented(feature: string): never {
  throw new Error(`${feature} is not implemented yet (M2+)`);
}
