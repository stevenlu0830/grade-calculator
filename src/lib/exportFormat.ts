/**
 * Conventions shared by every export format.
 */

/** `grades_export_2026-08-03.csv` — dated so repeated exports don't collide. */
export function timestampedFilename(prefix: string, extension: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}_${date}.${extension}`;
}

/**
 * Both exports flatten the course tree to one row per sub-component and print
 * the parent's columns only once per group, leaving them blank on repeat rows.
 * The CSV importer relies on this to reassemble the tree.
 */
export function firstRowOnly(rowIndex: number, value: string): string {
  return rowIndex === 0 ? value : '';
}
