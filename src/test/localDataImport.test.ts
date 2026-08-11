import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  RETIRED_STORAGE_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
  hasLocalData,
  retireLocalData,
} from '@/lib/courseStorage';
import { useLocalDataImport } from '@/hooks/useLocalDataImport';

/** A pre-accounts payload, exactly as an older build wrote it. */
const savedInBrowser = (courseName = 'CPSC 121') => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: SCHEMA_VERSION,
      courses: [
        { id: 'c1', name: courseName, semester: '2026 Winter Term 1', breakdowns: [] },
      ],
      semesters: ['2026 Winter Term 1'],
    })
  );
};

/** The hook as the signed-in app calls it: loaded, and the account is empty. */
const offerToEmptyAccount = () => renderHook(() => useLocalDataImport(true, true));

describe('retireLocalData', () => {
  beforeEach(() => localStorage.clear());

  it('takes the payload out of the offer path', () => {
    savedInBrowser();
    expect(hasLocalData()).toBe(true);

    retireLocalData();

    expect(hasLocalData()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('archives rather than deletes, so a wrong answer is recoverable', () => {
    savedInBrowser('MATH 200');
    const before = localStorage.getItem(STORAGE_KEY);

    retireLocalData();

    expect(localStorage.getItem(RETIRED_STORAGE_KEY)).toBe(before);
  });

  it('does nothing when there is nothing to retire', () => {
    retireLocalData();
    expect(localStorage.getItem(RETIRED_STORAGE_KEY)).toBeNull();
  });

  it('leaves an existing archive alone on a second call', () => {
    savedInBrowser('CPSC 210');
    retireLocalData();
    const archived = localStorage.getItem(RETIRED_STORAGE_KEY);

    retireLocalData();

    expect(localStorage.getItem(RETIRED_STORAGE_KEY)).toBe(archived);
  });
});

describe('useLocalDataImport', () => {
  beforeEach(() => localStorage.clear());

  it('offers what the browser saved before accounts existed', () => {
    savedInBrowser();
    const { result } = offerToEmptyAccount();
    expect(result.current.candidate?.courses).toHaveLength(1);
  });

  it('offers nothing to an account that already has courses', () => {
    savedInBrowser();
    const { result } = renderHook(() => useLocalDataImport(true, false));
    expect(result.current.candidate).toBeNull();
  });

  it('retires the payload for an account that has courses of its own', () => {
    savedInBrowser();

    // No dialog for this student — but the payload must not be left behind for
    // whoever signs in on this browser next.
    renderHook(() => useLocalDataImport(true, false));

    expect(hasLocalData()).toBe(false);
    const { result } = offerToEmptyAccount();
    expect(result.current.candidate).toBeNull();
  });

  it('leaves the payload alone until the account has finished loading', () => {
    savedInBrowser();
    renderHook(() => useLocalDataImport(false, false));
    expect(hasLocalData()).toBe(true);
  });

  it('waits for the account to finish loading', () => {
    savedInBrowser();
    const { result } = renderHook(() => useLocalDataImport(false, true));
    expect(result.current.candidate).toBeNull();
  });

  it('never asks again on this browser, whoever answered', () => {
    savedInBrowser();

    const first = offerToEmptyAccount();
    expect(first.result.current.candidate).not.toBeNull();
    act(() => first.result.current.dismiss());

    // A second empty account signing in on the same browser — the payload is
    // not theirs, and the question has already been answered.
    const second = offerToEmptyAccount();
    expect(second.result.current.candidate).toBeNull();
  });

  it('closes the offer without losing the payload', () => {
    savedInBrowser();
    const { result } = offerToEmptyAccount();

    act(() => result.current.dismiss());

    expect(result.current.candidate).toBeNull();
    expect(localStorage.getItem(RETIRED_STORAGE_KEY)).not.toBeNull();
  });
});
