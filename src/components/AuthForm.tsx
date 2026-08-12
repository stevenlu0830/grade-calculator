import { useState } from 'react';
import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  resendConfirmationEmail,
  sendPasswordResetEmail,
  signInWithPassword,
  signUpWithPassword,
  validateCredentials,
  validateEmail,
} from '@/lib/auth';
import { initialAuthLinkError } from '@/lib/supabase';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MailCheck } from 'lucide-react';

type Mode = 'signIn' | 'signUp' | 'forgotPassword';

/** Everything that differs between the modes, so the markup stays single. */
const COPY = {
  signIn: {
    submit: 'Sign in',
    pending: 'Signing in…',
    switchPrompt: 'Need an account?',
    switchAction: 'Register',
    switchTo: 'signUp',
  },
  signUp: {
    submit: 'Create account',
    pending: 'Creating account…',
    switchPrompt: 'Already have an account?',
    switchAction: 'Sign in',
    switchTo: 'signIn',
  },
  forgotPassword: {
    submit: 'Email me a reset link',
    pending: 'Sending…',
    switchPrompt: 'Remembered it?',
    switchAction: 'Sign in',
    switchTo: 'signIn',
  },
} as const satisfies Record<Mode, { switchTo: Mode; [key: string]: string }>;

/** Which email went out, for the screen shown in place of the form afterwards. */
type Notice = { kind: 'confirmEmail' | 'resetEmail'; email: string };

/**
 * Email and password sign in, registration, and starting a password reset.
 *
 * Signing in has no success path of its own: it changes the Supabase session and
 * the gate above swaps this screen for the app. The two paths that *do* report
 * something are the ones that end in an email rather than a session, which would
 * otherwise look like nothing happened.
 */
export function AuthForm() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // A link that expired on the way back in reports itself in the URL, and this
  // form is where the student lands afterwards, so it starts as the error here.
  const [error, setError] = useState<string | null>(initialAuthLinkError);
  const [isPending, setIsPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [resent, setResent] = useState(false);

  const copy = COPY[mode];
  const wantsPassword = mode !== 'forgotPassword';

  const switchTo = (next: Mode) => {
    setMode(next);
    // Carrying an error across the switch would leave "that email already has an
    // account" sitting above the sign-in form it just told them to use.
    setError(null);
    setConfirmPassword('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const invalid = wantsPassword
      ? validateCredentials(email, password, mode === 'signUp' ? confirmPassword : undefined)
      : validateEmail(email);
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setIsPending(true);
    try {
      if (mode === 'signUp') {
        const { needsEmailConfirmation } = await signUpWithPassword(email, password);
        if (needsEmailConfirmation) setNotice({ kind: 'confirmEmail', email: email.trim() });
      } else if (mode === 'forgotPassword') {
        await sendPasswordResetEmail(email);
        setNotice({ kind: 'resetEmail', email: email.trim() });
      } else {
        await signInWithPassword(email, password);
      }
    } catch (caught) {
      setError(describeAuthError(caught));
    } finally {
      setIsPending(false);
    }
  };

  const handleResend = async () => {
    if (!notice) return;
    setError(null);
    setIsPending(true);
    try {
      await resendConfirmationEmail(notice.email);
      setResent(true);
    } catch (caught) {
      setError(describeAuthError(caught));
    } finally {
      setIsPending(false);
    }
  };

  const dismissNotice = () => {
    setNotice(null);
    setResent(false);
    setMode('signIn');
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  if (notice) {
    const isConfirmation = notice.kind === 'confirmEmail';
    return (
      <div className="text-center animate-fade-in">
        <div className="mx-auto mb-4 w-fit rounded-2xl bg-muted p-4">
          <MailCheck className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          {isConfirmation ? 'Confirm your email' : 'Check your inbox'}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          We sent a link to <span className="font-medium text-foreground">{notice.email}</span>.{' '}
          {isConfirmation
            ? 'Click it, then come back and sign in.'
            : // Worded to hold either way, because Supabase reports success for an
              // address with no account and this screen must not give that away.
              'If there’s an account for that address, the link in it will let you choose a new password.'}
        </p>

        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {isConfirmation && (
          <Button
            variant="outline"
            className="mb-2 w-full"
            onClick={handleResend}
            disabled={isPending || resent}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {resent ? 'Email sent again' : 'Resend email'}
          </Button>
        )}

        <Button variant="ghost" className="w-full" onClick={dismissNotice} disabled={isPending}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          placeholder="you@student.ubc.ca"
          value={email}
          onChange={event => setEmail(event.target.value)}
          disabled={isPending}
        />
        {mode === 'forgotPassword' && (
          <p className="text-xs text-muted-foreground">
            We’ll send a link that lets you choose a new one.
          </p>
        )}
      </div>

      {wantsPassword && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="auth-password">Password</Label>
            {mode === 'signIn' && (
              <button
                type="button"
                onClick={() => switchTo('forgotPassword')}
                disabled={isPending}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <PasswordInput
            id="auth-password"
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            value={password}
            onChange={event => setPassword(event.target.value)}
            disabled={isPending}
          />
          {mode === 'signUp' && (
            <p className="text-xs text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}
        </div>
      )}

      {mode === 'signUp' && (
        <div className="space-y-2">
          <Label htmlFor="auth-confirm-password">Confirm password</Label>
          <PasswordInput
            id="auth-confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            disabled={isPending}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isPending ? copy.pending : copy.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {copy.switchPrompt}{' '}
        <button
          type="button"
          onClick={() => switchTo(copy.switchTo)}
          disabled={isPending}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {copy.switchAction}
        </button>
      </p>
    </form>
  );
}
