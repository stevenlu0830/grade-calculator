import { useEffect, useRef } from 'react';
import { FlushableStorage, debouncedStorage } from '@/lib/debouncedStorage';
import { supabaseCourseStorage } from '@/lib/supabaseCourseStorage';

/**
 * The signed-in user's storage, with a stable identity for as long as they stay
 * signed in as themselves.
 *
 * `useGradeStore` takes `storage` as an effect dependency, so handing it a
 * freshly built object each render would reload from the network on every
 * keystroke. A ref rather than `useMemo` because only a ref actually guarantees
 * the identity — `useMemo` is a hint React is free to discard.
 *
 * Changing user swaps the storage, which is what makes the store reload: signing
 * out and back in as someone else can't leave the previous account's courses on
 * screen.
 */
export function useAccountStorage(userId: string): FlushableStorage {
  const cache = useRef<{ userId: string; storage: FlushableStorage } | null>(null);

  if (cache.current === null || cache.current.userId !== userId) {
    cache.current = { userId, storage: debouncedStorage(supabaseCourseStorage(userId)) };
  }
  const { storage } = cache.current;

  useEffect(() => {
    // Saves are debounced, so an edit made in the last fraction of a second
    // before the tab closes is still sitting in the timer. `pagehide` is the
    // event that survives the bfcache and mobile Safari, where `unload` doesn't.
    // Best effort only: the browser may not stay alive for the round trip.
    const flush = () => {
      void storage.flush().catch(() => {});
    };

    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      // Unmounting means signing out or switching user; write what's pending
      // while the old session's token is still valid.
      flush();
    };
  }, [storage]);

  return storage;
}
