import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import { PasswordInput, REVEAL_DURATION_MS } from '@/components/PasswordInput';

/**
 * The peek is the whole point of this component, and it is made of a timer, so
 * these drive the clock by hand rather than waiting on real time.
 */
function renderField(disabled = false) {
  return render(
    <PasswordInput
      id="test-password"
      autoComplete="new-password"
      value="hunter2"
      onChange={() => {}}
      disabled={disabled}
    />
  );
}

/** The field itself. `type` is what hides or shows the characters. */
const field = () => document.getElementById('test-password') as HTMLInputElement;
const peekButton = () => screen.getByRole('button', { name: /show password/i });

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('PasswordInput', () => {
  it('hides the password until asked', () => {
    renderField();
    expect(field().type).toBe('password');
  });

  it('shows it when the button is pressed', () => {
    renderField();
    act(() => peekButton().click());
    expect(field().type).toBe('text');
  });

  it('hides it again once the peek runs out', () => {
    renderField();
    act(() => peekButton().click());

    // A moment before the deadline it is still readable…
    act(() => void vi.advanceTimersByTime(REVEAL_DURATION_MS - 1));
    expect(field().type).toBe('text');

    // …and on the deadline it is not.
    act(() => void vi.advanceTimersByTime(1));
    expect(field().type).toBe('password');
  });

  it('restarts the clock on a second press rather than stacking timers', () => {
    renderField();
    act(() => peekButton().click());
    act(() => void vi.advanceTimersByTime(REVEAL_DURATION_MS - 100));

    // Pressing again with 100ms left has to buy a fresh half second. If the
    // first timer were left running it would cut this peek short right here.
    act(() => peekButton().click());
    act(() => void vi.advanceTimersByTime(100));
    expect(field().type).toBe('text');

    act(() => void vi.advanceTimersByTime(REVEAL_DURATION_MS - 100));
    expect(field().type).toBe('password');
  });

  it('does not submit the form it sits in', () => {
    // A bare <button> inside a form defaults to type="submit", which would fire
    // a sign-in attempt every time someone checked their typing.
    renderField();
    expect(peekButton().getAttribute('type')).toBe('button');
  });

  it('goes dead while the form is submitting', () => {
    renderField(true);
    expect(peekButton()).toBeDisabled();
    expect(field()).toBeDisabled();
  });

  it('drops its pending timer when it unmounts mid-peek', () => {
    const { unmount } = renderField();
    act(() => peekButton().click());

    unmount();
    // Firing the leftover timer would set state on a component that is gone,
    // which React reports as a warning rather than an exception — so the
    // assertion is that nothing was left scheduled to fire at all.
    expect(vi.getTimerCount()).toBe(0);
  });
});
