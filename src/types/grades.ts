export interface SubBreakdown {
  id: string;
  breakdownId: string;
  name: string;
  /** Marks the student scored. `null` means not yet entered — never treat as 0. */
  achievedMarks: number | null;
  /** What this item was out of. Defaults to 100, so a bare percentage still works. */
  fullMarks: number;
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
