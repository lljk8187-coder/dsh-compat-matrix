/** Report stubs — compatibility matrix output (M2+). */
export function notImplemented(feature: string): never {
  throw new Error(`${feature} is not implemented yet (M2+)`);
}
