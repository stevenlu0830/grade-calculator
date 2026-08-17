import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

/**
 * The two paths that end in a confirmation email rather than a session.
 *
 * Signing in and registering both hand off to Supabase, so the network half is
 * mocked and these assert only what the form does with each answer — which
 * screen it shows, and whether a resend is offered. That branching is the part
 * that failed quietly before: an unconfirmed account was told to check an inbox
 * by a form with no way to send it anything.
 *
 * `fireEvent` rather than `user-event`, which isn't a dependency here — the same
 * choice `passwordInput.test.tsx` makes.
 */
vi.mock('@/lib/supabase', () => ({
  initialAuthLinkError: null,
  isSupabaseConfigured: true,
  supabase: null,
}));

const signInWithPassword = vi.fn();
const signUpWithPassword = vi.fn();
const resendConfirmationEmail = vi.fn();

vi.mock('@/lib/auth', async () => {
  // The pure helpers are the real ones — validation and the error predicate are
  // exactly what's under test here, so mocking them would prove nothing.
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
    signUpWithPassword: (...args: unknown[]) => signUpWithPassword(...args),
    resendConfirmationEmail: (...args: unknown[]) => resendConfirmationEmail(...args),
    sendPasswordResetEmail: vi.fn(),
  };
});

const { AuthForm } = await import('@/components/AuthForm');

const byId = (id: string) => document.getElementById(id) as HTMLInputElement;
const fill = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });

beforeEach(() => {
  signInWithPassword.mockReset();
  signUpWithPassword.mockReset();
  resendConfirmationEmail.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

/** Fills the sign-in form and submits it. */
function signIn() {
  fill(screen.getByPlaceholderText(/you@student/i), 'student@ubc.ca');
  fill(byId('auth-password'), 'hunter2');
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
}

/** Switches to registration, fills all three boxes and submits. */
function register() {
  fireEvent.click(screen.getByRole('button', { name: /register/i }));
  fill(screen.getByPlaceholderText(/you@student/i), 'student@ubc.ca');
  fill(byId('auth-password'), 'hunter2');
  fill(byId('auth-confirm-password'), 'hunter2');
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
}

describe('registering', () => {
  it('shows the confirm-your-email screen when no session came back', async () => {
    signUpWithPassword.mockResolvedValue({ needsEmailConfirmation: true });
    render(<AuthForm />);

    register();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /confirm your email/i })).toBeTruthy()
    );
    expect(screen.getByText(/student@ubc\.ca/)).toBeTruthy();
    // One has already gone out, so the button offers another.
    expect(screen.getByRole('button', { name: /resend email/i })).toBeTruthy();
  });

  it('stays out of the way when confirmation is off and a session came back', async () => {
    signUpWithPassword.mockResolvedValue({ needsEmailConfirmation: false });
    render(<AuthForm />);

    register();

    // The gate above swaps the screen; this form must not claim an email went out.
    await waitFor(() => expect(signUpWithPassword).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: /confirm your email/i })).toBeNull();
  });
});

describe('signing in to an unconfirmed account', () => {
  it('offers a fresh link instead of a dead end', async () => {
    signInWithPassword.mockRejectedValue(new Error('Email not confirmed'));
    render(<AuthForm />);

    signIn();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /confirm your email/i })).toBeTruthy()
    );
    // Nothing has been sent on this path yet, so the button says so.
    fireEvent.click(screen.getByRole('button', { name: /send a new link/i }));

    await waitFor(() => expect(resendConfirmationEmail).toHaveBeenCalledWith('student@ubc.ca'));
    expect(screen.getByRole('button', { name: /email sent again/i })).toBeTruthy();
  });

  it('surfaces a resend refusal without losing the screen', async () => {
    signInWithPassword.mockRejectedValue(new Error('Email not confirmed'));
    resendConfirmationEmail.mockRejectedValue(
      new Error('For security purposes, you can only request this after 51 seconds.')
    );
    render(<AuthForm />);

    signIn();
    fireEvent.click(await screen.findByRole('button', { name: /send a new link/i }));

    // The cooldown is the resend button's own, so it belongs on this screen —
    // bouncing back to the form would lose the address it was typed against.
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/51 seconds/));
    expect(screen.getByRole('heading', { name: /confirm your email/i })).toBeTruthy();
  });

  it('leaves a wrong password on the form with an error', async () => {
    signInWithPassword.mockRejectedValue(new Error('Invalid login credentials'));
    render(<AuthForm />);

    signIn();

    // The distinction that matters: this must not imply the password was right.
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/don’t match an account/i)
    );
    expect(screen.queryByRole('heading', { name: /confirm your email/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /send a new link/i })).toBeNull();
  });
});
