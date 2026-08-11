import { useCallback, useEffect, useRef, useState } from 'react';
import { GradeData } from '@/types/grades';
import { readLocalData, retireLocalData } from '@/lib/courseStorage';

/**
 * Offers the browser's pre-accounts data to an account that has none.
 *
 * Courses saved before this app had sign-in are still sitting in `localStorage`,
 * and to their owner they simply look lost. The offer is made once per browser
 * rather than once per account: that payload has no owner, so asking each new
 * account would hand the first student's courses to the second one.
 *
 * Deliberately never merges. It only ever fires when the account is empty, so
 * there is nothing to merge with and no "which copy wins" question to get wrong.
 */
export function useLocalDataImport(isReady: boolean, isAccountEmpty: boolean) {
  const [candidate, setCandidate] = useState<GradeData | null>(null);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!isReady || hasChecked.current) return;
    hasChecked.current = true;

    // An account with courses of its own is never offered the payload, so
    // leaving it in place would only keep it available to the next student who
    // signs in here. Retiring silently is the same statement the dialog makes:
    // this browser is done migrating.
    if (!isAccountEmpty) {
      retireLocalData();
      return;
    }

    const local = readLocalData();
    if (local.courses.length === 0 && local.semesters.length === 0) return;

    setCandidate(local);
  }, [isReady, isAccountEmpty]);

  /**
   * Closes the offer for good, whichever way it was answered.
   *
   * Retiring on "Start fresh" as well as on "Import" is the point: an answered
   * question is answered, and from here on the account is the only place course
   * data lives. `retireLocalData` archives rather than deletes, so declining by
   * accident is still recoverable.
   */
  const dismiss = useCallback(() => {
    retireLocalData();
    setCandidate(null);
  }, []);

  return { candidate, dismiss };
}
