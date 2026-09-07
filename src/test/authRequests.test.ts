import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The calls in `auth.ts` that actually reach Supabase.
 *
 * Its pure half — validation, and the error rewriting in `describeAuthError` —
 * is asserted in `auth.test.ts`. These cover the three things the wrappers
 * decide for themselves: that an address is trimmed before it is sent, that
 * emailed links come back to the origin the app is running on, and that every
 * failure is thrown rather than returned, since a swallowed one would look
 * exactly like success on screen.
 */

const auth = {
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  initialAuthLinkError: null,
  startedInPasswordRecovery: false,
  isSupabaseConfigured: true,
  supabase: { auth },
  requireSupabase: () => ({ auth }),
  USER_DATA_TABLE: 'user_data',
  USER_PROGRESS_TABLE: 'user_progress',
}));

const {
  resendConfirmationEmail,
  sendPasswordResetEmail,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} = await import('@/lib/auth');

/** Where a link in an email has to come back to — the live page, not a build-time constant. */
const ORIGIN = window.location.origin;

const ok = { data: { session: null, user: null }, error: null };
const refused = { data: { session: null, user: null }, error: new Error('Rate limit exceeded') };

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset().mockResolvedValue(ok);
});

afterEach(() => vi.restoreAllMocks());

describe('signUpWithPassword', () => {
  it('trims the address and points the confirmation link back at this origin', async () => {
    // A preview deployment has its own hostname and is not the project's Site
    // URL, so the return address has to be read off the running page.
    await signUpWithPassword('  student@ubc.ca  ', 'hunter2');

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'student@ubc.ca',
      password: 'hunter2',
      options: { emailRedirectTo: ORIGIN },
    });
  });

  it('reports that confirmation is needed when no session came back', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });

    expect(await signUpWithPassword('student@ubc.ca', 'hunter2')).toEqual({
      needsEmailConfirmation: true,
    });
  });

  it('reports no confirmation needed when the project issued a session', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: { access_token: 'tok' }, user: { id: 'u1' } },
      error: null,
    });

    expect(await signUpWithPassword('student@ubc.ca', 'hunter2')).toEqual({
      needsEmailConfirmation: false,
    });
  });

  it('throws a refusal rather than reporting a registration that never happened', async () => {
    auth.signUp.mockResolvedValue(refused);

    await expect(signUpWithPassword('student@ubc.ca', 'hunter2')).rejects.toThrow(
      'Rate limit exceeded'
    );
  });
});

describe('resendConfirmationEmail', () => {
  it('asks for another signup link, back to this origin', async () => {
    await resendConfirmationEmail(' student@ubc.ca ');

    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'student@ubc.ca',
      options: { emailRedirectTo: ORIGIN },
    });
  });

  it('throws the per-address cooldown, which the form turns into a wait', async () => {
    auth.resend.mockResolvedValue({ error: new Error('after 51 seconds') });

    await expect(resendConfirmationEmail('student@ubc.ca')).rejects.toThrow('after 51 seconds');
  });
});

describe('sendPasswordResetEmail', () => {
  it('trims the address and returns the student to this origin', async () => {
    await sendPasswordResetEmail('  student@ubc.ca ');

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('student@ubc.ca', {
      redirectTo: ORIGIN,
    });
  });

  it('throws a refusal', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: new Error('Email rate limit exceeded') });

    await expect(sendPasswordResetEmail('student@ubc.ca')).rejects.toThrow(
      'Email rate limit exceeded'
    );
  });
});

describe('updatePassword', () => {
  it('sets the password on whoever the current session belongs to', async () => {
    // No email is sent: the recovery link's own session is the proof of identity.
    await updatePassword('new-password');

    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
  });

  it('throws when the recovery session has expired underneath the form', async () => {
    auth.updateUser.mockResolvedValue({ error: new Error('Auth session missing!') });

    await expect(updatePassword('new-password')).rejects.toThrow('Auth session missing!');
  });
});

describe('signInWithPassword', () => {
  it('trims the address, since a copied one often carries a space', async () => {
    await signInWithPassword(' student@ubc.ca ', 'hunter2');

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'student@ubc.ca',
      password: 'hunter2',
    });
  });

  it('does not trim the password, which may legitimately end in a space', async () => {
    await signInWithPassword('student@ubc.ca', ' hunter2 ');

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'student@ubc.ca',
      password: ' hunter2 ',
    });
  });

  it('throws a rejection rather than leaving the app on a blank screen', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') });

    await expect(signInWithPassword('student@ubc.ca', 'wrong')).rejects.toThrow(
      'Invalid login credentials'
    );
  });
});

describe('signOut', () => {
  it('clears the session', async () => {
    await signOut();

    expect(auth.signOut).toHaveBeenCalled();
  });

  it('throws a failure, so the menu can say the sign-out did not happen', async () => {
    auth.signOut.mockResolvedValue({ error: new Error('Failed to fetch') });

    await expect(signOut()).rejects.toThrow('Failed to fetch');
  });
});
