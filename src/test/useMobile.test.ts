import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * A vendored shadcn hook, used by the sidebar primitive.
 *
 * Covered because it is small and live, not because it is ours to change: it
 * arrives with `npx shadcn add` and the CLI will overwrite edits to it. What is
 * asserted is only its contract — a boolean, kept in step with the viewport,
 * with the listener released on unmount.
 */

const MOBILE_BREAKPOINT = 768;

type Listener = () => void;
let listeners: Listener[];
const removed: Listener[] = [];

/** A `matchMedia` that records its listeners, which jsdom's stub does not. */
function stubMatchMedia() {
  listeners = [];
  removed.length = 0;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: window.innerWidth < MOBILE_BREAKPOINT,
      media: query,
      addEventListener: (_: string, listener: Listener) => void listeners.push(listener),
      removeEventListener: (_: string, listener: Listener) => void removed.push(listener),
    }),
  });
}

const setWidth = (width: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });

beforeEach(() => {
  stubMatchMedia();
  setWidth(1024);
});

afterEach(() => vi.restoreAllMocks());

describe('useIsMobile', () => {
  it('reads the viewport on mount', () => {
    setWidth(375);

    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });

  it('is false on a desktop-width window', () => {
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('treats the breakpoint itself as not mobile', () => {
    setWidth(MOBILE_BREAKPOINT);

    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('follows a resize across the breakpoint', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setWidth(375);
    act(() => listeners.forEach(listener => listener()));

    expect(result.current).toBe(true);
  });

  it('releases its listener on unmount', () => {
    const { unmount } = renderHook(() => useIsMobile());

    unmount();

    expect(removed).toEqual(listeners);
  });
});
