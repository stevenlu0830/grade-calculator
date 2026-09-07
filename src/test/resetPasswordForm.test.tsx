import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

/**
 * Choosing a new password on the way back from a reset email.
 *
 * There is no email box and no current-password box here: the link that opened
 * this screen came with a session, and holding it is the proof. That makes the
 * expiry cases the interesting ones — a link that was already used reports
 * itself in the URL before anything is typed, and one that expires while the
 * form is open only shows up on submit. Both have to leave the form usable.
 */

const updatePassword = vi.fn<[string], Promise<void>>();

/** Read at module load by the form, so it is flipped before the dynamic import. */
let initialAuthLinkError: string | null = null;

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: null,
  startedInPasswordRecovery: true,
  get initialAuthLinkError() {
    return initialAuthLinkError;
  },
}));

vi.mock('@/lib/auth', async () => {
  // The validation is the real thing — it is half of what this form does.
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, updatePassword: (password: string) => updatePassword(password) };
});

const success = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => success(...args), error: vi.fn() },
}));

const { ResetPasswordForm } = await import('@/components/ResetPasswordForm');

const password = () => document.getElementById('reset-password') as HTMLInputElement;
const confirm = () => document.getElementById('reset-confirm-password') as HTMLInputElement;
const saveButton = () => screen.getByRole('button', { name: /save new password/i });
const fill = (first: string, second = first) => {
  fireEvent.change(password(), { target: { value: first } });
  fireEvent.change(confirm(), { target: { value: second } });
};

function renderForm() {
  const onDone = vi.fn();
  render(<ResetPasswordForm onDone={onDone} />);
  return { onDone };
}

beforeEach(() => {
  initialAuthLinkError = null;
  updatePassword.mockReset().mockResolvedValue(undefined);
  success.mockReset();
});

afterEach(cleanup);

describe('ResetPasswordForm', () => {
  it('asks for the new password twice and nothing else', () => {
    renderForm();

    expect(password()).toBeTruthy();
    expect(confirm()).toBeTruthy();
    expect(document.querySelector('input[type="email"]')).toBeNull();
  });

  it('saves the new password and leaves the reset screen', async () => {
    const { onDone } = renderForm();

    fill('hunter2!');
    fireEvent.click(saveButton());

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('hunter2!'));
    // The toast is the only acknowledgement — the app drops straight into the
    // student's courses behind it.
    expect(success).toHaveBeenCalledWith('Password updated');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('refuses a password that is too short, without a round trip', () => {
    renderForm();

    fill('abc');
    fireEvent.click(saveButton());

    expect(updatePassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/at least 6 characters/i);
  });

  it('refuses two that do not match', () => {
    renderForm();

    fill('hunter2!', 'hunter3!');
    fireEvent.click(saveButton());

    expect(updatePassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/don’t match/i);
  });

  it('says up front when the link itself was already dead', () => {
    // Reported by the URL the page opened on, so there is no point waiting for
    // a doomed submit to say it.
    initialAuthLinkError = 'That link is invalid or has expired. Request a new one.';

    renderForm();

    expect(screen.getByRole('alert').textContent).toMatch(/invalid or has expired/i);
  });

  it('rewrites an expired session into the thing to do about it', async () => {
    // Supabase says "Auth session missing!", which reads as a bug.
    updatePassword.mockRejectedValue(new Error('Auth session missing!'));
    const { onDone } = renderForm();

    fill('hunter2!');
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/reset link has expired/i)
    );
    expect(onDone).not.toHaveBeenCalled();
    // And the form is usable again, rather than stuck mid-save.
    expect(saveButton()).toBeEnabled();
  });

  it('goes quiet while the save is in flight', async () => {
    updatePassword.mockReturnValue(new Promise(() => {}));
    renderForm();

    fill('hunter2!');
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled());
    expect(password()).toBeDisabled();
    expect(confirm()).toBeDisabled();
  });

  it('lets the student back out without setting anything', () => {
    const { onDone } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(updatePassword).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
