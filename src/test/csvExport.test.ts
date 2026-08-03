import { describe, it, expect } from 'vitest';
import { Course } from '@/types/grades';
import { CSV_HEADERS, buildCoursesCsv } from '@/lib/csvExport';
import { parseCSV } from '@/lib/csvImport';

const course: Course = {
  id: 'course-1',
  name: 'CPSC 121',
  components: [
    {
      id: 'comp-1',
      courseId: 'course-1',
      name: 'Assignments',
      weight: 40,
      dropLowestCount: 1,
      downweightLowestCount: null,
      downweightPercent: null,
      subComponents: [
        { id: 's1', componentId: 'comp-1', name: 'A1', grade: 92 },
        { id: 's2', componentId: 'comp-1', name: 'A2', grade: null },
      ],
    },
    {
      id: 'comp-2',
      courseId: 'course-1',
      name: 'Final',
      weight: 60,
      dropLowestCount: null,
      downweightLowestCount: 1,
      downweightPercent: 50,
      subComponents: [{ id: 's3', componentId: 'comp-2', name: 'Exam', grade: 78 }],
    },
  ],
};

const lines = (csv: string) => csv.split('\n');

describe('buildCoursesCsv', () => {
  it('starts with the canonical header row', () => {
    expect(lines(buildCoursesCsv([]))[0]).toBe(CSV_HEADERS.join(','));
  });

  it('emits one row per sub-component', () => {
    expect(lines(buildCoursesCsv([course]))).toHaveLength(1 + 3);
  });

  it('prints parent columns only on the first row of each group', () => {
    const [, first, second] = lines(buildCoursesCsv([course]));

    expect(first).toBe('CPSC 121,Assignments,40,1,,,A1,92');
    // A2 belongs to the same component, so every parent column is blank.
    expect(second).toBe(',,,,,,A2,');
  });

  it('writes an unentered grade as an empty cell, not a zero', () => {
    expect(lines(buildCoursesCsv([course]))[2].endsWith(',A2,')).toBe(true);
  });

  it('quotes cells containing a comma', () => {
    const named = { ...course, name: 'Smith, J.', components: [] };
    expect(lines(buildCoursesCsv([named]))[1]).toBe('"Smith, J.",,,,,,,');
  });

  it('doubles embedded quotes', () => {
    const named = { ...course, name: 'The "Big" One', components: [] };
    expect(lines(buildCoursesCsv([named]))[1]).toBe('"The ""Big"" One",,,,,,,');
  });

  it('still emits a row for a course with no components', () => {
    const empty = { ...course, components: [] };
    expect(lines(buildCoursesCsv([empty]))).toHaveLength(2);
  });
});

describe('CSV round trip', () => {
  it('preserves the course tree through export and re-import', () => {
    const [reimported] = parseCSV(buildCoursesCsv([course]));

    expect(reimported.name).toBe(course.name);
    expect(reimported.components).toHaveLength(2);

    expect(reimported.components[0]).toMatchObject({
      name: 'Assignments',
      weight: 40,
      dropLowestCount: 1,
      downweightLowestCount: null,
      downweightPercent: null,
    });
    expect(reimported.components[0].subComponents).toMatchObject([
      { name: 'A1', grade: 92 },
      { name: 'A2', grade: null },
    ]);

    expect(reimported.components[1]).toMatchObject({
      name: 'Final',
      weight: 60,
      dropLowestCount: null,
      downweightLowestCount: 1,
      downweightPercent: 50,
    });
    expect(reimported.components[1].subComponents).toMatchObject([{ name: 'Exam', grade: 78 }]);
  });

  it('preserves names that need quoting', () => {
    const awkward: Course = {
      ...course,
      name: 'Smith, J. — "Intro"',
      components: [
        {
          ...course.components[0],
          name: 'Labs, weekly',
          subComponents: [
            { id: 's1', componentId: 'comp-1', name: 'Lab "1"', grade: 88 },
          ],
        },
      ],
    };

    const [reimported] = parseCSV(buildCoursesCsv([awkward]));

    expect(reimported.name).toBe('Smith, J. — "Intro"');
    expect(reimported.components[0].name).toBe('Labs, weekly');
    expect(reimported.components[0].subComponents[0].name).toBe('Lab "1"');
  });

  it('survives multiple courses', () => {
    const second: Course = { ...course, id: 'course-2', name: 'MATH 200' };
    const reimported = parseCSV(buildCoursesCsv([course, second]));

    expect(reimported.map(c => c.name)).toEqual(['CPSC 121', 'MATH 200']);
    expect(reimported.every(c => c.components.length === 2)).toBe(true);
  });
});
