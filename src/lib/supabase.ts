import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Re-exported from here, rather than imported where it's used, to pin down when
 * it runs. Those values are read off the URL fragment, and `createClient` below
 * erases that fragment as soon as it has consumed it. An imported module is
 * fully evaluated before the body of the module importing it, so putting the
 * import here is what guarantees the fragment is read first.
 */
export { initialAuthLinkError, startedInPasswordRecovery } from '@/lib/authCallback';

/**
 * The Supabase connection, and the single place the environment is read.
 *
 * Both values are safe in client code: the URL is public, and the anon key is a
 * publishable identifier, not a secret. What stops one student reading
 * another's grades is the row-level security policy on `user_data` (see
 * `supabase/migrations/0001_user_data.sql`), never the key being hidden.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Whether the app has been pointed at a Supabase project.
 *
 * Checked before anything tries to sign in, so a missing `.env.local` produces
 * setup instructions on screen rather than a stack trace from deep inside the
 * client.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * `null` until configured, so importing this module can never throw. Every
 * caller is behind the auth gate, which refuses to render without a client.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        // Keep the session in localStorage and refresh it in the background, so
        // a student stays signed in across reloads.
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * The client, or a thrown error naming what's missing.
 *
 * Use this where a client is genuinely required and `null` would only turn into
 * a less obvious failure a few frames later.
 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and fill in ' +
        'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

/** The table holding one row of saved grade data per user. */
export const USER_DATA_TABLE = 'user_data';
