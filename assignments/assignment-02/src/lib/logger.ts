let debugEnabled =
  process.env.LOG_LEVEL?.toLowerCase() === 'debug' ||
  process.env.DEBUG === '1' ||
  process.env.DEBUG === 'true';

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebug(): boolean {
  return debugEnabled;
}

/** Diagnostic logs go to stderr so stdout stays clean for piping. */
export function debugLog(message: string): void {
  if (debugEnabled) {
    console.error(`[DEBUG] ${message}`);
  }
}

export function info(message: string): void {
  console.log(message);
}

export function warn(message: string): void {
  console.error(`[WARN] ${message}`);
}

export function error(message: string): void {
  console.error(`[ERROR] ${message}`);
}
