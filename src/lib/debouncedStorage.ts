import { CourseStorage } from '@/lib/courseStorage';
import { GradeData } from '@/types/grades';

/**
 * How long to wait for typing to stop before writing.
 *
 * The store autosaves on every state change, which against `localStorage` was
 * free and against a network is not: typing "87" into a marks field is two
 * renders, and working through a course is dozens. Long enough to coalesce a
 * burst of keystrokes, short enough that closing the tab straight after typing
 * is an unusual way to lose the last edit.
 */
export const DEFAULT_SAVE_DELAY_MS = 600;

export interface FlushableStorage extends CourseStorage {
  /** Writes any pending data now. Resolves once the write settles. */
  flush(): Promise<void>;
  /** Drops any pending data unwritten. */
  cancel(): void;
}

interface Waiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Coalesces a burst of saves into one write.
 *
 * Only the newest data is ever written — an intermediate state that was
 * superseded before the timer elapsed was never worth a round trip. The promise
 * returned by every superseded `save` settles with the write that replaced it,
 * so a caller awaiting it still learns whether their edit reached storage.
 *
 * Reads are passed straight through: a load is a deliberate act, and delaying
 * it would only make the app feel slow.
 */
export function debouncedStorage(
  inner: CourseStorage,
  delayMs: number = DEFAULT_SAVE_DELAY_MS
): FlushableStorage {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: GradeData | null = null;
  let waiters: Waiter[] = [];

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const write = async (): Promise<void> => {
    clearTimer();
    if (pending === null) return;

    // Claim the pending write before awaiting, so a save arriving mid-flight
    // queues a fresh timer instead of being folded into the one in progress and
    // silently dropped.
    const data = pending;
    const settle = waiters;
    pending = null;
    waiters = [];

    try {
      await inner.save(data);
      settle.forEach(waiter => waiter.resolve());
    } catch (error) {
      settle.forEach(waiter => waiter.reject(error));
      throw error;
    }
  };

  return {
    load: () => inner.load(),

    save(data: GradeData): Promise<void> {
      pending = data;
      clearTimer();
      timer = setTimeout(() => {
        // Nothing awaits the timer's own promise; every caller is holding one
        // of the waiters instead, and an unhandled rejection here would be
        // reported twice.
        void write().catch(() => {});
      }, delayMs);
      return new Promise<void>((resolve, reject) => waiters.push({ resolve, reject }));
    },

    flush: write,

    cancel(): void {
      clearTimer();
      pending = null;
      const settle = waiters;
      waiters = [];
      settle.forEach(waiter => waiter.resolve());
    },
  };
}
