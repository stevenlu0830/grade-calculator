import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface SessionState {
  session: Session | null;
  /** True until the stored session has been read; neither signed in nor out yet. */
  isLoading: boolean;
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
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (cancelled) return;
      setSession(next);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { session, isLoading };
}
