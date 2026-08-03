import { Breakdown, SubBreakdown } from '@/types/grades';
import { clamp } from '@/lib/utils';
import {
  MarkPair,
  applyDownweightLowest,
  applyDropLowest,
  getActiveAdvancedOption,
  sortByPercentage,
  totalPercentage,
} from '@/lib/gradePolicies';

/**
 * Pure grade arithmetic. Nothing here knows about React or how a grade is
 * displayed — see `gradeFormatting.ts` for that.
 */

export const PERCENTAGE_MIN = 0;
export const PERCENTAGE_MAX = 100;

/** What a sub-breakdown is out of unless the student says otherwise. */
export const DEFAULT_FULL_MARKS = 100;

/** Breakdown weights must add up to this for a course to have a final grade. */
export const REQUIRED_TOTAL_WEIGHT = 100;

/**
 * Tolerance for the total-weight check, sized to absorb floating-point error
 * and nothing more. Summing decimal weights drifts by ~1e-14 — for instance
 * 0.01 + 64.04 + 35.95 evaluates to 100.00000000000001 — which an exact
 * comparison would reject, silently hiding the final grade.
 *
 * Weights that genuinely fall short (33.33 x 3 = 99.99) still fail, so the
 * warning keeps telling students their weights don't add up.
 */
const WEIGHT_TOLERANCE = 1e-9;

/** Constrains a percentage to the valid `[0, 100]` range. */
export function clampPercentage(value: number): number {
  return clamp(value, PERCENTAGE_MIN, PERCENTAGE_MAX);
}

/** Marks can't be negative, and you can't score more than the paper is worth. */
export function clampAchievedMarks(value: number, fullMarks: number): number {
  return clamp(value, 0, Math.max(0, fullMarks));
}

/**
 * The scored items among `subBreakdowns`.
 *
 * Skips anything ungraded, and anything out of zero marks — an item worth
 * nothing can't contribute a score and would only risk dividing by zero.
 */
export function getEnteredMarks(subBreakdowns: SubBreakdown[]): MarkPair[] {
  return subBreakdowns
    .filter(sb => sb.achievedMarks !== null && sb.fullMarks > 0)
    .map(sb => ({ achieved: sb.achievedMarks as number, full: sb.fullMarks }));
}

/**
 * A breakdown's grade: total marks achieved over total marks available, as a
 * percentage, after applying whichever advanced policy is active.
 *
 * Returns `null` when nothing has been graded yet, so an empty breakdown
 * propagates as "no grade" rather than as a zero.
 */
export function calculateBreakdownGrade(breakdown: Breakdown): number | null {
  const pairs = getEnteredMarks(breakdown.subBreakdowns);

  if (pairs.length === 0) return null;

  // A single score can be neither dropped nor meaningfully downweighted.
  if (pairs.length === 1) return totalPercentage(pairs);

  const sorted = sortByPercentage(pairs);

  switch (getActiveAdvancedOption(breakdown)) {
    case 'dropLowest':
      return applyDropLowest(sorted, breakdown.dropLowestCount ?? 0);
    case 'downweight':
      return applyDownweightLowest(
        sorted,
        breakdown.downweightLowestCount ?? 0,
        breakdown.downweightPercent ?? 0
      );
    case 'none':
      return totalPercentage(sorted);
  }
}

/** The points a breakdown contributes to its course total. */
export function calculateWeightedValue(breakdown: Breakdown): number | null {
  const grade = calculateBreakdownGrade(breakdown);
  if (grade === null || breakdown.weight === null) return null;
  return (grade * breakdown.weight) / 100;
}

/**
 * A course's grade: the sum of its breakdowns' weighted contributions.
 *
 * Breakdowns without a grade or without a weight are skipped, and the result is
 * `null` if none qualify. This does not check that the weights add up — callers
 * gate on `areWeightsValid` first.
 */
export function calculateCourseGrade(breakdowns: Breakdown[]): number | null {
  let total = 0;
  let hasAnyGrade = false;

  for (const breakdown of breakdowns) {
    const weightedValue = calculateWeightedValue(breakdown);
    if (weightedValue !== null) {
      total += weightedValue;
      hasAnyGrade = true;
    }
  }

  return hasAnyGrade ? total : null;
}

/** Sum of the breakdown weights, counting an unset weight as zero. */
export function getTotalWeight(breakdowns: Breakdown[]): number {
  return breakdowns.reduce((sum, b) => sum + (b.weight || 0), 0);
}

/**
 * Whether a course's weights add up, within tolerance, to a full 100%.
 *
 * The single gate for showing a final grade — used by the course card and by
 * the PDF report so the two can never disagree.
 */
export function areWeightsValid(breakdowns: Breakdown[]): boolean {
  return Math.abs(getTotalWeight(breakdowns) - REQUIRED_TOTAL_WEIGHT) < WEIGHT_TOLERANCE;
}
