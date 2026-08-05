import { describe, it, expect } from 'vitest';
import { Course } from '@/types/grades';
import { CSV_HEADERS, buildCoursesCsv } from '@/lib/csvExport';
import { parseCSV } from '@/lib/csvImport';

const course: Course = {
  id: 'course-1',
  name: 'CPSC 121',
  breakdowns: [
    {
      id: 'b-1',
      courseId: 'course-1',
      name: 'Assignments',
      weight: 40,
      dropLowestCount: 1,
      downweightLowestCount: null,
      downweightPercent: null,
      fullCreditGrade: null,
      subBreakdownLabel: 'Assignment',
      subBreakdowns: [
        { id: 's1', breakdownId: 'b-1', name: 'Assignment 1', achievedMarks: 18, fullMarks: 20 },
        { id: 's2', breakdownId: 'b-1', name: 'Assignment 2', achievedMarks: null, fullMarks: 25 },
      ],
    },
    {
      id: 'b-2',
      courseId: 'course-1',
      name: 'Final Exam',
      weight: 60,
      dropLowestCount: null,
      downweightLowestCount: 1,
      downweightPercent: 50,
      fullCreditGrade: null,
      subBreakdownLabel: 'Final Exam',
      subBreakdowns: [
        { id: 's3', breakdownId: 'b-2', name: 'Final Exam 1', achievedMarks: 78, fullMarks: 100 },
      ],
    },
  ],
};

const lines = (csv: string) => csv.split('\n');

describe('buildCoursesCsv', () => {
  it('starts with the canonical header row', () => {
    expect(lines(buildCoursesCsv([]))[0]).toBe(CSV_HEADERS.join(','));
  });

  it('emits one row per sub-breakdown', () => {
    expect(lines(buildCoursesCsv([course]))).toHaveLength(1 + 3);
  });

  it('prints parent columns only on the first row of each group', () => {
    const [, first, second] = lines(buildCoursesCsv([course]));

    expect(first).toBe('CPSC 121,Assignments,40,1,,,,Assignment 1,18,20');
    // Assignment 2 belongs to the same breakdown, so parent columns are blank.
    expect(second).toBe(',,,,,,,Assignment 2,,25');
  });

  it('writes unentered marks as an empty cell but keeps the full marks', () => {
    expect(lines(buildCoursesCsv([course]))[2].endsWith(',Assignment 2,,25')).toBe(true);
  });

  it('quotes cells containing a comma', () => {
    const named = { ...course, name: 'Smith, J.', breakdowns: [] };
    expect(lines(buildCoursesCsv([named]))[1]).toBe('"Smith, J.",,,,,,,,,');
  });

  it('doubles embedded quotes', () => {
    const named = { ...course, name: 'The "Big" One', breakdowns: [] };
    expect(lines(buildCoursesCsv([named]))[1]).toBe('"The ""Big"" One",,,,,,,,,');
  });

  it('still emits a row for a course with no breakdowns', () => {
    expect(lines(buildCoursesCsv([{ ...course, breakdowns: [] }]))).toHaveLength(2);
  });
});

describe('CSV round trip', () => {
  it('preserves the course tree through export and re-import', () => {
    const [reimported] = parseCSV(buildCoursesCsv([course]));

    expect(reimported.name).toBe(course.name);
    expect(reimported.breakdowns).toHaveLength(2);

    expect(reimported.breakdowns[0]).toMatchObject({
      name: 'Assignments',
      weight: 40,
      dropLowestCount: 1,
      downweightLowestCount: null,
      downweightPercent: null,
    });
    expect(reimported.breakdowns[0].subBreakdowns).toMatchObject([
      { name: 'Assignment 1', achievedMarks: 18, fullMarks: 20 },
      { name: 'Assignment 2', achievedMarks: null, fullMarks: 25 },
    ]);

    expect(reimported.breakdowns[1]).toMatchObject({
      name: 'Final Exam',
      weight: 60,
      dropLowestCount: null,
      downweightLowestCount: 1,
      downweightPercent: 50,
    });
    expect(reimported.breakdowns[1].subBreakdowns).toMatchObject([
      { name: 'Final Exam 1', achievedMarks: 78, fullMarks: 100 },
    ]);
  });

  it('preserves names that need quoting', () => {
    const awkward: Course = {
      ...course,
      name: 'Smith, J. — "Intro"',
      breakdowns: [
        {
          ...course.breakdowns[0],
          name: 'Labs, weekly',
          subBreakdowns: [
            { id: 's1', breakdownId: 'b-1', name: 'Lab "1"', achievedMarks: 8, fullMarks: 10 },
          ],
        },
      ],
    };

    const [reimported] = parseCSV(buildCoursesCsv([awkward]));

    expect(reimported.name).toBe('Smith, J. — "Intro"');
    expect(reimported.breakdowns[0].name).toBe('Labs, weekly');
    expect(reimported.breakdowns[0].subBreakdowns[0].name).toBe('Lab "1"');
  });

  it('round-trips a full credit threshold combined with a marks policy', () => {
    const withFullCredit: Course = {
      ...course,
      breakdowns: [{ ...course.breakdowns[0], dropLowestCount: 2, fullCreditGrade: 80 }],
    };

    const [reimported] = parseCSV(buildCoursesCsv([withFullCredit]));
    expect(reimported.breakdowns[0]).toMatchObject({ dropLowestCount: 2, fullCreditGrade: 80 });
  });

  it('round-trips a threshold of 0 rather than losing it as blank', () => {
    const zero: Course = {
      ...course,
      breakdowns: [{ ...course.breakdowns[0], fullCreditGrade: 0 }],
    };

    const [reimported] = parseCSV(buildCoursesCsv([zero]));
    expect(reimported.breakdowns[0].fullCreditGrade).toBe(0);
  });

  it('survives multiple courses', () => {
    const second: Course = { ...course, id: 'course-2', name: 'MATH 200' };
    const reimported = parseCSV(buildCoursesCsv([course, second]));

    expect(reimported.map(c => c.name)).toEqual(['CPSC 121', 'MATH 200']);
    expect(reimported.every(c => c.breakdowns.length === 2)).toBe(true);
  });
});
