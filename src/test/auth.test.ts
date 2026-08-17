import { describe, it, expect } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  isEmailNotConfirmedError,
  validateCredentials,
  validateEmail,
  validatePassword,
} from '@/lib/auth';

describe('validateEmail', () => {
  it('accepts an address', () => {
    expect(validateEmail('a@b.com')).toBeNull();
  });

  it('rejects one that is only whitespace', () => {
    expect(validateEmail('   ')).toMatch(/email/i);
  });
});

describe('validatePassword', () => {
  it('accepts one at the minimum length', () => {
    expect(validatePassword('x'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('rejects one below the server minimum before the round trip', () => {
    expect(validatePassword('x'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/i);
  });

  it('only compares the confirmation when one was given', () => {
    // The reset form repeats the password; the sign in form doesn't.
    expect(validatePassword('hunter2')).toBeNull();
    expect(validatePassword('hunter2', 'hunter3')).toMatch(/match/i);
    expect(validatePassword('hunter2', 'hunter2')).toBeNull();
  });
});

describe('validateCredentials', () => {
  it('accepts a valid sign in', () => {
    expect(validateCredentials('a@b.com', 'hunter2')).toBeNull();
  });

  it('requires an email that isn’t just whitespace', () => {
    expect(validateCredentials('   ', 'hunter2')).toMatch(/email/i);
  });

  it('requires a password', () => {
    expect(validateCredentials('a@b.com', '')).toMatch(/password/i);
  });

  it('rejects a password below the server minimum before the round trip', () => {
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateCredentials('a@b.com', short)).toMatch(/at least/i);
  });

  it('only compares the confirmation when one was given', () => {
    // Sign in passes no confirmation; sign up does.
    expect(validateCredentials('a@b.com', 'hunter2')).toBeNull();
    expect(validateCredentials('a@b.com', 'hunter2', 'hunter3')).toMatch(/match/i);
    expect(validateCredentials('a@b.com', 'hunter2', 'hunter2')).toBeNull();
  });
});

describe('isEmailNotConfirmedError', () => {
  it('matches the message Supabase ships', () => {
    expect(isEmailNotConfirmedError(new Error('Email not confirmed'))).toBe(true);
  });

  it('matches on the error code alone, in case the message is reworded', () => {
    expect(isEmailNotConfirmedError(Object.assign(new Error('nope'), {
      code: 'email_not_confirmed',
    }))).toBe(true);
  });

  it('leaves a wrong password on the sign in form', () => {
    // The distinction that matters: this one must NOT offer to resend a
    // confirmation, or the screen would claim the password was accepted.
    expect(isEmailNotConfirmedError(new Error('Invalid login credentials'))).toBe(false);
  });

  it('survives a non-Error rejection', () => {
    expect(isEmailNotConfirmedError(null)).toBe(false);
    expect(isEmailNotConfirmedError('Email not confirmed')).toBe(true);
  });
});

describe('describeAuthError', () => {
  it('rewrites the credentials error into something actionable', () => {
    expect(describeAuthError(new Error('Invalid login credentials'))).toMatch(
      /don’t match an account/
    );
  });

  it('points an unconfirmed account at the inbox', () => {
    expect(describeAuthError(new Error('Email not confirmed'))).toMatch(/confirm/i);
  });

  it('sends an already-registered email to the sign in form', () => {
    expect(describeAuthError(new Error('User already registered'))).toMatch(/signing in/i);
  });

  it('names the connection when the request never landed', () => {
    expect(describeAuthError(new TypeError('Failed to fetch'))).toMatch(/connection/i);
  });

  it('turns a lapsed recovery session into the thing to do about it', () => {
    // What `updateUser` says when the reset link expired under the open form.
    expect(describeAuthError(new Error('Auth session missing!'))).toMatch(/expired/i);
  });

  it('explains a rejected password reuse', () => {
    expect(
      describeAuthError(new Error('New password should be different from the old password.'))
    ).toMatch(/haven’t used/i);
  });

  it('reads the resend cooldown as the rate limit it is', () => {
    expect(
      describeAuthError(new Error('For security purposes, you can only request this after 51 seconds.'))
    ).toMatch(/wait a minute/i);
  });

  it('sends an invalid email link back for a fresh one', () => {
    expect(describeAuthError(new Error('Email link is invalid or has expired'))).toMatch(
      /request a new one/i
    );
  });

  it('passes an unrecognised message through rather than hiding it', () => {
    expect(describeAuthError(new Error('Database is on fire'))).toBe('Database is on fire');
  });

  it('never returns an empty string', () => {
    expect(describeAuthError(null)).toBeTruthy();
    expect(describeAuthError(new Error(''))).toBeTruthy();
  });
});
