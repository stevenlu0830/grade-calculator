import { requireSupabase } from '@/lib/supabase';

/** Supabase's own minimum. Checked here so a typo doesn't cost a round trip. */
export const MIN_PASSWORD_LENGTH = 6;

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
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('networkerror')) {
    return 'Could not reach the server. Check your connection.';
  }
  return message || 'Something went wrong. Try again.';
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
  if (!email.trim()) return 'Enter your email address.';
  if (!password) return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return 'The two passwords don’t match.';
  }
  return null;
}

export async function signUpWithPassword(
  email: string,
  password: string
): Promise<SignUpResult> {
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) throw error;

  // With confirmation on, Supabase returns a user but no session. It returns the
  // same shape for an email that already exists, deliberately, so that this
  // screen can't be used to find out who has an account.
  return { needsEmailConfirmation: data.session === null };
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
