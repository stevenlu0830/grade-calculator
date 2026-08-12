import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff } from 'lucide-react';

/** How long a peek lasts before the field hides itself again. */
export const REVEAL_DURATION_MS = 500;

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /**
   * Tells a password manager whether to offer a saved password or a new one;
   * getting this wrong is the usual reason they misbehave.
   */
  autoComplete: 'current-password' | 'new-password';
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * A password field with a button that shows the characters for half a second.
 *
 * Momentary rather than a sticky toggle: it's enough to check a typo without
 * leaving the password sitting in plain text on a screen the student may have
 * already walked away from.
 *
 * Shared by all five password boxes — sign in, register and its confirmation,
 * and both halves of the reset form — so the peek behaves the same everywhere.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  disabled,
  autoFocus,
}: PasswordInputProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const timer = useRef<number | null>(null);

  // Submitting mid-peek unmounts this while the timer is still pending, and a
  // timer that outlives its component sets state on nothing.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const peek = () => {
    // Restarted, not stacked: pressing again should buy another full half
    // second rather than let the first timer end the second peek early.
    if (timer.current !== null) window.clearTimeout(timer.current);
    setIsRevealed(true);
    timer.current = window.setTimeout(() => {
      setIsRevealed(false);
      timer.current = null;
    }, REVEAL_DURATION_MS);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type={isRevealed ? 'text' : 'password'}
        // Room for the button, so a long password doesn't run underneath it.
        className="pr-10"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <button
        // Buttons inside a form submit it by default, which would try to sign in
        // every time someone checked their typing.
        type="button"
        onClick={peek}
        disabled={disabled}
        // Deliberately not `aria-pressed`: that describes a state you can leave,
        // and this one is gone in half a second whether you like it or not.
        aria-label={`Show password for ${REVEAL_DURATION_MS / 1000} seconds`}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
