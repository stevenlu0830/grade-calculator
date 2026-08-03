/**
 * The single place this app touches the DOM to hand a file to the user.
 *
 * Isolating it here keeps the CSV and PDF builders pure, so their output can be
 * asserted in tests without a browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
