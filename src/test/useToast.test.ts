import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { reducer, toast, useToast } from '@/hooks/use-toast';

/**
 * The vendored shadcn toast store.
 *
 * The app itself uses `sonner` — CONVENTIONS.md calls this one legacy and says
 * not to add usages — but it is still wired to `<Toaster />` in `App`, so it is
 * live code and worth covering. Its edits belong to `npx shadcn add`, so these
 * assert its contract and nothing about how it is written.
 *
 * Its module state is a singleton shared by every caller, which is what makes
 * the queue below observable at all — and why each test drains it first.
 */

/** Empties the shared store, so one test's toast can't be another's. */
function drain() {
  const { result } = renderHook(() => useToast());
  act(() => result.current.dismiss());
  act(() => void vi.runAllTimers());
}

beforeEach(() => {
  vi.useFakeTimers();
  drain();
});

afterEach(() => vi.useRealTimers());

describe('the reducer', () => {
  const one = { id: '1', title: 'First', open: true };
  const two = { id: '2', title: 'Second', open: true };

  it('keeps only the newest toast', () => {
    // TOAST_LIMIT is 1: a second one replaces the first rather than stacking.
    const state = reducer(reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: one }), {
      type: 'ADD_TOAST',
      toast: two,
    });

    expect(state.toasts).toEqual([two]);
  });

  it('updates a toast in place, by id', () => {
    const state = reducer({ toasts: [one] }, { type: 'UPDATE_TOAST', toast: { id: '1', title: 'Changed' } });

    expect(state.toasts[0]).toMatchObject({ id: '1', title: 'Changed', open: true });
  });

  it('leaves other toasts alone on an update', () => {
    const state = reducer({ toasts: [one, two] }, { type: 'UPDATE_TOAST', toast: { id: '1', title: 'Changed' } });

    expect(state.toasts[1]).toEqual(two);
  });

  it('closes one toast on dismiss rather than removing it, so it can animate out', () => {
    const state = reducer({ toasts: [one, two] }, { type: 'DISMISS_TOAST', toastId: '1' });

    expect(state.toasts[0].open).toBe(false);
    expect(state.toasts[1].open).toBe(true);
  });

  it('closes all of them when no id is named', () => {
    const state = reducer({ toasts: [one, two] }, { type: 'DISMISS_TOAST' });

    expect(state.toasts.map(t => t.open)).toEqual([false, false]);
  });

  it('removes one toast by id', () => {
    const state = reducer({ toasts: [one, two] }, { type: 'REMOVE_TOAST', toastId: '1' });

    expect(state.toasts).toEqual([two]);
  });

  it('clears the lot when no id is named', () => {
    const state = reducer({ toasts: [one, two] }, { type: 'REMOVE_TOAST' });

    expect(state.toasts).toEqual([]);
  });
});

describe('toast', () => {
  it('shows up in the hook, open', () => {
    const { result } = renderHook(() => useToast());

    act(() => void toast({ title: 'Saved' }));

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({ title: 'Saved', open: true });
  });

  it('hands back a handle that can change it afterwards', () => {
    const { result } = renderHook(() => useToast());
    let handle: ReturnType<typeof toast>;

    act(() => void (handle = toast({ title: 'Saving…' })));
    act(() => handle.update({ id: handle.id, title: 'Saved' }));

    expect(result.current.toasts[0].title).toBe('Saved');
  });

  it('closes on its own dismiss', () => {
    const { result } = renderHook(() => useToast());
    let handle: ReturnType<typeof toast>;

    act(() => void (handle = toast({ title: 'Saved' })));
    act(() => handle.dismiss());

    expect(result.current.toasts[0].open).toBe(false);
  });

  it('closes when the toast component reports itself closed', () => {
    const { result } = renderHook(() => useToast());
    act(() => void toast({ title: 'Saved' }));

    act(() => result.current.toasts[0].onOpenChange?.(false));

    expect(result.current.toasts[0].open).toBe(false);
  });

  it('stays put while the component reports itself open', () => {
    const { result } = renderHook(() => useToast());
    act(() => void toast({ title: 'Saved' }));

    act(() => result.current.toasts[0].onOpenChange?.(true));

    expect(result.current.toasts[0].open).toBe(true);
  });

  it('is dropped for good once the removal delay elapses', () => {
    const { result } = renderHook(() => useToast());
    act(() => void toast({ title: 'Saved' }));

    act(() => result.current.dismiss());
    expect(result.current.toasts).toHaveLength(1);

    act(() => void vi.runAllTimers());
    expect(result.current.toasts).toEqual([]);
  });

  it('queues a given toast for removal only once', () => {
    const { result } = renderHook(() => useToast());
    act(() => void toast({ title: 'Saved' }));

    act(() => result.current.dismiss());
    const queued = vi.getTimerCount();
    act(() => result.current.dismiss());

    expect(vi.getTimerCount()).toBe(queued);
  });

  it('gives every toast its own id', () => {
    let first: string, second: string;

    act(() => void (first = toast({ title: 'One' }).id));
    act(() => void (second = toast({ title: 'Two' }).id));

    expect(first).not.toBe(second);
  });

  it('stops updating a hook that has unmounted', () => {
    const { result, unmount } = renderHook(() => useToast());
    act(() => void toast({ title: 'Before' }));
    unmount();

    // A listener left in the array would set state on a component that is gone.
    act(() => void toast({ title: 'After' }));

    expect(result.current.toasts[0].title).toBe('Before');
  });
});
