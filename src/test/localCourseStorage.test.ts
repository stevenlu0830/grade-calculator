import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EMPTY_GRADE_DATA,
  RETIRED_STORAGE_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
  hasLocalData,
  localCourseStorage,
  readLocalData,
  retireLocalData,
} from '@/lib/courseStorage';
import { GradeData } from '@/types/grades';

/**
 * The browser-backed half of storage, which is now only the pre-accounts
 * migration path.
 *
 * Its defining choice is the opposite of the Supabase backend's: failures here
 * are logged, not thrown. Private browsing and a full quota are ordinary
 * conditions in a browser, and losing persistence should not take the app down
 * with it — this is the one place where reading nothing back is an acceptable
 * answer, because there was never an account behind it to overwrite.
 */

const sample: GradeData = {
  courses: [{ id: 'c1', name: 'CPSC 121', semester: '2026 Winter Term 1', breakdowns: [] }],
  semesters: ['2026 Winter Term 1'],
};

/** Logged failures are the expected outcome in half of these; keep them quiet. */
let logged: unknown[][];

beforeEach(() => {
  localStorage.clear();
  logged = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => void logged.push(args));
});

afterEach(() => vi.restoreAllMocks());

describe('localCourseStorage', () => {
  it('round-trips through the browser', async () => {
    await localCourseStorage.save(sample);

    expect(await localCourseStorage.load()).toEqual(sample);
  });

  it('writes the same versioned envelope the other backends hold', async () => {
    await localCourseStorage.save(sample);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      version: SCHEMA_VERSION,
      ...sample,
    });
  });

  it('reads an untouched browser as empty', async () => {
    expect(await localCourseStorage.load()).toEqual(EMPTY_GRADE_DATA);
  });

  it('logs a failed write instead of throwing it at the app', async () => {
    // Private mode and a full quota both land here, and neither is worth
    // stopping the calculator over.
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    await expect(localCourseStorage.save(sample)).resolves.toBeUndefined();
    expect(logged.at(-1)?.[0]).toMatch(/Failed to save/);
  });
});

describe('readLocalData', () => {
  it('answers synchronously, without touching the network', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, ...sample }));

    expect(readLocalData()).toEqual(sample);
  });

  it('degrades to empty on unreadable JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{ not json');

    expect(readLocalData()).toEqual(EMPTY_GRADE_DATA);
    expect(logged.at(-1)?.[0]).toMatch(/Failed to load/);
  });

  it('degrades to empty when the browser refuses to be read at all', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(readLocalData()).toEqual(EMPTY_GRADE_DATA);
  });
});

describe('hasLocalData', () => {
  it('is false for an untouched browser', () => {
    expect(hasLocalData()).toBe(false);
  });

  it('is true for saved courses', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, ...sample }));

    expect(hasLocalData()).toBe(true);
  });

  it('is true for semesters alone, which are worth importing on their own', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, courses: [], semesters: ['2026 Winter Term 1'] })
    );

    expect(hasLocalData()).toBe(true);
  });
});

describe('retireLocalData', () => {
  it('keeps a recoverable copy under the retired key', () => {
    const payload = JSON.stringify({ version: SCHEMA_VERSION, ...sample });
    localStorage.setItem(STORAGE_KEY, payload);

    retireLocalData();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(RETIRED_STORAGE_KEY)).toBe(payload);
  });

  it('does nothing when there was nothing to retire', () => {
    retireLocalData();

    expect(localStorage.getItem(RETIRED_STORAGE_KEY)).toBeNull();
  });

  it('still removes the payload when the backup copy will not fit', () => {
    // The copy is a courtesy; being asked the same import question forever is
    // not, so the removal has to happen either way.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, ...sample }));
    const realSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === RETIRED_STORAGE_KEY) throw new Error('QuotaExceededError');
      realSetItem(key, value);
    });

    retireLocalData();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('logs rather than throwing when the browser refuses outright', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => retireLocalData()).not.toThrow();
    expect(logged.at(-1)?.[0]).toMatch(/Failed to retire/);
  });
});
