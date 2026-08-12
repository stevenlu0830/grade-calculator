import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { startedInPasswordRecovery, supabase } from '@/lib/supabase';

export interface SessionState {
  session: Session | null;
  /** True until the stored session has been read; neither signed in nor out yet. */
  isLoading: boolean;
  /**
   * True from a click on a password-reset link until the new password is saved.
   *
   * Separate from `session` because that link produces a perfectly ordinary
   * session — the distinction it carries is only in the URL it arrived on.
   */
  isRecoveringPassword: boolean;
  /** Leaves recovery: the password was changed, or the student backed out. */
  endPasswordRecovery: () => void;
}

/**
 * The current Supabase session, kept in sync with the client.
 *
 * Call this once, above the auth gate. The initial read is asynchronous because
 * a persisted session may need its token refreshed first — rendering the login
 * screen during that window would sign the student out on every reload.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Seeded from the URL the page was opened on rather than waiting for the event
  // below, so the grade sheet never flashes up in front of a student who asked
  // to reset their password. See src/lib/authCallback.ts.
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(startedInPasswordRecovery);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setIsLoading(false);
    });

    // Covers sign in, sign out, token refresh and changes made in another tab.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (cancelled) return;
      // The seeded value above normally wins the race to this, but not when the
      // client is slow enough to read the fragment after the first render, and
      // not at all when the reset link is opened in a tab already running the
      // app — there, this event is the only notice we get.
      if (event === 'PASSWORD_RECOVERY') setIsRecoveringPassword(true);
      setSession(next);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const endPasswordRecovery = useCallback(() => setIsRecoveringPassword(false), []);

  return { session, isLoading, isRecoveringPassword, endPasswordRecovery };
}
