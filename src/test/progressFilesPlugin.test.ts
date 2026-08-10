import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isSafeProgressFileName,
  listProgressFiles,
  resolveProgressPath,
  writeProgressFiles,
} from '../../vite-plugin-progress-files';
import { buildProgressFiles, courseFileName, parseProgressFiles } from '@/lib/progressFile';
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

  const contents = async () => (await fs.readdir(dir)).sort();

  beforeEach(async () => {
    dir = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'progress-')), 'progresses');
  });

  afterEach(async () => {
    await fs.rm(path.dirname(dir), { recursive: true, force: true });
  });

  it('creates the folder and writes one file per course', async () => {
    const result = await writeProgressFiles(
      dir,
      buildProgressFiles([makeCourse('CPSC 330'), makeCourse('Databases in Data Science')])
    );

    expect(result.written).toEqual(['CPSC_330.json', 'Databases_in_Data_Science.json']);
    expect(await contents()).toEqual(['CPSC_330.json', 'Databases_in_Data_Science.json']);
  });

  // The reported bug: deleting every course and saving must empty the folder,
  // not leave the previous save sitting there to be reloaded.
  it('empties the folder when there are no courses', async () => {
    await writeProgressFiles(dir, buildProgressFiles([makeCourse('CPSC 330')]));

    const result = await writeProgressFiles(dir, buildProgressFiles([]));

    expect(result.written).toEqual([]);
    expect(result.removed).toEqual(['CPSC_330.json']);
    expect(await contents()).toEqual([]);
  });

  it('reloads nothing after an empty save', async () => {
    await writeProgressFiles(dir, buildProgressFiles([makeCourse('CPSC 330')]));
    await writeProgressFiles(dir, buildProgressFiles([]));

    const { courses } = parseProgressFiles(await listProgressFiles(dir));
    expect(courses).toEqual([]);
  });

  it('is a no-op on an already empty folder', async () => {
    await fs.mkdir(dir, { recursive: true });
    const result = await writeProgressFiles(dir, []);

    expect(result).toEqual({ written: [], removed: [] });
  });

  it('removes only the files whose course is gone', async () => {
    await writeProgressFiles(
      dir,
      buildProgressFiles([makeCourse('CPSC 330'), makeCourse('MATH 200')])
    );

    const result = await writeProgressFiles(dir, buildProgressFiles([makeCourse('MATH 200')]));

    expect(result.removed).toEqual(['CPSC_330.json']);
    expect(await contents()).toEqual(['MATH_200.json']);
  });

  it('never deletes non-JSON files, even when clearing', async () => {
    await writeProgressFiles(dir, buildProgressFiles([makeCourse('CPSC 330')]));
    await fs.writeFile(path.join(dir, 'notes.txt'), 'keep me', 'utf8');

    await writeProgressFiles(dir, buildProgressFiles([]));

    expect(await contents()).toEqual(['notes.txt']);
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
    const saved = [makeCourse('CPSC 330'), makeCourse('MATH 200')];
    await writeProgressFiles(dir, buildProgressFiles(saved));

    const { courses, skipped } = parseProgressFiles(await listProgressFiles(dir));
    expect(skipped).toEqual([]);
    expect(courses.map(c => c.name)).toEqual(['CPSC 330', 'MATH 200']);
  });

  it('lists nothing when the folder does not exist', async () => {
    expect(await listProgressFiles(path.join(dir, 'missing'))).toEqual([]);
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
