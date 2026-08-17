import { requireSupabase } from '@/lib/supabase';

/** Supabase's own minimum. Checked here so a typo doesn't cost a round trip. */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Where Supabase should return the student after they click a link in an email.
 *
 * Read off the live page instead of an environment variable so that a Vercel
 * preview deployment sends people back to itself: every branch gets its own
 * hostname, and none of them is the project's configured Site URL. Left
 * `undefined` outside a browser, where Supabase then falls back to Site URL.
 *
 * This is not an open redirect. Supabase rejects any destination missing from
 * the Redirect URLs allow-list in the dashboard, so the origin has to have been
 * approved there before it will be honoured.
 */
function emailReturnUrl(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.location.origin;
}

export interface SignUpResult {
  /**
   * True when the project has email confirmation switched on, so no session was
   * issued and the student has to click a link before they can sign in.
   */
  needsEmailConfirmation: boolean;
}

/**
 * What to show the student for a failed sign in or sign up.
 *
 * Pure, so the mapping is testable. Supabase's own strings are accurate but
 * terse ("Invalid login credentials"), and a couple of them describe a project
 * setting rather than anything the student did wrong — those are worth
 * rewriting, since otherwise the advice on screen is unactionable.
 */
export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'That email and password don’t match an account.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Check your inbox and confirm your email address first.';
  }
  if (normalized.includes('user already registered')) {
    return 'That email already has an account. Try signing in instead.';
  }
  if (normalized.includes('password should be at least')) {
    return `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  // Both of these arrive on the reset screen. The first is what Supabase says
  // when the recovery link's session has expired underneath the form, which
  // reads as a bug unless it's rewritten into the thing to do about it.
  if (normalized.includes('auth session missing')) {
    return 'That reset link has expired. Request a new one and try again.';
  }
  if (normalized.includes('new password should be different')) {
    return 'Choose a password you haven’t used here before.';
  }
  if (normalized.includes('email link is invalid or has expired')) {
    return 'That link is invalid or has expired. Request a new one.';
  }
  // Three different refusals arrive as 429s, and they are minutes vs. an hour
  // apart in how long they last. Collapsing them into one "wait a minute" sent
  // people back to retry against a cap that hadn't moved, over and over.

  // The project's own outbound email quota — 2/hour on Supabase's built-in
  // mailer, counted across every address, so a handful of test registrations
  // exhausts it. Nothing the student did wrong, and nothing they can retry into.
  if (normalized.includes('email rate limit exceeded')) {
    return 'The app has sent as many emails as it’s allowed to this hour. Try again later.';
  }
  // The per-address cooldown between one email and the next, which does name a
  // real number of seconds — worth repeating rather than rounding to "a minute".
  const cooldown = normalized.match(/after (\d+) seconds?/);
  if (cooldown) {
    return `Wait ${cooldown[1]} seconds and try again.`;
  }
  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('for security purposes')
  ) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('networkerror')) {
    return 'Could not reach the server. Check your connection.';
  }
  return message || 'Something went wrong. Try again.';
}

/**
 * Whether a failed sign in was refused *only* because the address was never
 * confirmed — the account exists and the password was right.
 *
 * Separate from `describeAuthError` because this one changes what the screen
 * offers, not just what it says. Someone who registered last week and lost the
 * email has the right password and no way to use it; without this they read
 * "confirm your email address first" on a form that can't send them another one.
 *
 * Matches Supabase's own `email_not_confirmed` code and the message it ships
 * with, since the two have not always travelled together across versions.
 */
export function isEmailNotConfirmedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const code = (error as { code?: unknown } | null)?.code;
  return (
    code === 'email_not_confirmed' || message.toLowerCase().includes('email not confirmed')
  );
}

/**
 * The email half on its own, for the forgot-password form, which asks for
 * nothing else. Format is left to the `type="email"` input, which the browser
 * checks before it will submit.
 */
export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email address.';
  return null;
}

/**
 * The password half on its own, for the reset form, which has no email field —
 * the recovery link already established who is asking.
 *
 * `confirmPassword` is only compared when one is given, so this covers the sign
 * in form, which has a single password box, as well as the two that repeat it.
 */
export function validatePassword(password: string, confirmPassword?: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return 'The two passwords don’t match.';
  }
  return null;
}

/**
 * Validates a sign-up before it leaves the browser; `null` when it's fine.
 *
 * Pure. The server enforces all of this too — this exists so the student is told
 * about a short password immediately rather than after a round trip.
 */
export function validateCredentials(
  email: string,
  password: string,
  confirmPassword?: string
): string | null {
  return validateEmail(email) ?? validatePassword(password, confirmPassword);
}

export async function signUpWithPassword(
  email: string,
  password: string
): Promise<SignUpResult> {
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: emailReturnUrl() },
  });
  if (error) throw error;

  // With confirmation on, Supabase returns a user but no session. It returns the
  // same shape for an email that already exists, deliberately, so that this
  // screen can't be used to find out who has an account.
  return { needsEmailConfirmation: data.session === null };
}

/**
 * Sends the confirmation email again, for the one that went to spam or never
 * arrived. Supabase rate limits this per address; `describeAuthError` turns that
 * refusal into the wait-and-retry message.
 */
export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: emailReturnUrl() },
  });
  if (error) throw error;
}

/**
 * Starts a password reset. Succeeds whether or not the address has an account —
 * Supabase deliberately doesn't say which, so the form can't be used to test
 * who is registered, and the screen afterwards has to be worded to match.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: emailReturnUrl(),
  });
  if (error) throw error;
}

/**
 * Sets a new password for whoever the current session belongs to.
 *
 * The reset screen calls this holding the short-lived session the recovery link
 * itself created, which is what proves the person at the keyboard can read that
 * address. If the link has since expired, Supabase rejects it for want of a
 * session rather than changing the wrong account's password.
 */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}
