import { useState } from 'react';
import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  signInWithPassword,
  signUpWithPassword,
  validateCredentials,
} from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MailCheck } from 'lucide-react';

type Mode = 'signIn' | 'signUp';

/** Everything that differs between the two modes, so the markup stays single. */
const COPY = {
  signIn: {
    submit: 'Sign in',
    pending: 'Signing in…',
    switchPrompt: 'Need an account?',
    switchAction: 'Register',
  },
  signUp: {
    submit: 'Create account',
    pending: 'Creating account…',
    switchPrompt: 'Already have an account?',
    switchAction: 'Sign in',
  },
} as const;

/**
 * Email and password sign in, and registration.
 *
 * No success path of its own: signing in changes the Supabase session, and the
 * gate above swaps this screen for the app. The one thing it does report is a
 * registration that needs an emailed confirmation link, which produces no
 * session and would otherwise look like nothing happened.
 */
export function AuthForm() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const copy = COPY[mode];

  const switchMode = () => {
    setMode(current => (current === 'signIn' ? 'signUp' : 'signIn'));
    // Carrying an error across the switch would leave "that email already has an
    // account" sitting above the sign-in form it just told them to use.
    setError(null);
    setConfirmPassword('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const invalid = validateCredentials(
      email,
      password,
      mode === 'signUp' ? confirmPassword : undefined
    );
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setIsPending(true);
    try {
      if (mode === 'signUp') {
        const { needsEmailConfirmation } = await signUpWithPassword(email, password);
        if (needsEmailConfirmation) setConfirmationSentTo(email.trim());
      } else {
        await signInWithPassword(email, password);
      }
    } catch (caught) {
      setError(describeAuthError(caught));
    } finally {
      setIsPending(false);
    }
  };

  if (confirmationSentTo) {
    return (
      <div className="text-center animate-fade-in">
        <div className="mx-auto mb-4 w-fit rounded-2xl bg-muted p-4">
          <MailCheck className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">Confirm your email</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          We sent a link to <span className="font-medium text-foreground">{confirmationSentTo}</span>
          . Click it, then come back and sign in.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setConfirmationSentTo(null);
            setMode('signIn');
            setPassword('');
            setConfirmPassword('');
          }}
        >
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          // Tells a password manager whether to offer a saved password or a new
          // one; getting this wrong is the usual reason they misbehave.
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

      {mode === 'signUp' && (
        <div className="space-y-2">
          <Label htmlFor="auth-confirm-password">Confirm password</Label>
          <Input
            id="auth-confirm-password"
            type="password"
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
          onClick={switchMode}
          disabled={isPending}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {copy.switchAction}
        </button>
      </p>
    </form>
  );
}
