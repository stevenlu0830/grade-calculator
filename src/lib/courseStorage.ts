import { Breakdown, Course, SubBreakdown } from '@/types/grades';
import { LEGACY_FULL_MARKS } from '@/lib/gradeCalculations';
import { createId } from '@/lib/id';

/**
 * Where saved courses live.
 *
 * The store depends on this interface rather than on `localStorage` directly,
 * so it can be exercised without a browser and swapped for a server-backed
 * implementation without touching state logic.
 */
export interface CourseStorage {
  load(): Course[];
  save(courses: Course[]): void;
}

export const STORAGE_KEY = 'ubc-grade-calculator-data';

/**
 * Bumped whenever the persisted shape changes; see `migrate`.
 *
 * 1 → bare `Course[]` using "component" wording, `grade` as a percentage.
 * 2 → `{ version, courses }` with breakdown wording and marks out of full marks.
 * 3 → adds `fullCreditGrade`.
 * 4 → adds `semester` on each course.
 */
export const SCHEMA_VERSION = 4;

interface StoredData {
  version: number;
  courses: Course[];
}

/**
 * Version 1 stored a bare `Course[]` using "component" terminology, where a
 * sub-component's `grade` was a percentage out of 100.
 */
interface LegacySubComponent {
  id?: string;
  name?: string;
  grade?: number | null;
}

interface LegacyComponent {
  id?: string;
  name?: string;
  weight?: number | null;
  dropLowestCount?: number | null;
  downweightLowestCount?: number | null;
  downweightPercent?: number | null;
  subComponents?: LegacySubComponent[];
}

interface LegacyCourse {
  id?: string;
  name?: string;
  components?: LegacyComponent[];
}

const isLegacy = (raw: unknown): raw is LegacyCourse[] =>
  Array.isArray(raw) && raw.some(course => course !== null && typeof course === 'object' && 'components' in course);

/**
 * Rewrites v1 data into the current shape.
 *
 * Old grades were already percentages, so giving every sub-breakdown 100 full
 * marks makes migrated courses calculate to exactly the same result they did
 * before — total-marks arithmetic reduces to a plain average when every item is
 * out of the same number.
 */
function migrateLegacy(courses: LegacyCourse[]): Course[] {
  return courses.map(legacyCourse => {
    const courseId = legacyCourse.id ?? createId();

    const breakdowns: Breakdown[] = (legacyCourse.components ?? []).map(legacyBreakdown => {
      const breakdownId = legacyBreakdown.id ?? createId();
      const name = legacyBreakdown.name ?? '';

      const subBreakdowns: SubBreakdown[] = (legacyBreakdown.subComponents ?? []).map(sub => ({
        id: sub.id ?? createId(),
        breakdownId,
        name: sub.name ?? '',
        achievedMarks: sub.grade ?? null,
        fullMarks: LEGACY_FULL_MARKS,
      }));

      return {
        id: breakdownId,
        courseId,
        name,
        weight: legacyBreakdown.weight ?? null,
        dropLowestCount: legacyBreakdown.dropLowestCount ?? null,
        downweightLowestCount: legacyBreakdown.downweightLowestCount ?? null,
        downweightPercent: legacyBreakdown.downweightPercent ?? null,
        fullCreditGrade: null,
        // Best available guess for auto-naming; the student can rename freely.
        subBreakdownLabel: name || 'Item',
        subBreakdowns,
      };
    });

    return { id: courseId, name: legacyCourse.name ?? '', semester: '', breakdowns };
  });
}

/**
 * Fills in fields added after a course was saved.
 *
 * Absent optional fields deserialise as `undefined`, and `undefined !== null`,
 * so a nullability check like `fullCreditGrade !== null` would read a missing
 * field as *set*. Normalising on load keeps every later check honest.
 */
function normalizeCourses(courses: Course[]): Course[] {
  return courses.map(course => ({
    ...course,
    // Courses saved before semesters existed become "unassigned" rather than
    // vanishing from the panel.
    semester: course.semester ?? '',
    breakdowns: (course.breakdowns ?? []).map(breakdown => ({
      ...breakdown,
      fullCreditGrade: breakdown.fullCreditGrade ?? null,
      subBreakdowns: (breakdown.subBreakdowns ?? []).map(sub => ({
        ...sub,
        fullMarks: sub.fullMarks ?? null,
      })),
    })),
  }));
}

/** Accepts the current envelope, an older envelope, or bare v1 data. */
export function migrate(raw: unknown): Course[] {
  if (isLegacy(raw)) return normalizeCourses(migrateLegacy(raw));

  if (raw !== null && typeof raw === 'object' && 'courses' in raw) {
    const stored = raw as StoredData;
    return Array.isArray(stored.courses) ? normalizeCourses(stored.courses) : [];
  }

  // An empty v1 array, or anything unrecognisable.
  return Array.isArray(raw) ? normalizeCourses(raw as Course[]) : [];
}

/**
 * Browser-backed storage. Both operations degrade to a console error rather
 * than throwing — private browsing and quota limits are expected conditions,
 * and losing persistence should not take the app down with it.
 */
export const localCourseStorage: CourseStorage = {
  load(): Course[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return migrate(JSON.parse(saved));
    } catch (error) {
      console.error('Failed to load saved data:', error);
    }
    return [];
  },

  save(courses: Course[]): void {
    try {
      const payload: StoredData = { version: SCHEMA_VERSION, courses };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  },
};
