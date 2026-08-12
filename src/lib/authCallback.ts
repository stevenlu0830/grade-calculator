/**
 * What the link in an auth email told us on this page load.
 *
 * Supabase sends the student back to the app with the answer in the URL
 * fragment. A working password-reset link carries a session and a type:
 *
 *   https://app.example.com/#access_token=…&type=recovery
 *
 * That session is a real one. Without reading the `type`, the auth gate would
 * see a signed-in user and render the grade sheet — the student would have
 * clicked "reset my password" and landed on their courses, password unchanged
 * and no form in sight.
 *
 * A link that expired or was already used carries no session at all, only an
 * error:
 *
 *   https://app.example.com/#error=access_denied&error_code=otp_expired&…
 *
 * which is worth repeating on screen, since the alternative is an unexplained
 * login form.
 *
 * Both values are captured when this module is first evaluated rather than when
 * they are read. The Supabase client clears the fragment once it has consumed
 * it, and it begins as soon as it is constructed, so anything reading
 * `window.location.hash` later is racing it. `src/lib/supabase.ts` re-exports
 * from here above its own `createClient` call for exactly that reason: an ES
 * module finishes evaluating before the module that imports it does.
 */

/** Pure, so the fragment parsing is testable without a browser. */
export function isRecoveryHash(hash: string): boolean {
  return hashParams(hash).get('type') === 'recovery';
}

/**
 * The message an errored link came back with, or `null` when it didn't error.
 *
 * Supabase's own `error_description` is written for a person ("Email link is
 * invalid or has expired"), so it is worth more than anything generic invented
 * here. The fallback only covers an error with no description attached.
 */
export function describeHashError(hash: string): string | null {
  const params = hashParams(hash);
  if (!params.get('error') && !params.get('error_code')) return null;
  return params.get('error_description') || 'That link is no longer valid.';
}

function hashParams(hash: string): URLSearchParams {
  // `URLSearchParams` decodes `+` as a space, which is how the fragment encodes
  // the spaces in `error_description`.
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

const initialHash = typeof window === 'undefined' ? '' : window.location.hash;

/** Captured at module load; see the note above. */
export const startedInPasswordRecovery = isRecoveryHash(initialHash);

/** Captured at module load; see the note above. */
export const initialAuthLinkError = describeHashError(initialHash);
