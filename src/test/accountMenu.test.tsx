import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

/**
 * Who's signed in, and the way out.
 *
 * Signing out doesn't navigate — it clears the session and the gate in `App`
 * swaps the screen on the next render — so the only thing this component has to
 * get right on its own is the failure: a sign-out that didn't happen must say
 * so and leave the item usable, rather than sitting disabled forever.
 */

const signOut = vi.fn<[], Promise<void>>();

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, signOut: () => signOut() };
});

const failure = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (...args: unknown[]) => failure(...args) },
}));

const { AccountMenu } = await import('@/components/AccountMenu');

/**
 * Keyboard rather than a click: the Radix trigger opens on `pointerdown`, which
 * jsdom has no real implementation of, and `Enter` is the documented equivalent.
 */
const openMenu = () =>
  fireEvent.keyDown(screen.getByRole('button', { name: /account: student@ubc\.ca/i }), {
    key: 'Enter',
  });
const signOutItem = () => screen.getByRole('menuitem', { name: /sign out/i });

beforeEach(() => {
  signOut.mockReset().mockResolvedValue(undefined);
  failure.mockReset();
});

afterEach(cleanup);

describe('AccountMenu', () => {
  it('labels the trigger with the account, since the icon alone says nothing', () => {
    render(<AccountMenu email="student@ubc.ca" />);

    expect(screen.getByRole('button', { name: 'Account: student@ubc.ca' })).toBeTruthy();
  });

  it('shows which account is signed in, for a shared computer', () => {
    render(<AccountMenu email="student@ubc.ca" />);

    openMenu();

    expect(screen.getByText('Signed in as')).toBeTruthy();
    expect(screen.getByText('student@ubc.ca')).toBeTruthy();
  });

  it('shows the credits, for a restored session that never saw the sign-in screen', () => {
    render(<AccountMenu email="student@ubc.ca" />);

    openMenu();

    expect(screen.getByRole('link', { name: /awicon - flaticon/i })).toBeTruthy();
  });

  it('signs out', async () => {
    render(<AccountMenu email="student@ubc.ca" />);

    openMenu();
    fireEvent.click(signOutItem());

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(failure).not.toHaveBeenCalled();
  });

  it('reports a failed sign-out and lets it be tried again', async () => {
    signOut.mockRejectedValue(new Error('Failed to fetch'));
    render(<AccountMenu email="student@ubc.ca" />);

    openMenu();
    fireEvent.click(signOutItem());

    await waitFor(() => expect(failure).toHaveBeenCalled());
    // The message is rewritten from Supabase's own by `describeAuthError`.
    expect(JSON.stringify(failure.mock.calls.at(-1))).toMatch(/could not reach the server/i);

    openMenu();
    expect(signOutItem()).toBeEnabled();
  });
});
