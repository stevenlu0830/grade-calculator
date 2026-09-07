import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { GradeData } from '@/types/grades';

/**
 * The storage handed to `useGradeStore`, and the two promises it makes:
 *
 *  - its identity is stable for as long as the same student is signed in.
 *    `useGradeStore` takes `storage` as an effect dependency, so a fresh object
 *    per render would reload from the network on every keystroke; and
 *  - a debounced save still in its timer is written when the page goes away,
 *    or when the user changes underneath it.
 */

const saved: GradeData[] = [];
const loaded = vi.fn<[], Promise<GradeData>>();
/** Which user each built backend was built for, in order. */
const builtFor: string[] = [];

vi.mock('@/lib/supabaseCourseStorage', () => ({
  supabaseCourseStorage: (userId: string) => {
    builtFor.push(userId);
    return {
      load: () => loaded(),
      save: async (data: GradeData) => void saved.push(data),
    };
  },
}));

const { useAccountStorage } = await import('@/hooks/useAccountStorage');

const gradeData: GradeData = { courses: [], semesters: ['2026 Winter Term 1'] };

beforeEach(() => {
  vi.useFakeTimers();
  saved.length = 0;
  builtFor.length = 0;
  loaded.mockReset().mockResolvedValue({ courses: [], semesters: [] });
});

afterEach(() => vi.useRealTimers());

describe('useAccountStorage', () => {
  it('hands back the same object on every render of the same session', () => {
    const { result, rerender } = renderHook(({ id }) => useAccountStorage(id), {
      initialProps: { id: 'user-1' },
    });
    const first = result.current;

    rerender({ id: 'user-1' });
    rerender({ id: 'user-1' });

    expect(result.current).toBe(first);
    // And the backend underneath it was only ever built once.
    expect(builtFor).toEqual(['user-1']);
  });

  it('swaps storage when the user changes, which is what reloads the store', () => {
    // Signing out and back in as someone else must not leave the previous
    // account's courses on screen.
    const { result, rerender } = renderHook(({ id }) => useAccountStorage(id), {
      initialProps: { id: 'user-1' },
    });
    const first = result.current;

    rerender({ id: 'user-2' });

    expect(result.current).not.toBe(first);
    expect(builtFor).toEqual(['user-1', 'user-2']);
  });

  it('debounces saves rather than writing on every keystroke', async () => {
    const { result } = renderHook(() => useAccountStorage('user-1'));

    void result.current.save(gradeData);
    void result.current.save(gradeData);
    expect(saved).toEqual([]);

    await act(async () => void vi.runAllTimers());

    expect(saved).toHaveLength(1);
  });

  it('passes a load straight through, undebounced', async () => {
    const { result } = renderHook(() => useAccountStorage('user-1'));

    await result.current.load();

    expect(loaded).toHaveBeenCalledTimes(1);
  });

  it('writes a pending edit when the page goes away', async () => {
    // `pagehide` rather than `unload`: it is the one that fires under the
    // bfcache and on mobile Safari.
    renderHookWithPendingSave();

    await act(async () => void window.dispatchEvent(new Event('pagehide')));

    expect(saved).toEqual([gradeData]);
  });

  it('writes a pending edit on unmount, while the old token is still valid', async () => {
    const { unmount } = renderHookWithPendingSave();

    await act(async () => unmount());

    expect(saved).toEqual([gradeData]);
  });

  it('stops listening once it has unmounted', async () => {
    const { unmount } = renderHook(() => useAccountStorage('user-1'));
    await act(async () => unmount());
    saved.length = 0;

    await act(async () => void window.dispatchEvent(new Event('pagehide')));

    expect(saved).toEqual([]);
  });

  it('survives a flush that fails, since the page is leaving either way', async () => {
    const { result, unmount } = renderHook(() => useAccountStorage('user-1'));
    vi.spyOn(result.current, 'flush').mockRejectedValue(new Error('offline'));

    // The assertion is that neither of these rejects into an unhandled promise.
    await act(async () => void window.dispatchEvent(new Event('pagehide')));
    await act(async () => unmount());
  });
});

/** A hook with one save sitting in the debounce timer, unwritten. */
function renderHookWithPendingSave() {
  const rendered = renderHook(() => useAccountStorage('user-1'));
  void rendered.result.current.save(gradeData);
  expect(saved).toEqual([]);
  return rendered;
}
