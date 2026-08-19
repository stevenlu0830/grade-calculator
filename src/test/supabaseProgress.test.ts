import { describe, it, expect } from 'vitest';
import { Course, GradeData } from '@/types/grades';
import { SCHEMA_VERSION } from '@/lib/courseStorage';
import { buildProgressRow, parseProgressRow } from '@/lib/supabaseProgress';
import { calculateBreakdownGrade } from '@/lib/gradeCalculations';

const makeCourse = (name: string): Course => ({
  id: `id-${name}`,
  name,
  semester: '2026 Winter Term 1',
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
      isBonus: false,
      equalWeightSubBreakdowns: false,
      subBreakdownLabel: 'Assignment',
      subBreakdowns: [
        { id: 's1', breakdownId: `b-${name}`, name: 'Assignment 1', achievedMarks: 4, fullMarks: 10 },
        { id: 's2', breakdownId: `b-${name}`, name: 'Assignment 2', achievedMarks: 18, fullMarks: 20 },
        { id: 's3', breakdownId: `b-${name}`, name: 'Assignment 3', achievedMarks: null, fullMarks: null },
      ],
    },
  ],
});

/** What Save Progress is handed: the courses in order, plus the semester list. */
const saved = (courses: Course[], semesters: string[] = ['2026 Winter Term 1']): GradeData => ({
  courses,
  semesters,
});

/** A row as the table hands it back, from what a save would have written. */
const rowFrom = (data: GradeData, savedAt = '2026-08-19T14:03:00.000Z') => ({
  data: buildProgressRow('user-1', data).data,
  saved_at: savedAt,
});

describe('buildProgressRow', () => {
  it('keys the row on the user and stamps the schema version', () => {
    const row = buildProgressRow('user-1', saved([makeCourse('CPSC 330')]));

    expect(row.user_id).toBe('user-1');
    expect(row.version).toBe(SCHEMA_VERSION);
  });

  it('stores the same envelope user_data holds, so both share `migrate`', () => {
    const data = saved([makeCourse('CPSC 330')]);
    const row = buildProgressRow('user-1', data);

    expect(row.data).toEqual({
      version: SCHEMA_VERSION,
      courses: data.courses,
      semesters: data.semesters,
    });
  });

  it('writes an empty snapshot rather than omitting the row', () => {
    // Deleting every course and saving has to persist, or the next reload would
    // resurrect the courses from the previous snapshot.
    expect(buildProgressRow('user-1', { courses: [], semesters: [] }).data).toEqual({
      version: SCHEMA_VERSION,
      courses: [],
      semesters: [],
    });
  });
});

describe('save then reload, end to end', () => {
  it('restores exactly the courses that were saved', () => {
    const courses = [makeCourse('CPSC 330'), makeCourse('Databases in Data Science')];

    expect(parseProgressRow(rowFrom(saved(courses))).courses).toEqual(courses);
  });

  it('reloads in the order the courses were saved', () => {
    // One JSON array, so ordering needs no manifest to survive the round trip.
    const courses = [makeCourse('Zoology'), makeCourse('Anthropology'), makeCourse('MATH 200')];

    expect(parseProgressRow(rowFrom(saved(courses))).courses.map(c => c.name)).toEqual([
      'Zoology',
      'Anthropology',
      'MATH 200',
    ]);
  });

  it('restores semesters that have no courses in them', () => {
    const snapshot = parseProgressRow(
      rowFrom(saved([], ['2026 Winter Term 1', '2025 Summer Term 1']))
    );

    expect(snapshot.courses).toEqual([]);
    expect(snapshot.semesters).toEqual(['2026 Winter Term 1', '2025 Summer Term 1']);
  });

  it('round-trips grades, so a reloaded course calculates the same', () => {
    const original = makeCourse('CPSC 330');
    const { courses } = parseProgressRow(rowFrom(saved([original])));

    expect(calculateBreakdownGrade(courses[0].breakdowns[0])).toBe(
      calculateBreakdownGrade(original.breakdowns[0])
    );
  });

  it('preserves unentered marks as null rather than zero', () => {
    const { courses } = parseProgressRow(rowFrom(saved([makeCourse('CPSC 330')])));

    expect(courses[0].breakdowns[0].subBreakdowns[2]).toMatchObject({
      achievedMarks: null,
      fullMarks: null,
    });
  });

  it('preserves grading policies, including full credit', () => {
    const { courses } = parseProgressRow(rowFrom(saved([makeCourse('CPSC 330')])));

    expect(courses[0].breakdowns[0]).toMatchObject({ dropLowestCount: 1, fullCreditGrade: 80 });
  });
});

describe('parseProgressRow', () => {
  // The hook tells these two apart: only the first means there is nothing to
  // restore, and only the second is worth warning about before it wipes a screen.
  it('reports never-saved as null, not as an empty snapshot', () => {
    expect(parseProgressRow(null)).toBeNull();
    expect(parseProgressRow(undefined)).toBeNull();
    expect(parseProgressRow({ data: null })).toBeNull();
  });

  it('reports a deliberately emptied snapshot as empty, not as never-saved', () => {
    const snapshot = parseProgressRow(rowFrom({ courses: [], semesters: [] }));

    expect(snapshot).not.toBeNull();
    expect(snapshot.courses).toEqual([]);
    expect(snapshot.semesters).toEqual([]);
  });

  it('reads back when the snapshot was taken', () => {
    const snapshot = parseProgressRow(rowFrom(saved([]), '2026-08-19T14:03:00.000Z'));

    expect(snapshot.savedAt?.toISOString()).toBe('2026-08-19T14:03:00.000Z');
  });

  it('drops an unusable timestamp rather than failing the reload', () => {
    // The courses are the point; the date is a courtesy in a toast.
    expect(parseProgressRow(rowFrom(saved([]), 'not a date')).savedAt).toBeNull();
    expect(parseProgressRow({ data: buildProgressRow('u', saved([])).data }).savedAt).toBeNull();
  });

  it('degrades to an empty snapshot rather than throwing on an unreadable row', () => {
    const snapshot = parseProgressRow({ data: 'not json at all' });

    expect(snapshot.courses).toEqual([]);
    expect(snapshot.semesters).toEqual([]);
  });
});

describe('older snapshots', () => {
  // Snapshots reuse the storage envelope, so `migrate` handles old versions.
  it('opens a version-2 snapshot, backfilling fullCreditGrade', () => {
    const { courses } = parseProgressRow({
      data: {
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
      },
    });

    expect(courses[0].breakdowns[0].fullCreditGrade).toBeNull();
    expect(calculateBreakdownGrade(courses[0].breakdowns[0])).toBe(59);
  });

  it('opens a version-1 snapshot, which used component wording', () => {
    const { courses } = parseProgressRow({
      data: [
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
      ],
    });

    expect(courses[0].name).toBe('CPSC 110');
    expect(calculateBreakdownGrade(courses[0].breakdowns[0])).toBe(90);
  });
});
