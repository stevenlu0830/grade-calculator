/**
 * Identifiers for courses, components and sub-components.
 *
 * Kept in one place so the store and the CSV importer mint ids the same way.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Older browsers and non-DOM test environments.
  return Math.random().toString(36).slice(2, 11);
}
