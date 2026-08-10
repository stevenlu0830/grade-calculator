import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION, migrate } from '@/lib/courseStorage';
import { calculateBreakdownGrade } from '@/lib/gradeCalculations';

/** Exactly the shape version 1 wrote to localStorage. */
const legacyData = [
  {
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
          { id: 's1', componentId: 'comp-1', name: 'A1', grade: 60 },
          { id: 's2', componentId: 'comp-1', name: 'A2', grade: 80 },
          { id: 's3', componentId: 'comp-1', name: 'A3', grade: 100 },
        ],
      },
    ],
  },
];

/** Courses alone; `migrate` returns them wrapped with the semester list. */
const coursesOf = (raw: unknown) => migrate(raw).courses;

describe('migrate', () => {
  const empty = { courses: [], semesters: [] };

  it('returns an empty list for nothing saved', () => {
    expect(migrate([])).toEqual(empty);
    expect(migrate(null)).toEqual(empty);
    expect(migrate(undefined)).toEqual(empty);
  });

  describe('from version 1', () => {
    it('renames components to breakdowns', () => {
      const [course] = coursesOf(legacyData);

      expect(course.name).toBe('CPSC 121');
      expect(course.breakdowns).toHaveLength(1);
      expect(course.breakdowns[0].name).toBe('Assignments');
      expect(course.breakdowns[0].subBreakdowns.map(s => s.name)).toEqual(['A1', 'A2', 'A3']);
    });

    it('reads old grades as marks out of 100', () => {
      const [course] = coursesOf(legacyData);
      expect(course.breakdowns[0].subBreakdowns).toMatchObject([
        { achievedMarks: 60, fullMarks: 100 },
        { achievedMarks: 80, fullMarks: 100 },
        { achievedMarks: 100, fullMarks: 100 },
      ]);
    });

    it('preserves ids, so nothing re-keys on load', () => {
      const [course] = coursesOf(legacyData);
      expect(course.id).toBe('course-1');
      expect(course.breakdowns[0].id).toBe('comp-1');
      expect(course.breakdowns[0].subBreakdowns[0].id).toBe('s1');
    });

    it('rewires parent references to the migrated ids', () => {
      const [course] = coursesOf(legacyData);
      const breakdown = course.breakdowns[0];
      expect(breakdown.courseId).toBe(course.id);
      expect(breakdown.subBreakdowns.every(s => s.breakdownId === breakdown.id)).toBe(true);
    });

    it('carries the grading policy across', () => {
      const [course] = coursesOf(legacyData);
      expect(course.breakdowns[0].dropLowestCount).toBe(1);
    });

    // The whole point of defaulting to 100 full marks.
    it('calculates to exactly the grade it did before', () => {
      const [course] = coursesOf(legacyData);
      // Old behaviour: drop lowest of [60,80,100] -> mean(80,100) = 90
      expect(calculateBreakdownGrade(course.breakdowns[0])).toBe(90);
    });

    it('tolerates missing fields', () => {
      const sparse = [{ components: [{ subComponents: [{}] }] }];
      const [course] = coursesOf(sparse);

      expect(course.name).toBe('');
      expect(course.id).toBeTruthy();
      expect(course.breakdowns[0].subBreakdowns[0]).toMatchObject({
        name: '',
        achievedMarks: null,
        fullMarks: 100,
      });
    });

    it('gives migrated breakdowns a usable sub-breakdown label', () => {
      const [course] = coursesOf(legacyData);
      expect(course.breakdowns[0].subBreakdownLabel).toBe('Assignments');
    });
  });

  describe('fields added after a save', () => {
    /** A version-2 envelope: breakdown wording, but no `fullCreditGrade`. */
    const v2 = {
      version: 2,
      courses: [
        {
          id: 'c1',
          name: 'CPSC 121',
          breakdowns: [
            {
              id: 'b1',
              courseId: 'c1',
              name: 'Assignments',
              weight: 100,
              dropLowestCount: 1,
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
    };

    it('fills a missing fullCreditGrade with null, not undefined', () => {
      const [course] = coursesOf(v2);
      const breakdown = course.breakdowns[0];

      expect(breakdown.fullCreditGrade).toBeNull();
      // `undefined !== null` would make a nullability check read it as *set*.
      expect(breakdown.fullCreditGrade).not.toBeUndefined();
      expect('fullCreditGrade' in breakdown).toBe(true);
    });

    it('leaves the grade unchanged, since full credit defaults to off', () => {
      const [course] = coursesOf(v2);
      expect(calculateBreakdownGrade(course.breakdowns[0])).toBe(59);
    });

    it('keeps an explicit fullCreditGrade when one is present', () => {
      const withPolicy = {
        version: 3,
        courses: [
          {
            ...v2.courses[0],
            breakdowns: [{ ...v2.courses[0].breakdowns[0], fullCreditGrade: 60 }],
          },
        ],
      };
      const [course] = coursesOf(withPolicy);
      expect(course.breakdowns[0].fullCreditGrade).toBe(60);
      expect(calculateBreakdownGrade(course.breakdowns[0])).toBeCloseTo(98.33333333333333, 10);
    });

    it('fills a missing fullMarks with null too', () => {
      const noFullMarks = {
        version: 2,
        courses: [
          {
            ...v2.courses[0],
            breakdowns: [
              {
                ...v2.courses[0].breakdowns[0],
                subBreakdowns: [{ id: 's1', breakdownId: 'b1', name: 'A1', achievedMarks: 5 }],
              },
            ],
          },
        ],
      };
      const [course] = coursesOf(noFullMarks);
      expect(course.breakdowns[0].subBreakdowns[0].fullMarks).toBeNull();
    });

    it('gives v1 data the new field as well', () => {
      const [course] = coursesOf(legacyData);
      expect(course.breakdowns[0].fullCreditGrade).toBeNull();
    });
  });

  describe('from the current envelope', () => {
    it('unwraps the courses array', () => {
      const current = {
        version: SCHEMA_VERSION,
        courses: [{ id: 'c', name: 'MATH 200', semester: '2026 Winter Term 1', breakdowns: [] }],
      };
      expect(migrate(current).courses).toEqual(current.courses);
    });

    it('backfills a missing semester as unassigned', () => {
      // Courses saved before semesters existed must stay visible, in the
      // unassigned bucket, rather than disappearing from the panel.
      const beforeSemesters = {
        version: 3,
        courses: [{ id: 'c', name: 'MATH 200', breakdowns: [] }],
      };
      const [course] = coursesOf(beforeSemesters);

      expect(course.semester).toBe('');
      expect(course.semester).not.toBeUndefined();
    });

    it('keeps an explicit semester', () => {
      const withSemester = {
        version: SCHEMA_VERSION,
        courses: [{ id: 'c', name: 'MATH 200', semester: '2026 Summer Term 2', breakdowns: [] }],
      };
      expect(coursesOf(withSemester)[0].semester).toBe('2026 Summer Term 2');
    });

    it('survives an envelope with no courses', () => {
      expect(migrate({ version: SCHEMA_VERSION }).courses).toEqual([]);
    });
  });

  describe('the semester list', () => {
    it('reads back the semesters that were saved', () => {
      const saved = {
        version: SCHEMA_VERSION,
        courses: [],
        semesters: ['2026 Winter Term 1', '2025 Summer Term 2'],
      };
      // An empty semester has no course to anchor it, so the list is the only
      // record that it exists at all.
      expect(migrate(saved).semesters).toEqual(['2026 Winter Term 1', '2025 Summer Term 2']);
    });

    it('is empty for data saved before the list existed', () => {
      const v4 = {
        version: 4,
        courses: [{ id: 'c', name: 'MATH 200', semester: '2026 Winter Term 1', breakdowns: [] }],
      };
      // Not a loss: the store folds the courses' own semesters back in.
      expect(migrate(v4).semesters).toEqual([]);
    });

    it('ignores a semester list that is not a list of strings', () => {
      expect(migrate({ version: 5, courses: [], semesters: 'nope' }).semesters).toEqual([]);
      expect(migrate({ version: 5, courses: [], semesters: [1, '2026 Winter Term 1'] }).semesters)
        .toEqual(['2026 Winter Term 1']);
    });
  });

  describe('bonus breakdowns', () => {
    const withBonus = (isBonus: unknown) => ({
      version: SCHEMA_VERSION,
      courses: [
        {
          id: 'c',
          name: 'MATH 200',
          semester: '2026 Winter Term 1',
          breakdowns: [
            {
              id: 'b',
              courseId: 'c',
              name: 'Extra credit',
              weight: 5,
              dropLowestCount: null,
              downweightLowestCount: null,
              downweightPercent: null,
              fullCreditGrade: null,
              isBonus,
              subBreakdownLabel: 'Item',
              subBreakdowns: [],
            },
          ],
        },
      ],
    });

    it('keeps an explicit bonus flag', () => {
      expect(coursesOf(withBonus(true))[0].breakdowns[0].isBonus).toBe(true);
    });

    it('reads a breakdown saved before bonus existed as a normal one', () => {
      // Everything that predates the flag counted towards the 100%.
      expect(coursesOf(withBonus(undefined))[0].breakdowns[0].isBonus).toBe(false);
      expect(coursesOf(legacyData)[0].breakdowns[0].isBonus).toBe(false);
    });
  });
});
