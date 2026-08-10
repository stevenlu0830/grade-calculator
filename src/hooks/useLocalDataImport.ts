import { useCallback, useEffect, useRef, useState } from 'react';
import { GradeData } from '@/types/grades';
import { readLocalData } from '@/lib/courseStorage';

/** Per user, so two students sharing a browser are each asked once. */
export const importOfferKey = (userId: string) =>
  `ubc-grade-calculator-local-import-offered:${userId}`;

const wasOffered = (userId: string): boolean => {
  try {
    return localStorage.getItem(importOfferKey(userId)) !== null;
  } catch {
    // Private browsing: better to ask twice than to crash the app.
    return false;
  }
};

const markOffered = (userId: string): void => {
  try {
    localStorage.setItem(importOfferKey(userId), 'true');
  } catch {
    // Nothing to do — the offer just reappears next time.
  }
};

/**
 * Offers the browser's pre-accounts data to an account that has none.
 *
 * Courses saved before this app had sign-in are still sitting in `localStorage`,
 * and to their owner they simply look lost. The offer is made once per account:
 * declining is a real answer, and asking again on every reload would be nagging.
 *
 * Deliberately never merges. It only ever fires when the account is empty, so
 * there is nothing to merge with and no "which copy wins" question to get wrong.
 */
export function useLocalDataImport(userId: string, isReady: boolean, isAccountEmpty: boolean) {
  const [candidate, setCandidate] = useState<GradeData | null>(null);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!isReady || hasChecked.current) return;
    hasChecked.current = true;

    if (!isAccountEmpty) return;
    if (wasOffered(userId)) return;

    const local = readLocalData();
    if (local.courses.length === 0 && local.semesters.length === 0) return;

    setCandidate(local);
  }, [isReady, isAccountEmpty, userId]);

  /** Closes the offer for good, whichever way it was answered. */
  const dismiss = useCallback(() => {
    markOffered(userId);
    setCandidate(null);
  }, [userId]);

  return { candidate, dismiss };
}
