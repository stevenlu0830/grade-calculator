import { Breakdown, Course, GradeData, SubBreakdown } from '@/types/grades';
import { LEGACY_FULL_MARKS } from '@/lib/gradeCalculations';
import { createId } from '@/lib/id';

/**
 * Where saved courses live.
 *
 * The store depends on this interface rather than on `localStorage` directly,
 * so it can be exercised without a browser and swapped for a server-backed
 * implementation without touching state logic.
 *
 * Both operations are async because one implementation talks to Supabase over
 * the network. `localCourseStorage` is still synchronous underneath and simply
 * hands back settled promises — the cost of the wrapper is one microtask, and
 * the alternative was two rival interfaces for the same job.
 */
export interface CourseStorage {
  load(): Promise<GradeData>;
  save(data: GradeData): Promise<void>;
}

/** Nothing saved. A fresh account and an unreadable one both start here. */
export const EMPTY_GRADE_DATA: GradeData = { courses: [], semesters: [] };

export const STORAGE_KEY = 'ubc-grade-calculator-data';

/**
 * Where the pre-accounts payload is parked once the import offer is answered.
 *
 * Kept rather than deleted, because the offer is answered before the imported
 * courses have reached the account, and "Start fresh" is one careless click.
 * Nothing in the app reads this key — it exists so a wrong answer is recoverable
 * by hand instead of gone.
 */
export const RETIRED_STORAGE_KEY = 'ubc-grade-calculator-data-retired';

/**
 * Bumped whenever the persisted shape changes; see `migrate`.
 *
 * 1 → bare `Course[]` using "component" wording, `grade` as a percentage.
 * 2 → `{ version, courses }` with breakdown wording and marks out of full marks.
 * 3 → adds `fullCreditGrade`.
 * 4 → adds `semester` on each course.
 * 5 → adds a `semesters` list to the envelope and `isBonus` on each breakdown.
 * 6 → adds `equalWeightSubBreakdowns` on each breakdown.
 */
export const SCHEMA_VERSION = 6;

interface StoredData {
  version: number;
  courses: Course[];
  /** Added in version 5; absent in anything older, which reads as "none saved". */
  semesters?: string[];
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
        isBonus: false,
        equalWeightSubBreakdowns: false,
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
      // Breakdowns saved before bonus existed all counted towards the 100%.
      isBonus: breakdown.isBonus ?? false,
      // Likewise, anything saved before equal weighting existed was totalled by
      // marks, so it has to keep being totalled by marks.
      equalWeightSubBreakdowns: breakdown.equalWeightSubBreakdowns ?? false,
      subBreakdowns: (breakdown.subBreakdowns ?? []).map(sub => ({
        ...sub,
        fullMarks: sub.fullMarks ?? null,
      })),
    })),
  }));
}

/** The saved semester list, or none for data written before it existed. */
function readSemesters(raw: unknown): string[] {
  if (raw === null || typeof raw !== 'object') return [];
  const { semesters } = raw as StoredData;
  return Array.isArray(semesters) ? semesters.filter(s => typeof s === 'string') : [];
}

/**
 * Accepts the current envelope, an older envelope, or bare v1 data.
 *
 * Anything from before version 5 has no semester list, which is not a loss: the
 * semesters those courses name are folded back in by `persistedSemesters` when
 * the store takes the data on.
 */
export function migrate(raw: unknown): GradeData {
  const semesters = readSemesters(raw);

  if (isLegacy(raw)) return { courses: normalizeCourses(migrateLegacy(raw)), semesters };

  if (raw !== null && typeof raw === 'object' && 'courses' in raw) {
    const stored = raw as StoredData;
    return {
      courses: Array.isArray(stored.courses) ? normalizeCourses(stored.courses) : [],
      semesters,
    };
  }

  // An empty v1 array, or anything unrecognisable.
  return { courses: Array.isArray(raw) ? normalizeCourses(raw as Course[]) : [], semesters };
}

/**
 * Browser-backed storage. Both operations degrade to a console error rather
 * than throwing — private browsing and quota limits are expected conditions,
 * and losing persistence should not take the app down with it.
 */
export const localCourseStorage: CourseStorage = {
  async load(): Promise<GradeData> {
    return readLocalData();
  },

  async save({ courses, semesters }: GradeData): Promise<void> {
    try {
      const payload: StoredData = { version: SCHEMA_VERSION, courses, semesters };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  },
};

/**
 * The browser's saved data, read synchronously.
 *
 * Separate from `localCourseStorage.load` because the sign-in flow asks "is
 * there anything here worth importing?" as a plain question, and awaiting a
 * promise to answer it would only obscure that this never touches the network.
 */
export function readLocalData(): GradeData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return migrate(JSON.parse(saved));
  } catch (error) {
    console.error('Failed to load saved data:', error);
  }
  return EMPTY_GRADE_DATA;
}

/** Whether the browser holds data from before this app had accounts. */
export function hasLocalData(): boolean {
  const { courses, semesters } = readLocalData();
  return courses.length > 0 || semesters.length > 0;
}

/**
 * Ends the one-time migration out of browser storage, for good.
 *
 * The saved payload predates accounts, so it belongs to no user in particular:
 * leaving it in place after the offer is answered means the next student to sign
 * in on this browser is offered someone else's courses. Retiring it is what
 * stops the question being asked a second time.
 *
 * Idempotent, and silent on failure — the only cost of not retiring is being
 * asked again, which is not worth taking the app down for.
 */
export function retireLocalData(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return;

    try {
      localStorage.setItem(RETIRED_STORAGE_KEY, saved);
    } catch {
      // Out of quota, most likely. Keeping a recoverable copy is a courtesy;
      // being asked the same question forever is not, so the removal below
      // happens either way.
    }

    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to retire pre-account data:', error);
  }
}
