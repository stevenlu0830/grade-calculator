export interface SubBreakdown {
  id: string;
  breakdownId: string;
  name: string;
  /** Marks the student scored. `null` means not yet entered — never treat as 0. */
  achievedMarks: number | null;
  /**
   * What this item was out of. `null` until the student fills it in; a row with
   * no full marks can't contribute a score, so it's excluded from the totals.
   * Marks are never clamped against it — bonus marks above full are allowed.
   */
  fullMarks: number | null;
}

export interface Breakdown {
  id: string;
  courseId: string;
  name: string;
  weight: number | null;
  dropLowestCount: number | null;
  downweightLowestCount: number | null;
  downweightPercent: number | null;
  /**
   * The percentage that earns full credit, 0–100. `null` when unused.
   *
   * Independent of drop/downweight: those decide which marks count, this scales
   * the percentage they produce.
   */
  fullCreditGrade: number | null;
  /**
   * Whether this is extra credit: its weight is added on top of the course
   * rather than being part of the 100% available.
   *
   * A 5% bonus breakdown contributes up to 5 points to the final grade, but the
   * other breakdowns must still total 100% on their own.
   */
  isBonus: boolean;
  /** Singular noun used to auto-name new sub-breakdowns, e.g. "Assignment" → "Assignment 3". */
  subBreakdownLabel: string;
  subBreakdowns: SubBreakdown[];
}

/** UBC's four terms. See `TERMS` in `semesters.ts` for their ordering. */
export type Term = 'Winter Term 1' | 'Winter Term 2' | 'Summer Term 1' | 'Summer Term 2';

export interface Course {
  id: string;
  name: string;
  /**
   * The semester this course belongs to, as a label like `"2026 Summer Term 2"`.
   *
   * An empty string means unassigned — courses saved before semesters existed.
   */
  semester: string;
  breakdowns: Breakdown[];
}

/**
 * Everything the app persists.
 *
 * `semesters` is stored alongside the courses rather than derived from them, so
 * a semester with no courses yet survives a save and reload. The order of
 * `courses` is meaningful: it's the order they're shown in, and saving and
 * reloading preserves it.
 */
export interface GradeData {
  courses: Course[];
  semesters: string[];
}

export type AdvancedOption = 'none' | 'dropLowest' | 'downweight';
