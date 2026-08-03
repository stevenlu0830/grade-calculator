import { Component, SubComponent } from '@/types/grades';
import { clamp } from '@/lib/utils';
import {
  applyDownweightLowest,
  applyDropLowest,
  getActiveAdvancedOption,
} from '@/lib/gradePolicies';

/**
 * Pure grade arithmetic. Nothing here knows about React or how a grade is
 * displayed — see `gradeFormatting.ts` for that.
 */

export const GRADE_MIN = 0;
export const GRADE_MAX = 100;

/** Component weights must add up to this for a course to have a final grade. */
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

/** Constrains a grade to the valid `[0, 100]` range. */
export function clampGrade(value: number): number {
  return clamp(value, GRADE_MIN, GRADE_MAX);
}

/** The grades that have actually been entered; ungraded rows are excluded. */
export function calculateSubComponentGrades(subComponents: SubComponent[]): number[] {
  return subComponents
    .filter(sc => sc.grade !== null)
    .map(sc => sc.grade as number);
}

/**
 * A component's grade: the average of its entered sub-component grades, after
 * applying whichever advanced policy is active.
 *
 * Returns `null` when nothing has been graded yet, so an empty component
 * propagates as "no grade" rather than as a zero.
 */
export function calculateComponentGrade(component: Component): number | null {
  const grades = calculateSubComponentGrades(component.subComponents);

  if (grades.length === 0) return null;

  // A single grade can be neither dropped nor meaningfully downweighted.
  if (grades.length === 1) return grades[0];

  const sortedGrades = [...grades].sort((a, b) => a - b);

  switch (getActiveAdvancedOption(component)) {
    case 'dropLowest':
      return applyDropLowest(sortedGrades, component.dropLowestCount ?? 0);
    case 'downweight':
      return applyDownweightLowest(
        sortedGrades,
        component.downweightLowestCount ?? 0,
        component.downweightPercent ?? 0
      );
    case 'none':
      return sortedGrades.reduce((sum, g) => sum + g, 0) / sortedGrades.length;
  }
}

/** The points a component contributes to its course total. */
export function calculateWeightedValue(component: Component): number | null {
  const componentGrade = calculateComponentGrade(component);
  if (componentGrade === null || component.weight === null) return null;
  return (componentGrade * component.weight) / 100;
}

/**
 * A course's grade: the sum of its components' weighted contributions.
 *
 * Components without a grade or without a weight are skipped, and the result is
 * `null` if none qualify. This does not check that the weights add up — callers
 * gate on `areWeightsValid` first.
 */
export function calculateCourseGrade(components: Component[]): number | null {
  let totalWeightedGrade = 0;
  let hasAnyGrade = false;

  for (const component of components) {
    const weightedValue = calculateWeightedValue(component);
    if (weightedValue !== null) {
      totalWeightedGrade += weightedValue;
      hasAnyGrade = true;
    }
  }

  return hasAnyGrade ? totalWeightedGrade : null;
}

/** Sum of the component weights, counting an unset weight as zero. */
export function getTotalWeight(components: Component[]): number {
  return components.reduce((sum, c) => sum + (c.weight || 0), 0);
}

/**
 * Whether a course's weights add up, within tolerance, to a full 100%.
 *
 * The single gate for showing a final grade — used by the course card and by
 * the PDF report so the two can never disagree.
 */
export function areWeightsValid(components: Component[]): boolean {
  return Math.abs(getTotalWeight(components) - REQUIRED_TOTAL_WEIGHT) < WEIGHT_TOLERANCE;
}
