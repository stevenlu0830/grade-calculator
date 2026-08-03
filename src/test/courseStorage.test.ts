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

describe('migrate', () => {
  it('returns an empty list for nothing saved', () => {
    expect(migrate([])).toEqual([]);
    expect(migrate(null)).toEqual([]);
    expect(migrate(undefined)).toEqual([]);
  });

  describe('from version 1', () => {
    it('renames components to breakdowns', () => {
      const [course] = migrate(legacyData);

      expect(course.name).toBe('CPSC 121');
      expect(course.breakdowns).toHaveLength(1);
      expect(course.breakdowns[0].name).toBe('Assignments');
      expect(course.breakdowns[0].subBreakdowns.map(s => s.name)).toEqual(['A1', 'A2', 'A3']);
    });

    it('reads old grades as marks out of 100', () => {
      const [course] = migrate(legacyData);
      expect(course.breakdowns[0].subBreakdowns).toMatchObject([
        { achievedMarks: 60, fullMarks: 100 },
        { achievedMarks: 80, fullMarks: 100 },
        { achievedMarks: 100, fullMarks: 100 },
      ]);
    });

    it('preserves ids, so nothing re-keys on load', () => {
      const [course] = migrate(legacyData);
      expect(course.id).toBe('course-1');
      expect(course.breakdowns[0].id).toBe('comp-1');
      expect(course.breakdowns[0].subBreakdowns[0].id).toBe('s1');
    });

    it('rewires parent references to the migrated ids', () => {
      const [course] = migrate(legacyData);
      const breakdown = course.breakdowns[0];
      expect(breakdown.courseId).toBe(course.id);
      expect(breakdown.subBreakdowns.every(s => s.breakdownId === breakdown.id)).toBe(true);
    });

    it('carries the grading policy across', () => {
      const [course] = migrate(legacyData);
      expect(course.breakdowns[0].dropLowestCount).toBe(1);
    });

    // The whole point of defaulting to 100 full marks.
    it('calculates to exactly the grade it did before', () => {
      const [course] = migrate(legacyData);
      // Old behaviour: drop lowest of [60,80,100] -> mean(80,100) = 90
      expect(calculateBreakdownGrade(course.breakdowns[0])).toBe(90);
    });

    it('tolerates missing fields', () => {
      const sparse = [{ components: [{ subComponents: [{}] }] }];
      const [course] = migrate(sparse);

      expect(course.name).toBe('');
      expect(course.id).toBeTruthy();
      expect(course.breakdowns[0].subBreakdowns[0]).toMatchObject({
        name: '',
        achievedMarks: null,
        fullMarks: 100,
      });
    });

    it('gives migrated breakdowns a usable sub-breakdown label', () => {
      const [course] = migrate(legacyData);
      expect(course.breakdowns[0].subBreakdownLabel).toBe('Assignments');
    });
  });

  describe('from the current envelope', () => {
    it('unwraps the courses array', () => {
      const current = {
        version: SCHEMA_VERSION,
        courses: [{ id: 'c', name: 'MATH 200', breakdowns: [] }],
      };
      expect(migrate(current)).toEqual(current.courses);
    });

    it('survives an envelope with no courses', () => {
      expect(migrate({ version: SCHEMA_VERSION })).toEqual([]);
    });
  });
});
