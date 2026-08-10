import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION } from '@/lib/courseStorage';
import { buildUserDataRow, parseUserDataRow } from '@/lib/supabaseCourseStorage';
import { LEGACY_FULL_MARKS } from '@/lib/gradeCalculations';
import { GradeData } from '@/types/grades';

const sample: GradeData = {
  courses: [
    {
      id: 'c1',
      name: 'CPSC 121',
      semester: '2026 Winter Term 1',
      breakdowns: [],
    },
  ],
  semesters: ['2026 Winter Term 1'],
};

describe('buildUserDataRow', () => {
  it('keys the row on the user and stamps the schema version', () => {
    const row = buildUserDataRow('user-1', sample);

    expect(row.user_id).toBe('user-1');
    expect(row.version).toBe(SCHEMA_VERSION);
  });

  it('stores the same envelope localStorage holds, so both share `migrate`', () => {
    const row = buildUserDataRow('user-1', sample);

    expect(row.data).toEqual({
      version: SCHEMA_VERSION,
      courses: sample.courses,
      semesters: sample.semesters,
    });
  });

  it('writes an empty account rather than omitting the row', () => {
    const row = buildUserDataRow('user-1', { courses: [], semesters: [] });

    // Deleting your last course has to persist, not read as "nothing saved yet".
    expect(row.data).toEqual({ version: SCHEMA_VERSION, courses: [], semesters: [] });
  });
});

describe('parseUserDataRow', () => {
  it('reads back exactly what was written', () => {
    expect(parseUserDataRow({ data: buildUserDataRow('u', sample).data })).toEqual(sample);
  });

  // A brand new account has no row at all; `maybeSingle` returns null for it.
  it('treats a missing row as an empty account', () => {
    expect(parseUserDataRow(null)).toEqual({ courses: [], semesters: [] });
    expect(parseUserDataRow(undefined)).toEqual({ courses: [], semesters: [] });
    expect(parseUserDataRow({ data: null })).toEqual({ courses: [], semesters: [] });
  });

  it('opens a row written by an older schema', () => {
    // Version 1: bare course array, "components", grades as percentages.
    const legacy = [
      {
        id: 'course-1',
        name: 'MATH 100',
        components: [
          {
            id: 'comp-1',
            name: 'Assignments',
            weight: 40,
            subComponents: [{ id: 's1', name: 'A1', grade: 75 }],
          },
        ],
      },
    ];

    const { courses } = parseUserDataRow({ data: legacy });

    expect(courses[0].name).toBe('MATH 100');
    expect(courses[0].breakdowns[0].subBreakdowns[0]).toMatchObject({
      achievedMarks: 75,
      fullMarks: LEGACY_FULL_MARKS,
    });
  });

  it('degrades to empty rather than throwing on an unreadable row', () => {
    // One corrupt row shouldn't cost the student a usable app.
    expect(parseUserDataRow({ data: 'not json at all' })).toEqual({ courses: [], semesters: [] });
  });
});
