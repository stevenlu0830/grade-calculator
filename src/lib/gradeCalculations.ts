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
 *
 * **Precision.** Every value here is a full IEEE-754 double (~15–17 significant
 * digits, far beyond the 6 decimal places required) and nothing is rounded at
 * any intermediate step: marks are summed, then divided, then weighted, all at
 * full precision. Rounding happens exactly once, at the display boundary in
 * `gradeFormatting.ts`. Never round inside this module — doing so would compound
 * error across a course's breakdowns.
 */

export const PERCENTAGE_MIN = 0;
export const PERCENTAGE_MAX = 100;

/**
 * What a mark was out of before full marks existed as a field.
 *
 * Only used when reading older data — version-1 saves and pre-`Full Marks` CSVs
 * stored plain percentages, which are marks out of 100. New rows start blank.
 */
export const LEGACY_FULL_MARKS = 100;

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

/**
 * Constrains a percentage to `[0, 100]`.
 *
 * Used only for picking a letter grade — a breakdown's own percentage is never
 * clamped, so bonus marks can legitimately push it past 100%.
 */
export function clampPercentage(value: number): number {
  return clamp(value, PERCENTAGE_MIN, PERCENTAGE_MAX);
}

/**
 * The scored items among `subBreakdowns`.
 *
 * Skips anything ungraded, anything with no full marks yet, and anything out of
 * zero marks — none of those can contribute a score, and the last would divide
 * by zero. Marks above full marks are kept as-is; that's a bonus, not an error.
 */
export function getEnteredMarks(subBreakdowns: SubBreakdown[]): MarkPair[] {
  return subBreakdowns
    .filter(sb => sb.achievedMarks !== null && sb.fullMarks !== null && sb.fullMarks > 0)
    .map(sb => ({ achieved: sb.achievedMarks as number, full: sb.fullMarks as number }));
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
