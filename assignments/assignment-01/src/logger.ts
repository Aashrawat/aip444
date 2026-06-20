let debugEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function debugLog(message: string): void {
  if (debugEnabled) {
    console.error(message);
  }
}

export function info(message: string): void {
  console.log(message);
}

export function error(message: string): void {
  console.error(message);
}
