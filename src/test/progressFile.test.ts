import { describe, it, expect } from 'vitest';
import { Course } from '@/types/grades';
import { SCHEMA_VERSION } from '@/lib/courseStorage';
import {
  buildProgressFiles,
  buildProgressJson,
  courseFileName,
  parseProgressFiles,
  parseProgressJson,
} from '@/lib/progressFile';
import { calculateBreakdownGrade } from '@/lib/gradeCalculations';

const makeCourse = (name: string): Course => ({
  id: `id-${name}`,
  name,
  breakdowns: [
    {
      id: `b-${name}`,
      courseId: `id-${name}`,
      name: 'Assignments',
      weight: 100,
      dropLowestCount: 1,
      downweightLowestCount: null,
      downweightPercent: null,
      fullCreditGrade: 80,
      subBreakdownLabel: 'Assignment',
      subBreakdowns: [
        { id: 's1', breakdownId: `b-${name}`, name: 'Assignment 1', achievedMarks: 4, fullMarks: 10 },
        { id: 's2', breakdownId: `b-${name}`, name: 'Assignment 2', achievedMarks: 18, fullMarks: 20 },
        { id: 's3', breakdownId: `b-${name}`, name: 'Assignment 3', achievedMarks: null, fullMarks: null },
      ],
    },
  ],
});

describe('courseFileName', () => {
  it('turns spaces into underscores, as the spec requires', () => {
    expect(courseFileName('CPSC 330')).toBe('CPSC_330.json');
    expect(courseFileName('Databases in Data Science')).toBe('Databases_in_Data_Science.json');
  });

  it('collapses runs of whitespace', () => {
    expect(courseFileName('  CPSC   330  ')).toBe('CPSC_330.json');
  });

  it('strips characters filesystems reject', () => {
    expect(courseFileName('CPSC 330: Applied ML')).toBe('CPSC_330_Applied_ML.json');
    expect(courseFileName('Stats / Probability')).toBe('Stats_Probability.json');
  });

  it('cannot produce a path that escapes the folder', () => {
    expect(courseFileName('../../etc/passwd')).toBe('etcpasswd.json');
  });

  it('never produces a hidden file, which the server would refuse to write', () => {
    expect(courseFileName('..')).toBe('Untitled_Course.json');
    expect(courseFileName('.env')).toBe('env.json');
    expect(courseFileName('...')).toBe('Untitled_Course.json');
  });

  it('falls back to a placeholder for an unnamed course', () => {
    expect(courseFileName('')).toBe('Untitled_Course.json');
    expect(courseFileName('   ')).toBe('Untitled_Course.json');
  });

  it('deduplicates repeated names', () => {
    const taken = new Set<string>();
    expect(courseFileName('CPSC 330', taken)).toBe('CPSC_330.json');
    expect(courseFileName('CPSC 330', taken)).toBe('CPSC_330_2.json');
    expect(courseFileName('CPSC 330', taken)).toBe('CPSC_330_3.json');
  });

  it('deduplicates case-insensitively, since macOS and Windows do', () => {
    const taken = new Set<string>();
    expect(courseFileName('CPSC 330', taken)).toBe('CPSC_330.json');
    // Would otherwise silently overwrite the first file on a case-insensitive disk.
    expect(courseFileName('cpsc 330', taken)).toBe('cpsc_330_2.json');
  });
});

describe('buildProgressFiles', () => {
  it('produces one file per course, named after the course', () => {
    const files = buildProgressFiles([
      makeCourse('CPSC 330'),
      makeCourse('Databases in Data Science'),
    ]);

    expect(files.map(f => f.name)).toEqual([
      'CPSC_330.json',
      'Databases_in_Data_Science.json',
    ]);
  });

  it('puts exactly one course in each file, in the storage envelope', () => {
    const [file] = buildProgressFiles([makeCourse('CPSC 330')]);
    const parsed = JSON.parse(file.contents);

    expect(parsed.version).toBe(SCHEMA_VERSION);
    expect(parsed.courses).toHaveLength(1);
    expect(parsed.courses[0].name).toBe('CPSC 330');
  });

  it('deduplicates filenames across courses with the same name', () => {
    const files = buildProgressFiles([makeCourse('CPSC 330'), makeCourse('CPSC 330')]);
    expect(files.map(f => f.name)).toEqual(['CPSC_330.json', 'CPSC_330_2.json']);
  });

  it('produces nothing for no courses', () => {
    expect(buildProgressFiles([])).toEqual([]);
  });
});

describe('save then reload, end to end', () => {
  it('restores exactly the courses that were saved', () => {
    const saved = [
      makeCourse('CPSC 330'),
      makeCourse('Databases in Data Science'),
      makeCourse('MATH 200'),
    ];

    const { courses, skipped } = parseProgressFiles(buildProgressFiles(saved));

    expect(skipped).toEqual([]);
    expect(courses).toEqual(saved);
  });

  it('reloads in filename order, so the course list is stable', () => {
    const files = buildProgressFiles([
      makeCourse('Zoology'),
      makeCourse('Anthropology'),
      makeCourse('MATH 200'),
    ]);

    const { courses } = parseProgressFiles(files);
    expect(courses.map(c => c.name)).toEqual(['Anthropology', 'MATH 200', 'Zoology']);
  });

  it('round-trips grades, so a reloaded course calculates the same', () => {
    const original = makeCourse('CPSC 330');
    const { courses } = parseProgressFiles(buildProgressFiles([original]));

    expect(calculateBreakdownGrade(courses[0].breakdowns[0])).toBe(
      calculateBreakdownGrade(original.breakdowns[0])
    );
  });

  it('preserves unentered marks as null rather than zero', () => {
    const { courses } = parseProgressFiles(buildProgressFiles([makeCourse('CPSC 330')]));
    expect(courses[0].breakdowns[0].subBreakdowns[2]).toMatchObject({
      achievedMarks: null,
      fullMarks: null,
    });
  });

  it('preserves grading policies, including full credit', () => {
    const { courses } = parseProgressFiles(buildProgressFiles([makeCourse('CPSC 330')]));
    expect(courses[0].breakdowns[0]).toMatchObject({ dropLowestCount: 1, fullCreditGrade: 80 });
  });
});

describe('parseProgressFiles', () => {
  it('skips a bad file without losing the good ones', () => {
    const files = [
      ...buildProgressFiles([makeCourse('CPSC 330')]),
      { name: 'broken.json', contents: '{ not json' },
    ];

    const { courses, skipped } = parseProgressFiles(files);
    expect(courses.map(c => c.name)).toEqual(['CPSC 330']);
    expect(skipped).toEqual(['broken.json']);
  });

  it('returns nothing for no files', () => {
    expect(parseProgressFiles([])).toEqual({ courses: [], skipped: [] });
  });
});

describe('buildProgressJson', () => {
  it('writes the same envelope localStorage uses', () => {
    const parsed = JSON.parse(buildProgressJson([makeCourse('CPSC 330')]));
    expect(parsed.version).toBe(SCHEMA_VERSION);
  });

  it('is pretty-printed, so the file is readable', () => {
    expect(buildProgressJson([makeCourse('CPSC 330')])).toContain('\n  ');
  });
});

describe('parseProgressJson rejects bad input', () => {
  it('rejects malformed JSON', () => {
    expect(() => parseProgressJson('{ not json')).toThrow(/valid JSON/i);
  });

  it('rejects an unrelated object', () => {
    expect(() => parseProgressJson('{"hello":"world"}')).toThrow(/saved progress/i);
  });

  it('rejects a bare string, number or null', () => {
    expect(() => parseProgressJson('"hello"')).toThrow(/saved progress/i);
    expect(() => parseProgressJson('42')).toThrow(/saved progress/i);
    expect(() => parseProgressJson('null')).toThrow(/saved progress/i);
  });

  it('rejects an array of non-objects, which would silently wipe everything', () => {
    expect(() => parseProgressJson('[1,2,3]')).toThrow(/saved progress/i);
  });
});

describe('older progress files', () => {
  // Files reuse the storage envelope, so `migrate` handles old versions.
  it('loads a version-2 file, backfilling fullCreditGrade', () => {
    const v2 = JSON.stringify({
      version: 2,
      courses: [
        {
          id: 'c1',
          name: 'MATH 200',
          breakdowns: [
            {
              id: 'b1',
              courseId: 'c1',
              name: 'Assignments',
              weight: 100,
              dropLowestCount: null,
              downweightLowestCount: null,
              downweightPercent: null,
              subBreakdownLabel: 'Assignment',
              subBreakdowns: [
                { id: 's1', breakdownId: 'b1', name: 'A1', achievedMarks: 59, fullMarks: 100 },
              ],
            },
          ],
        },
      ],
    });

    const [reloaded] = parseProgressJson(v2);
    expect(reloaded.breakdowns[0].fullCreditGrade).toBeNull();
    expect(calculateBreakdownGrade(reloaded.breakdowns[0])).toBe(59);
  });

  it('loads a version-1 file, which used component wording', () => {
    const v1 = JSON.stringify([
      {
        id: 'c1',
        name: 'CPSC 110',
        components: [
          {
            id: 'comp1',
            name: 'Labs',
            weight: 100,
            subComponents: [{ id: 's1', name: 'Lab 1', grade: 90 }],
          },
        ],
      },
    ]);

    const [reloaded] = parseProgressJson(v1);
    expect(reloaded.name).toBe('CPSC 110');
    expect(calculateBreakdownGrade(reloaded.breakdowns[0])).toBe(90);
  });
});
