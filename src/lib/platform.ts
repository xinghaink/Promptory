/** True inside the browser extension; false for the standalone web app. */
export const IS_EXTENSION =
  typeof globalThis !== 'undefined' &&
  !!(globalThis as { chrome?: { runtime?: { id?: string } } }).chrome?.runtime?.id;
