import { describe, it, expect } from 'vitest';
import { Course } from '@/types/grades';
import {
  TERMS,
  UNASSIGNED_SEMESTER,
  compareSemestersDescending,
  countCoursesIn,
  coursesIn,
  formatSemester,
  parseSemester,
  persistedSemesters,
  semesterLabel,
  semesterYearOptions,
  semestersFromCourses,
  shortSemesterLabel,
  visibleSemesters,
} from '@/lib/semesters';

const course = (name: string, semester: string): Course => ({
  id: `id-${name}`,
  name,
  semester,
  breakdowns: [],
});

describe('TERMS', () => {
  it('lists the four terms UBC uses', () => {
    expect(TERMS).toEqual([
      'Winter Term 1',
      'Winter Term 2',
      'Summer Term 1',
      'Summer Term 2',
    ]);
  });

  it('is in chronological order within an academic year, not alphabetical', () => {
    // Winter Term 1 starts in September, so it comes first — an alphabetical
    // sort would wrongly put the Summer terms ahead of it.
    expect(TERMS.indexOf('Winter Term 1')).toBeLessThan(TERMS.indexOf('Summer Term 1'));
  });
});

describe('formatSemester', () => {
  it('produces the label the spec asks for', () => {
    expect(formatSemester(2026, 'Summer Term 2')).toBe('2026 Summer Term 2');
    expect(formatSemester(2025, 'Winter Term 1')).toBe('2025 Winter Term 1');
  });
});

describe('parseSemester', () => {
  it('round-trips a formatted label', () => {
    expect(parseSemester('2026 Summer Term 2')).toEqual({ year: 2026, term: 'Summer Term 2' });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseSemester('  2026 Winter Term 1  ')).toEqual({
      year: 2026,
      term: 'Winter Term 1',
    });
  });

  it('rejects anything that is not a semester', () => {
    expect(parseSemester('')).toBeNull();
    expect(parseSemester('Summer Term 2')).toBeNull();
    expect(parseSemester('2026')).toBeNull();
    expect(parseSemester('2026 Autumn Term 1')).toBeNull();
    expect(parseSemester('20 Summer Term 2')).toBeNull();
  });

  it('round-trips every term', () => {
    for (const term of TERMS) {
      expect(parseSemester(formatSemester(2026, term))).toEqual({ year: 2026, term });
    }
  });
});

describe('compareSemestersDescending', () => {
  const sorted = (labels: string[]) => [...labels].sort(compareSemestersDescending);

  it('puts later years first', () => {
    expect(sorted(['2024 Winter Term 1', '2026 Winter Term 1', '2025 Winter Term 1'])).toEqual([
      '2026 Winter Term 1',
      '2025 Winter Term 1',
      '2024 Winter Term 1',
    ]);
  });

  it('orders terms within a year by when they happen, latest first', () => {
    expect(
      sorted([
        '2026 Winter Term 1',
        '2026 Summer Term 2',
        '2026 Winter Term 2',
        '2026 Summer Term 1',
      ])
    ).toEqual([
      '2026 Summer Term 2',
      '2026 Summer Term 1',
      '2026 Winter Term 2',
      '2026 Winter Term 1',
    ]);
  });

  it('sorts unassigned courses last, not first', () => {
    expect(sorted([UNASSIGNED_SEMESTER, '2026 Winter Term 1'])).toEqual([
      '2026 Winter Term 1',
      UNASSIGNED_SEMESTER,
    ]);
  });
});

describe('semestersFromCourses', () => {
  it('lists each semester once, most recent first', () => {
    const courses = [
      course('A', '2025 Winter Term 1'),
      course('B', '2026 Summer Term 1'),
      course('C', '2025 Winter Term 1'),
    ];
    expect(semestersFromCourses(courses)).toEqual(['2026 Summer Term 1', '2025 Winter Term 1']);
  });

  it('includes the unassigned bucket when a course has no semester', () => {
    expect(semestersFromCourses([course('A', UNASSIGNED_SEMESTER)])).toEqual([
      UNASSIGNED_SEMESTER,
    ]);
  });

  it('is empty for no courses', () => {
    expect(semestersFromCourses([])).toEqual([]);
  });
});

describe('persistedSemesters', () => {
  it('keeps a semester that has no courses in it', () => {
    // The saved list is the only thing anchoring an empty semester.
    expect(persistedSemesters([], ['2026 Winter Term 1'])).toEqual(['2026 Winter Term 1']);
  });

  it('adopts a semester only a course names', () => {
    // Older saves had no list at all; without this, deleting that course would
    // take the semester with it.
    expect(persistedSemesters([course('A', '2025 Summer Term 1')], [])).toEqual([
      '2025 Summer Term 1',
    ]);
  });

  it('merges both sources without duplicating, most recent first', () => {
    const courses = [course('A', '2025 Winter Term 1'), course('B', '2026 Summer Term 2')];
    expect(persistedSemesters(courses, ['2025 Winter Term 1', '2024 Winter Term 2'])).toEqual([
      '2026 Summer Term 2',
      '2025 Winter Term 1',
      '2024 Winter Term 2',
    ]);
  });

  it('leaves the unassigned bucket out', () => {
    // Nobody created it; it exists only while a course has no semester.
    expect(persistedSemesters([course('A', UNASSIGNED_SEMESTER)], [])).toEqual([]);
    expect(persistedSemesters([], [UNASSIGNED_SEMESTER])).toEqual([]);
  });

  it('is empty for nothing at all', () => {
    expect(persistedSemesters([], [])).toEqual([]);
  });
});

describe('visibleSemesters', () => {
  it('shows a newly added semester before it has any courses', () => {
    expect(visibleSemesters([], ['2026 Winter Term 1'])).toEqual(['2026 Winter Term 1']);
  });

  it('does not duplicate one that now has courses', () => {
    const courses = [course('A', '2026 Winter Term 1')];
    expect(visibleSemesters(courses, ['2026 Winter Term 1'])).toEqual(['2026 Winter Term 1']);
  });

  it('merges and sorts both sources', () => {
    const courses = [course('A', '2025 Winter Term 1')];
    expect(visibleSemesters(courses, ['2026 Summer Term 2'])).toEqual([
      '2026 Summer Term 2',
      '2025 Winter Term 1',
    ]);
  });

  it('still shows a semester only a course knows about', () => {
    // A file saved by an older build, or edited by hand.
    expect(visibleSemesters([course('A', '2025 Winter Term 1')], [])).toEqual([
      '2025 Winter Term 1',
    ]);
  });
});

describe('coursesIn / countCoursesIn', () => {
  const courses = [
    course('A', '2026 Winter Term 1'),
    course('B', '2026 Winter Term 1'),
    course('C', '2025 Summer Term 1'),
  ];

  it('filters to one semester', () => {
    expect(coursesIn(courses, '2026 Winter Term 1').map(c => c.name)).toEqual(['A', 'B']);
  });

  it('counts them', () => {
    expect(countCoursesIn(courses, '2026 Winter Term 1')).toBe(2);
    expect(countCoursesIn(courses, '2025 Summer Term 1')).toBe(1);
    expect(countCoursesIn(courses, '2030 Winter Term 1')).toBe(0);
  });

  it('groups legacy courses under the unassigned bucket', () => {
    // `semester` arrives as undefined from data saved before the field existed.
    const legacy = [{ id: 'x', name: 'Old', breakdowns: [] } as unknown as Course];
    expect(countCoursesIn(legacy, UNASSIGNED_SEMESTER)).toBe(1);
  });
});

describe('semesterLabel', () => {
  it('gives the unassigned bucket a readable name', () => {
    expect(semesterLabel(UNASSIGNED_SEMESTER)).toBe('Unassigned');
  });

  it('leaves a real semester alone', () => {
    expect(semesterLabel('2026 Summer Term 2')).toBe('2026 Summer Term 2');
  });
});

describe('shortSemesterLabel', () => {
  it('abbreviates every term', () => {
    expect(shortSemesterLabel('2023 Winter Term 1')).toBe('2023W1');
    expect(shortSemesterLabel('2023 Winter Term 2')).toBe('2023W2');
    expect(shortSemesterLabel('2024 Summer Term 1')).toBe('2024S1');
    expect(shortSemesterLabel('2024 Summer Term 2')).toBe('2024S2');
  });

  it('covers every term in TERMS, so none falls back to the full label', () => {
    for (const term of TERMS) {
      const short = shortSemesterLabel(formatSemester(2026, term));
      expect(short).toMatch(/^2026[WS][12]$/);
    }
  });

  it('is short enough for the panel not to truncate it', () => {
    // The whole point: "2023 Winter Te…" told a student nothing.
    for (const term of TERMS) {
      expect(shortSemesterLabel(formatSemester(2026, term)).length).toBe(6);
    }
  });

  it('keeps the readable name for the unassigned bucket', () => {
    expect(shortSemesterLabel(UNASSIGNED_SEMESTER)).toBe('Unassigned');
  });

  it('leaves anything that is not a semester as it reads', () => {
    // Hand-edited labels shouldn't be mangled into something meaningless.
    expect(shortSemesterLabel('Exchange year')).toBe('Exchange year');
  });

  it('is display-only — the full label is what is stored', () => {
    const label = formatSemester(2023, 'Winter Term 1');
    expect(shortSemesterLabel(label)).not.toBe(label);
    expect(parseSemester(label)).toEqual({ year: 2023, term: 'Winter Term 1' });
  });
});

describe('semesterYearOptions', () => {
  it('offers next year through five back, newest first', () => {
    expect(semesterYearOptions(2026)).toEqual([2027, 2026, 2025, 2024, 2023, 2022, 2021]);
  });

  it('produces labels that parse back', () => {
    for (const year of semesterYearOptions(2026)) {
      expect(parseSemester(formatSemester(year, 'Winter Term 1'))?.year).toBe(year);
    }
  });
});
