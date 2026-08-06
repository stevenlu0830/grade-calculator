/**
 * Naming for files the app hands to the user.
 */

/** `grade_progress_2026-08-05.json` — dated so repeated saves don't collide. */
export function timestampedFilename(prefix: string, extension: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}_${date}.${extension}`;
}
