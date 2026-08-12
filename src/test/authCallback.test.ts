import { describe, it, expect } from 'vitest';
import { describeHashError, isRecoveryHash } from '@/lib/authCallback';

/**
 * The fragments here are the real shapes Supabase redirects with. Getting the
 * first one wrong is the difference between a reset form and a student being
 * dropped into their courses with the old password still on the account.
 */
const WORKING_RECOVERY_LINK =
  '#access_token=eyJhbGc.fake.token&expires_in=3600&refresh_token=abc123' +
  '&token_type=bearer&type=recovery';

const CONFIRMED_SIGNUP_LINK =
  '#access_token=eyJhbGc.fake.token&expires_in=3600&refresh_token=abc123' +
  '&token_type=bearer&type=signup';

const EXPIRED_LINK =
  '#error=access_denied&error_code=otp_expired' +
  '&error_description=Email+link+is+invalid+or+has+expired';

describe('isRecoveryHash', () => {
  it('recognises the fragment a password-reset link comes back on', () => {
    expect(isRecoveryHash(WORKING_RECOVERY_LINK)).toBe(true);
  });

  it('leaves a confirmed sign-up alone, which carries a session too', () => {
    expect(isRecoveryHash(CONFIRMED_SIGNUP_LINK)).toBe(false);
  });

  it('is false for an ordinary page load', () => {
    expect(isRecoveryHash('')).toBe(false);
    expect(isRecoveryHash('#')).toBe(false);
  });

  it('does not match a token that merely contains the word', () => {
    // `type` has to be the parameter, not a substring of someone else's value.
    expect(isRecoveryHash('#access_token=type-recovery-xyz')).toBe(false);
    expect(isRecoveryHash('#other_type=recovery')).toBe(false);
  });

  it('reads the fragment with or without its leading hash', () => {
    expect(isRecoveryHash('type=recovery')).toBe(true);
  });
});

describe('describeHashError', () => {
  it('is null when the link worked', () => {
    expect(describeHashError(WORKING_RECOVERY_LINK)).toBeNull();
    expect(describeHashError('')).toBeNull();
  });

  it('passes Supabase’s own wording through, spaces decoded', () => {
    expect(describeHashError(EXPIRED_LINK)).toBe('Email link is invalid or has expired');
  });

  it('still says something when the error arrives with no description', () => {
    expect(describeHashError('#error=access_denied')).toBeTruthy();
    expect(describeHashError('#error_code=otp_expired')).toBeTruthy();
  });
});
