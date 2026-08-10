import { describe, it, expect } from 'vitest';
import { MIN_PASSWORD_LENGTH, describeAuthError, validateCredentials } from '@/lib/auth';

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

  it('passes an unrecognised message through rather than hiding it', () => {
    expect(describeAuthError(new Error('Database is on fire'))).toBe('Database is on fire');
  });

  it('never returns an empty string', () => {
    expect(describeAuthError(null)).toBeTruthy();
    expect(describeAuthError(new Error(''))).toBeTruthy();
  });
});
