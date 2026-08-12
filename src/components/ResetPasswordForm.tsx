import { useState } from 'react';
import { toast } from 'sonner';
import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  updatePassword,
  validatePassword,
} from '@/lib/auth';
import { initialAuthLinkError } from '@/lib/supabase';
import { PasswordInput } from '@/components/PasswordInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ResetPasswordFormProps {
  /** Leaves the reset screen — saved, or given up on. */
  onDone: () => void;
}

/**
 * Chooses a new password, on the way back from a reset email.
 *
 * There is no email field and no current-password field: the link that opened
 * this screen came with a session, and holding that session is already the proof
 * that this person can read the address on the account.
 *
 * Nothing here is reachable by typing a URL. The gate in `App` only renders it
 * for a page load that arrived on a recovery link.
 */
export function ResetPasswordForm({ onDone }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // An expired or already-used link reports itself in the URL and produces no
  // session, so say that up front rather than after a doomed submit.
  const [error, setError] = useState<string | null>(initialAuthLinkError);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const invalid = validatePassword(password, confirmPassword);
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setIsPending(true);
    try {
      await updatePassword(password);
      // The recovery session is a real one, so there is nothing left to sign in
      // to — leaving recovery drops them straight into their courses. The toast
      // is the only acknowledgement they get, which is why it isn't skipped.
      toast.success('Password updated');
      onDone();
    } catch (caught) {
      setError(describeAuthError(caught));
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-password">New password</Label>
        <PasswordInput
          id="reset-password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={event => setPassword(event.target.value)}
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-confirm-password">Confirm new password</Label>
        <PasswordInput
          id="reset-confirm-password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={event => setConfirmPassword(event.target.value)}
          disabled={isPending}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isPending ? 'Saving…' : 'Save new password'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </button>
      </p>
    </form>
  );
}
