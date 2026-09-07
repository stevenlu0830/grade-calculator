import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';

/**
 * The gate every other screen hangs off.
 *
 * Three of its four states are easy to get wrong in ways that only show up in
 * front of a student: reporting "signed out" while the stored token is still
 * being refreshed signs them out on every reload; missing the recovery event
 * hands them their courses with the password they came to change still unset;
 * and leaving the subscription running after unmount sets state on a component
 * that is gone.
 */

type AuthListener = (event: string, session: Session | null) => void;

const getSession = vi.fn<[], Promise<{ data: { session: Session | null } }>>();
const unsubscribe = vi.fn();
let listener: AuthListener | null = null;

const onAuthStateChange = vi.fn((next: AuthListener) => {
  listener = next;
  return { data: { subscription: { unsubscribe } } };
});

/** Both are read through getters below, so a test can change them per case. */
let startedInPasswordRecovery = false;
let client: unknown = { auth: { getSession, onAuthStateChange } };

vi.mock('@/lib/supabase', () => ({
  initialAuthLinkError: null,
  isSupabaseConfigured: true,
  get startedInPasswordRecovery() {
    return startedInPasswordRecovery;
  },
  get supabase() {
    return client;
  },
}));

const { useSession } = await import('@/hooks/useSession');

const session = { access_token: 'tok', user: { id: 'user-1' } } as unknown as Session;

/** Never settles, so the loading window can be observed rather than raced. */
const pending = () => new Promise<{ data: { session: Session | null } }>(() => {});

/**
 * Renders and lets the initial `getSession` settle. Without the flush, that
 * promise resolves after the test body and React reports the state update as
 * happening outside `act`.
 */
async function renderSettled() {
  const rendered = renderHook(() => useSession());
  await act(async () => {});
  return rendered;
}

beforeEach(() => {
  listener = null;
  startedInPasswordRecovery = false;
  client = { auth: { getSession, onAuthStateChange } };
  getSession.mockReset().mockResolvedValue({ data: { session: null } });
  onAuthStateChange.mockClear();
  unsubscribe.mockReset();
});

describe('useSession', () => {
  it('stays loading until the stored session has been read', async () => {
    // Rendering the login screen during this window would sign a returning
    // student out on every reload.
    getSession.mockReturnValue(pending());

    const { result } = renderHook(() => useSession());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.session).toBeNull();
  });

  it('reports a restored session', async () => {
    getSession.mockResolvedValue({ data: { session } });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toBe(session);
  });

  it('reports signed out once the read comes back empty', async () => {
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it('follows a sign-in that happens later, or in another tab', async () => {
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => listener?.('SIGNED_IN', session));

    expect(result.current.session).toBe(session);
  });

  it('follows a sign-out', async () => {
    getSession.mockResolvedValue({ data: { session } });
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.session).toBe(session));

    act(() => listener?.('SIGNED_OUT', null));

    expect(result.current.session).toBeNull();
  });

  it('leaves loading on the auth event alone, when it beats the initial read', async () => {
    getSession.mockReturnValue(pending());
    const { result } = renderHook(() => useSession());

    act(() => listener?.('SIGNED_IN', session));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.session).toBe(session);
  });

  it('starts in recovery when the page was opened on a reset link', async () => {
    // Seeded from the URL rather than waited for, so the grade sheet never
    // flashes up in front of someone who asked to change their password.
    startedInPasswordRecovery = true;
    getSession.mockResolvedValue({ data: { session } });

    const { result } = await renderSettled();

    expect(result.current.isRecoveringPassword).toBe(true);
  });

  it('enters recovery on the event, for a reset link opened in a running tab', async () => {
    // There, the URL was never read at module load, so this event is the only
    // notice the app gets.
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRecoveringPassword).toBe(false);

    act(() => listener?.('PASSWORD_RECOVERY', session));

    expect(result.current.isRecoveringPassword).toBe(true);
  });

  it('leaves recovery when the new password has been saved', async () => {
    const { result } = await renderSettled();
    act(() => listener?.('PASSWORD_RECOVERY', session));

    act(() => result.current.endPasswordRecovery());

    expect(result.current.isRecoveringPassword).toBe(false);
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = await renderSettled();

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('ignores an initial read that lands after unmount', async () => {
    let settle: (value: { data: { session: Session | null } }) => void = () => {};
    getSession.mockReturnValue(new Promise(resolve => void (settle = resolve)));
    const { unmount } = renderHook(() => useSession());

    unmount();
    // Setting state here would be a warning about a component that is gone. The
    // assertion is that resolving it after unmount is uneventful.
    await act(async () => settle({ data: { session } }));
  });

  it('ignores an auth event that arrives after unmount', async () => {
    const { unmount } = await renderSettled();
    await act(async () => unmount());

    act(() => listener?.('SIGNED_IN', session));
  });

  it('stops loading immediately when there is no client to ask', async () => {
    // The setup notice renders instead, but the hook must not sit spinning.
    client = null;

    const { result } = await renderSettled();

    expect(result.current.isLoading).toBe(false);
    expect(onAuthStateChange).not.toHaveBeenCalled();
  });
});
