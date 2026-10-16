/** Pure rule for low-sensory mode. Either signal alone turns it on. */
export function resolveLowSensory(osPrefersReducedMotion: boolean, savedReducedSensory: boolean): boolean {
  return osPrefersReducedMotion || savedReducedSensory;
}

/** Escape always means "exit" on calm-tool screens. */
export function isExitKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}
