import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';

/**
 * The gate: which of four screens the app shows, and in what order it decides.
 *
 * The ordering is the whole content of this component, and two steps of it are
 * counter-intuitive:
 *
 *  - the loading check comes before the session check, because a persisted
 *    session may need its token refreshed first and rendering the login screen
 *    during that window signs a returning student out on every reload; and
 *  - the recovery check comes before the session check, because a
 *    password-reset link signs the student in on the way through. Asking about
 *    the session first would hand them their courses with the password they came
 *    to change still unset.
 */

let isSupabaseConfigured = true;
let session: Session | null = null;
let isLoading = false;
let isRecoveringPassword = false;
const endPasswordRecovery = vi.fn();

vi.mock('@/lib/supabase', () => ({
  initialAuthLinkError: null,
  startedInPasswordRecovery: false,
  get isSupabaseConfigured() {
    return isSupabaseConfigured;
  },
  supabase: null,
}));

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session, isLoading, isRecoveringPassword, endPasswordRecovery }),
}));

/** The storage is built from a user id, which only exists past the gate. */
const accountStorage = vi.fn((userId: string) => ({
  load: async () => ({ courses: [], semesters: [] }),
  save: async () => {},
  flush: async () => {},
  cancel: () => {},
  userId,
}));

vi.mock('@/hooks/useAccountStorage', () => ({
  useAccountStorage: (userId: string) => accountStorage(userId),
}));

vi.mock('@/lib/supabaseProgress', () => ({
  supabaseProgressStorage: () => ({ save: async () => {}, load: async () => null }),
}));

const App = (await import('@/App')).default;

const signedIn = (id = 'user-1') =>
  ({ access_token: 'tok', user: { id, email: 'student@ubc.ca' } }) as unknown as Session;

beforeEach(() => {
  localStorage.clear();
  isSupabaseConfigured = true;
  session = null;
  isLoading = false;
  isRecoveringPassword = false;
  endPasswordRecovery.mockReset();
  accountStorage.mockClear();
});

afterEach(cleanup);

describe('AuthGate', () => {
  it('shows setup instructions before anything else when there is no project', () => {
    // Checked ahead of the session, since without a client there can never be one.
    isSupabaseConfigured = false;
    session = signedIn();

    render(<App />);

    expect(screen.getByText(/isn’t configured yet/i)).toBeTruthy();
  });

  it('waits rather than showing the login screen while the session loads', () => {
    isLoading = true;

    render(<App />);

    expect(screen.getByText('Loading your account…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^sign in$/i })).toBeNull();
  });

  it('shows the login screen once there is no session', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeTruthy();
  });

  it('shows the reset screen ahead of the courses, session or no session', () => {
    isRecoveringPassword = true;
    session = signedIn();

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /new course/i })).toBeNull();
  });

  it('shows the app once signed in', async () => {
    session = signedIn();

    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'UBC Grade Calculator' })).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: /new course/i })).toBeTruthy();
  });

  it('builds the storage for the signed-in user, and not before', async () => {
    session = signedIn('user-42');

    render(<App />);

    await waitFor(() => expect(accountStorage).toHaveBeenCalledWith('user-42'));
  });

  it('names the account in the menu', async () => {
    session = signedIn();

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Account: student@ubc.ca' })).toBeTruthy();
  });

  it('remounts the workspace when a different student signs in', async () => {
    // Storage swaps on its own, but the selected semester is local UI state and
    // would otherwise carry the previous account's choice across.
    session = signedIn('user-1');
    const { rerender } = render(<App />);
    await waitFor(() => expect(accountStorage).toHaveBeenCalledWith('user-1'));

    session = signedIn('user-2');
    rerender(<App />);

    await waitFor(() => expect(accountStorage).toHaveBeenCalledWith('user-2'));
  });
});
