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
  /** Singular noun used to auto-name new sub-breakdowns, e.g. "Assignment" → "Assignment 3". */
  subBreakdownLabel: string;
  subBreakdowns: SubBreakdown[];
}

export interface Course {
  id: string;
  name: string;
  breakdowns: Breakdown[];
}

export type AdvancedOption = 'none' | 'dropLowest' | 'downweight';
