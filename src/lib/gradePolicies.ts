import { AdvancedOption, Component } from '@/types/grades';
import { clamp } from '@/lib/utils';

/**
 * The optional grading policies a component can apply to its sub-component
 * grades, and the rules governing which one is active.
 *
 * These are domain rules, not UI state: `AdvancedOptions` renders them, but the
 * store persists only the underlying fields and derives the mode from those.
 */

export const DEFAULT_DROP_LOWEST_COUNT = 1;
export const DEFAULT_DOWNWEIGHT_COUNT = 1;
export const DEFAULT_DOWNWEIGHT_PERCENT = 50;

const PERCENT_MIN = 0;
const PERCENT_MAX = 100;

/** Constrains a downweight percentage to `[0, 100]`. */
export function clampPercent(value: number): number {
  return clamp(value, PERCENT_MIN, PERCENT_MAX);
}

/**
 * Which policy a component is configured for, derived from field nullability.
 *
 * The two policies are mutually exclusive; drop wins if both are somehow set,
 * matching the precedence in `calculateComponentGrade`.
 */
export function getActiveAdvancedOption(component: Component): AdvancedOption {
  if (component.dropLowestCount !== null) return 'dropLowest';
  if (component.downweightLowestCount !== null) return 'downweight';
  return 'none';
}

/**
 * The field changes that switch a component to `option`, clearing whichever
 * policy it replaces. Keeps mutual exclusivity out of the toggle handlers.
 */
export function advancedOptionUpdate(option: AdvancedOption): Partial<Component> {
  switch (option) {
    case 'dropLowest':
      return {
        dropLowestCount: DEFAULT_DROP_LOWEST_COUNT,
        downweightLowestCount: null,
        downweightPercent: null,
      };
    case 'downweight':
      return {
        dropLowestCount: null,
        downweightLowestCount: DEFAULT_DOWNWEIGHT_COUNT,
        downweightPercent: DEFAULT_DOWNWEIGHT_PERCENT,
      };
    case 'none':
      return {
        dropLowestCount: null,
        downweightLowestCount: null,
        downweightPercent: null,
      };
  }
}

const mean = (grades: number[]): number =>
  grades.reduce((sum, grade) => sum + grade, 0) / grades.length;

/**
 * Mean of `sortedGrades` after excluding the `count` lowest.
 *
 * At least one grade always survives, so a count larger than the number of
 * grades keeps the single highest rather than dropping everything.
 */
export function applyDropLowest(sortedGrades: number[], count: number): number {
  const dropCount = Math.min(count, sortedGrades.length - 1);
  return mean(sortedGrades.slice(dropCount));
}

/**
 * Weighted mean where the `count` lowest grades each count for `1 - percent/100`
 * of a normal grade.
 *
 * Returns `null` in the degenerate case where every grade is discounted to zero
 * weight (`count` covers all grades at 100%) and there is nothing left to average.
 */
export function applyDownweightLowest(
  sortedGrades: number[],
  count: number,
  percent: number
): number | null {
  const multiplier = 1 - percent / 100;

  let weightedSum = 0;
  let totalWeight = 0;

  sortedGrades.forEach((grade, index) => {
    const weight = index < count ? multiplier : 1;
    weightedSum += grade * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}
