import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * The one module allowed to read the environment.
 *
 * It is evaluated once at import, so each case here resets the module registry
 * and imports it fresh with the variables it wants. Two facts are worth pinning
 * down: importing it can never throw, whatever the environment holds — every
 * screen is behind the gate that checks `isSupabaseConfigured` — and a half-set
 * `.env.local` counts as not configured, so a missing key produces setup
 * instructions rather than a client that fails on its first request.
 */

/** Imports the module fresh with exactly these variables set. */
async function loadWith(url?: string, anonKey?: string) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_SUPABASE_URL', url ?? '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', anonKey ?? '');
  return import('@/lib/supabase');
}

const CONFIGURED = ['https://project-ref.supabase.co', 'anon-key'] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('the Supabase module', () => {
  it('builds a client when both values are set', async () => {
    const { isSupabaseConfigured, supabase, requireSupabase } = await loadWith(...CONFIGURED);

    expect(isSupabaseConfigured).toBe(true);
    expect(supabase).not.toBeNull();
    expect(requireSupabase()).toBe(supabase);
  });

  it('keeps the session in the browser, so a reload stays signed in', async () => {
    const { supabase } = await loadWith(...CONFIGURED);

    expect(supabase?.auth).toBeTruthy();
  });

  it('reports not-configured, without throwing, when nothing is set', async () => {
    const { isSupabaseConfigured, supabase } = await loadWith();

    expect(isSupabaseConfigured).toBe(false);
    expect(supabase).toBeNull();
  });

  it('treats a half-filled .env.local as not configured', async () => {
    // A client built on one of the two values fails on its first request, which
    // is a much worse error than the setup notice.
    expect((await loadWith('https://project-ref.supabase.co')).isSupabaseConfigured).toBe(false);
    expect((await loadWith(undefined, 'anon-key')).isSupabaseConfigured).toBe(false);
  });

  it('names both variables when a caller demands a client it cannot have', async () => {
    const { requireSupabase } = await loadWith();

    expect(() => requireSupabase()).toThrow(/VITE_SUPABASE_URL/);
    expect(() => requireSupabase()).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });

  it('keeps the two table names apart', async () => {
    // The autosave and the Save Progress snapshot are different rows on purpose;
    // pointing one at the other would make Reload Progress a no-op.
    const { USER_DATA_TABLE, USER_PROGRESS_TABLE } = await loadWith(...CONFIGURED);

    expect(USER_DATA_TABLE).toBe('user_data');
    expect(USER_PROGRESS_TABLE).toBe('user_progress');
    expect(USER_DATA_TABLE).not.toBe(USER_PROGRESS_TABLE);
  });

  it('re-exports the URL fragment readings, so they happen before the client', async () => {
    // `createClient` erases the fragment as soon as it has consumed it, so the
    // recovery flags have to be read first — which is what importing them from
    // here guarantees.
    const module = await loadWith(...CONFIGURED);

    expect(module).toHaveProperty('startedInPasswordRecovery');
    expect(module).toHaveProperty('initialAuthLinkError');
  });
});
