import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

/**
 * The forgot-password path, plus the validation and mode-switching around it.
 *
 * The registration and unconfirmed-account paths are covered in
 * `authForm.test.tsx`; this is the third one, and it has a rule of its own:
 * Supabase reports success whether or not the address has an account, so that
 * the form can't be used to find out who is registered. The screen afterwards
 * has to be worded to match, or it gives away exactly what the API refused to.
 */

const sendPasswordResetEmail = vi.fn<[string], Promise<void>>();
const signInWithPassword = vi.fn<[string, string], Promise<void>>();

/** Read at module load by the form, so it is set before the dynamic import. */
let initialAuthLinkError: string | null = null;

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: null,
  startedInPasswordRecovery: false,
  get initialAuthLinkError() {
    return initialAuthLinkError;
  },
}));

vi.mock('@/lib/auth', async () => {
  // The validation and the error rewriting are the real ones — half of what
  // this form does is decide which of them to show.
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    sendPasswordResetEmail: (email: string) => sendPasswordResetEmail(email),
    signInWithPassword: (email: string, password: string) => signInWithPassword(email, password),
    signUpWithPassword: vi.fn(),
    resendConfirmationEmail: vi.fn(),
  };
});

const { AuthForm } = await import('@/components/AuthForm');

const emailField = () => screen.getByPlaceholderText(/you@student/i);
const passwordField = () => document.getElementById('auth-password') as HTMLInputElement;
const fill = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });

const forgotPassword = () =>
  fireEvent.click(screen.getByRole('button', { name: /forgot password\?/i }));
const submitReset = () =>
  fireEvent.click(screen.getByRole('button', { name: /email me a reset link/i }));

beforeEach(() => {
  initialAuthLinkError = null;
  sendPasswordResetEmail.mockReset().mockResolvedValue(undefined);
  signInWithPassword.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('asking for a reset link', () => {
  it('drops the password box, since the address is all it needs', () => {
    render(<AuthForm />);

    forgotPassword();

    expect(passwordField()).toBeNull();
    expect(screen.getByText(/link that lets you choose a new one/i)).toBeTruthy();
  });

  it('sends the link and says so without confirming the address exists', async () => {
    render(<AuthForm />);
    forgotPassword();

    fill(emailField(), 'student@ubc.ca');
    submitReset();

    await waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledWith('student@ubc.ca'));
    // "If there's an account for that address" — deliberately non-committal.
    expect(screen.getByText(/If there’s an account for that address/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /check your inbox/i })).toBeTruthy();
  });

  it('offers no resend on this screen, which has nothing to resend', async () => {
    render(<AuthForm />);
    forgotPassword();
    fill(emailField(), 'student@ubc.ca');
    submitReset();

    await screen.findByRole('heading', { name: /check your inbox/i });

    expect(screen.queryByRole('button', { name: /resend/i })).toBeNull();
  });

  it('refuses a blank address before sending anything', () => {
    render(<AuthForm />);
    forgotPassword();

    submitReset();

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/enter your email/i);
  });

  it('reports a refusal in the terms the student can act on', async () => {
    // Supabase's own wording is "Email rate limit exceeded", which sounds like
    // the student did something.
    sendPasswordResetEmail.mockRejectedValue(new Error('Email rate limit exceeded'));
    render(<AuthForm />);
    forgotPassword();

    fill(emailField(), 'student@ubc.ca');
    submitReset();

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/as many emails as it’s allowed/i)
    );
    expect(screen.queryByRole('heading', { name: /check your inbox/i })).toBeNull();
  });

  it('goes quiet while the request is in flight', async () => {
    sendPasswordResetEmail.mockReturnValue(new Promise(() => {}));
    render(<AuthForm />);
    forgotPassword();

    fill(emailField(), 'student@ubc.ca');
    submitReset();

    await waitFor(() => expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled());
  });

  it('comes back to sign in, without the error it left behind', () => {
    // "That email already has an account" above the very form it told them to
    // use would be its own small insult.
    render(<AuthForm />);
    forgotPassword();
    submitReset();
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(passwordField()).toBeTruthy();
  });

  it('gets back to the form from the notice screen', async () => {
    render(<AuthForm />);
    forgotPassword();
    fill(emailField(), 'student@ubc.ca');
    submitReset();
    await screen.findByRole('heading', { name: /check your inbox/i });

    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(passwordField()).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /check your inbox/i })).toBeNull();
  });
});

describe('the form’s own validation', () => {
  it('refuses a short password without a round trip', () => {
    render(<AuthForm />);

    fill(emailField(), 'student@ubc.ca');
    fill(passwordField(), 'abc');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/at least 6 characters/i);
  });

  it('refuses a registration whose two passwords differ', () => {
    render(<AuthForm />);
    fireEvent.click(screen.getByRole('button', { name: /register/i }));

    fill(emailField(), 'student@ubc.ca');
    fill(passwordField(), 'hunter2');
    fill(document.getElementById('auth-confirm-password') as HTMLInputElement, 'hunter3');
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/don’t match/i);
  });

  it('reports nothing of its own on a successful sign-in', async () => {
    // There is no success screen here: the session changes and the gate above
    // swaps this form for the app. Anything shown would be shown for a frame.
    render(<AuthForm />);

    fill(emailField(), 'student@ubc.ca');
    fill(passwordField(), 'hunter2');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith('student@ubc.ca', 'hunter2')
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('heading', { name: /check your inbox/i })).toBeNull();
  });

  it('goes quiet while a sign-in is in flight', async () => {
    signInWithPassword.mockReturnValue(new Promise(() => {}));
    render(<AuthForm />);

    fill(emailField(), 'student@ubc.ca');
    fill(passwordField(), 'hunter2');
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled());
  });
});

describe('arriving on a dead link', () => {
  it('says so on the form, before anything is typed', () => {
    // The URL reported it; this form is where the student lands afterwards.
    initialAuthLinkError = 'That link is invalid or has expired. Request a new one.';

    render(<AuthForm />);

    expect(screen.getByRole('alert').textContent).toMatch(/invalid or has expired/i);
  });
});
