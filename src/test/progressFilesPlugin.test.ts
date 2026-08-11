import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isSafeOwnerId,
  isSafeProgressFileName,
  listProgressFiles,
  resolveOwnerDirectory,
  resolveProgressPath,
  writeProgressFiles,
} from '../../vite-plugin-progress-files';
import {
  PROGRESS_MANIFEST_FILE,
  buildProgressFiles,
  courseFileName,
  parseProgressFiles,
} from '@/lib/progressFile';
import { Course } from '@/types/grades';

/**
 * The dev server writes files whose names came from the browser, so these
 * checks are the boundary that stops a page reaching outside `progresses/`.
 */

const DIR = '/tmp/project/progresses';

describe('isSafeProgressFileName', () => {
  it('accepts the names the app generates', () => {
    expect(isSafeProgressFileName('CPSC_330.json')).toBe(true);
    expect(isSafeProgressFileName('Databases_in_Data_Science.json')).toBe(true);
    expect(isSafeProgressFileName('Untitled_Course.json')).toBe(true);
  });

  it('accepts non-ASCII course names', () => {
    // Course titles aren't always English; the check targets separators, not an
    // allow-list of characters.
    expect(isSafeProgressFileName('Café_Culture.json')).toBe(true);
    expect(isSafeProgressFileName('日本語.json')).toBe(true);
  });

  it('rejects anything that is not JSON', () => {
    expect(isSafeProgressFileName('notes.txt')).toBe(false);
    expect(isSafeProgressFileName('CPSC_330')).toBe(false);
  });

  it('rejects path separators', () => {
    expect(isSafeProgressFileName('sub/dir.json')).toBe(false);
    expect(isSafeProgressFileName('sub\\dir.json')).toBe(false);
  });

  it('rejects traversal attempts', () => {
    expect(isSafeProgressFileName('../secrets.json')).toBe(false);
    expect(isSafeProgressFileName('../../.bashrc.json')).toBe(false);
    expect(isSafeProgressFileName('..')).toBe(false);
  });

  it('rejects dotfiles and null bytes', () => {
    expect(isSafeProgressFileName('.env.json')).toBe(false);
    expect(isSafeProgressFileName('bad\0.json')).toBe(false);
  });
});

describe('resolveProgressPath', () => {
  it('resolves a safe name inside the folder', () => {
    expect(resolveProgressPath(DIR, 'CPSC_330.json')).toBe(path.join(DIR, 'CPSC_330.json'));
  });

  it('refuses to resolve anything outside the folder', () => {
    expect(resolveProgressPath(DIR, '../escape.json')).toBeNull();
    expect(resolveProgressPath(DIR, '/etc/passwd.json')).toBeNull();
    expect(resolveProgressPath(DIR, 'nested/file.json')).toBeNull();
  });

  it('refuses non-JSON even inside the folder', () => {
    expect(resolveProgressPath(DIR, 'notes.txt')).toBeNull();
  });
});

describe('writeProgressFiles against a real folder', () => {
  let dir: string;

  const makeCourse = (name: string): Course => ({
    id: `id-${name}`,
    name,
    semester: '2026 Winter Term 1',
    breakdowns: [],
  });

  /** Everything saved: the manifest is always one of the files. */
  const saved = (courses: Course[]) => buildProgressFiles({ courses, semesters: [] });

  const contents = async () => (await fs.readdir(dir)).sort();

  beforeEach(async () => {
    dir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'progress-')), 'progresses');
  });

  afterEach(async () => {
    await fs.rm(path.dirname(dir), { recursive: true, force: true });
  });

  it('creates the folder and writes one file per course, plus the manifest', async () => {
    const result = await writeProgressFiles(
      dir,
      saved([makeCourse('CPSC 330'), makeCourse('Databases in Data Science')])
    );

    expect(result.written).toEqual([
      PROGRESS_MANIFEST_FILE,
      'CPSC_330.json',
      'Databases_in_Data_Science.json',
    ]);
    expect(await contents()).toEqual([
      'CPSC_330.json',
      'Databases_in_Data_Science.json',
      PROGRESS_MANIFEST_FILE,
    ]);
  });

  // The reported bug: deleting every course and saving must empty the folder,
  // not leave the previous save sitting there to be reloaded.
  it('empties the folder when there are no courses, bar the manifest', async () => {
    await writeProgressFiles(dir, saved([makeCourse('CPSC 330')]));

    const result = await writeProgressFiles(dir, saved([]));

    // The manifest stays behind on purpose: it's what remembers the semesters
    // when every course in them is gone.
    expect(result.written).toEqual([PROGRESS_MANIFEST_FILE]);
    expect(result.removed).toEqual(['CPSC_330.json']);
    expect(await contents()).toEqual([PROGRESS_MANIFEST_FILE]);
  });

  it('reloads nothing after an empty save', async () => {
    await writeProgressFiles(dir, saved([makeCourse('CPSC 330')]));
    await writeProgressFiles(dir, saved([]));

    const { courses } = parseProgressFiles(await listProgressFiles(dir));
    expect(courses).toEqual([]);
  });

  it('is a no-op on an already empty folder', async () => {
    await fs.mkdir(dir, { recursive: true });
    const result = await writeProgressFiles(dir, []);

    expect(result).toEqual({ written: [], removed: [] });
  });

  it('removes only the files whose course is gone', async () => {
    await writeProgressFiles(dir, saved([makeCourse('CPSC 330'), makeCourse('MATH 200')]));

    const result = await writeProgressFiles(dir, saved([makeCourse('MATH 200')]));

    expect(result.removed).toEqual(['CPSC_330.json']);
    expect(await contents()).toEqual(['MATH_200.json', PROGRESS_MANIFEST_FILE]);
  });

  it('never deletes non-JSON files, even when clearing', async () => {
    await writeProgressFiles(dir, saved([makeCourse('CPSC 330')]));
    await fs.writeFile(path.join(dir, 'notes.txt'), 'keep me', 'utf8');

    await writeProgressFiles(dir, saved([]));

    expect(await contents()).toEqual([PROGRESS_MANIFEST_FILE, 'notes.txt']);
  });

  it('refuses to write outside the folder', async () => {
    const result = await writeProgressFiles(dir, [
      { name: '../escaped.json', contents: 'nope' },
      { name: 'CPSC_330.json', contents: '{"version":3,"courses":[]}' },
    ]);

    expect(result.written).toEqual(['CPSC_330.json']);
    await expect(fs.access(path.join(path.dirname(dir), 'escaped.json'))).rejects.toThrow();
  });

  it('round-trips through listProgressFiles', async () => {
    // Written in an order the filenames don't sort in, to prove the manifest —
    // not the directory listing — decides how they come back.
    await writeProgressFiles(dir, saved([makeCourse('MATH 200'), makeCourse('CPSC 330')]));

    const { courses, skipped } = parseProgressFiles(await listProgressFiles(dir));
    expect(skipped).toEqual([]);
    expect(courses.map(c => c.name)).toEqual(['MATH 200', 'CPSC 330']);
  });

  it('lists nothing when the folder does not exist', async () => {
    expect(await listProgressFiles(path.join(dir, 'missing'))).toEqual([]);
  });
});

describe('isSafeOwnerId', () => {
  it('accepts a Supabase user id', () => {
    expect(isSafeOwnerId('8f14e45f-ceea-467a-9575-3f0f4b0a2c11')).toBe(true);
  });

  it('rejects an empty id, so a missing header can never name a folder', () => {
    expect(isSafeOwnerId('')).toBe(false);
  });

  it('rejects traversal and separators', () => {
    expect(isSafeOwnerId('..')).toBe(false);
    expect(isSafeOwnerId('../../etc')).toBe(false);
    expect(isSafeOwnerId('a/b')).toBe(false);
    expect(isSafeOwnerId('a\\b')).toBe(false);
    expect(isSafeOwnerId('a.b')).toBe(false);
    expect(isSafeOwnerId('bad\0id')).toBe(false);
  });

  it('rejects an id too long to be a real one', () => {
    expect(isSafeOwnerId('a'.repeat(65))).toBe(false);
  });
});

describe('resolveOwnerDirectory', () => {
  it('gives each account its own folder under the base', () => {
    expect(resolveOwnerDirectory(DIR, 'user-1')).toBe(path.join(DIR, 'user-1'));
    expect(resolveOwnerDirectory(DIR, 'user-2')).toBe(path.join(DIR, 'user-2'));
  });

  it('refuses to resolve anything outside the base', () => {
    expect(resolveOwnerDirectory(DIR, '..')).toBeNull();
    expect(resolveOwnerDirectory(DIR, '../../tmp')).toBeNull();
    expect(resolveOwnerDirectory(DIR, '')).toBeNull();
  });
});

/**
 * The guarantee the whole per-owner folder scheme exists for.
 *
 * Saving is a mirror — it deletes files whose course is gone — so these run
 * against a real folder rather than a mock: the failure being guarded against
 * is one save deleting another account's files off the disk.
 */
describe('two accounts on one dev server', () => {
  let base: string;

  const makeCourse = (name: string): Course => ({
    id: `id-${name}`,
    name,
    semester: '2026 Winter Term 1',
    breakdowns: [],
  });

  const saveAs = (owner: string, courses: Course[]) => {
    const dir = resolveOwnerDirectory(base, owner);
    if (dir === null) throw new Error(`unsafe owner in test: ${owner}`);
    return writeProgressFiles(dir, buildProgressFiles({ courses, semesters: [] }));
  };

  const reloadAs = async (owner: string) => {
    const dir = resolveOwnerDirectory(base, owner);
    if (dir === null) throw new Error(`unsafe owner in test: ${owner}`);
    return parseProgressFiles(await listProgressFiles(dir));
  };

  beforeEach(async () => {
    base = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'progress-')), 'progresses');
  });

  afterEach(async () => {
    await fs.rm(path.dirname(base), { recursive: true, force: true });
  });

  it('each reloads their own courses', async () => {
    await saveAs('user-1', [makeCourse('CPSC 330')]);
    await saveAs('user-2', [makeCourse('BIOL 200')]);

    expect((await reloadAs('user-1')).courses.map(c => c.name)).toEqual(['CPSC 330']);
    expect((await reloadAs('user-2')).courses.map(c => c.name)).toEqual(['BIOL 200']);
  });

  it('one account saving does not delete the other account’s files', async () => {
    await saveAs('user-1', [makeCourse('CPSC 330'), makeCourse('MATH 200')]);

    // Saving prunes files for courses that no longer exist. Under one shared
    // folder this call is what wiped user 1's save.
    const result = await saveAs('user-2', [makeCourse('BIOL 200')]);

    expect(result.removed).toEqual([]);
    expect((await reloadAs('user-1')).courses).toHaveLength(2);
  });

  it('clearing every course empties only that account’s folder', async () => {
    await saveAs('user-1', [makeCourse('CPSC 330')]);
    await saveAs('user-2', [makeCourse('BIOL 200')]);

    await saveAs('user-2', []);

    expect((await reloadAs('user-2')).courses).toEqual([]);
    expect((await reloadAs('user-1')).courses.map(c => c.name)).toEqual(['CPSC 330']);
  });

  it('a new account reloads nothing rather than someone else’s courses', async () => {
    await saveAs('user-1', [makeCourse('CPSC 330')]);

    // user-3 has never saved, so their folder does not exist yet.
    expect((await reloadAs('user-3')).courses).toEqual([]);
  });
});

describe('generated names are always writable', () => {
  it.each([
    'CPSC 330',
    'Databases in Data Science',
    'CPSC 330: Applied ML',
    'Stats / Probability',
    '../../etc/passwd',
    '..',
    '',
    'Café Culture',
  ])('accepts the file produced for %o', courseName => {
    // Whatever the student types, the name the app derives must pass the
    // server's own safety check — otherwise the save would silently drop it.
    expect(isSafeProgressFileName(courseFileName(courseName))).toBe(true);
  });
});
