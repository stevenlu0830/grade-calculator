import { AdvancedOption, Breakdown } from '@/types/grades';
import { clamp } from '@/lib/utils';

/**
 * The optional grading policies a breakdown can apply to its sub-breakdowns,
 * and the rules governing which one is active.
 *
 * These are domain rules, not UI state: `AdvancedOptions` renders them, but the
 * store persists only the underlying fields and derives the mode from those.
 */

/** One graded item: marks scored out of marks available. */
export interface MarkPair {
  achieved: number;
  full: number;
}

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
 * Which policy a breakdown is configured for, derived from field nullability.
 *
 * The two policies are mutually exclusive; drop wins if both are somehow set,
 * matching the precedence in `calculateBreakdownGrade`.
 */
export function getActiveAdvancedOption(breakdown: Breakdown): AdvancedOption {
  if (breakdown.dropLowestCount !== null) return 'dropLowest';
  if (breakdown.downweightLowestCount !== null) return 'downweight';
  return 'none';
}

/**
 * The field changes that switch a breakdown to `option`, clearing whichever
 * policy it replaces. Keeps mutual exclusivity out of the toggle handlers.
 */
export function advancedOptionUpdate(option: AdvancedOption): Partial<Breakdown> {
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

/** A single item's score as a percentage, used only for ranking. */
export const percentageOf = (pair: MarkPair): number => (pair.achieved / pair.full) * 100;

/** Worst-scoring first, by percentage — so 4/10 ranks below 15/20. */
export function sortByPercentage(pairs: MarkPair[]): MarkPair[] {
  return [...pairs].sort((a, b) => percentageOf(a) - percentageOf(b));
}

/**
 * Marks totalled across `pairs`, as a percentage of the marks available.
 *
 * This is the core of the marks-based model: a 45/50 test counts for five times
 * as much as a 9/10 quiz, rather than both being averaged as 90%.
 * Returns `null` when no marks are available to divide by.
 */
export function totalPercentage(pairs: MarkPair[]): number | null {
  const achieved = pairs.reduce((sum, p) => sum + p.achieved, 0);
  const full = pairs.reduce((sum, p) => sum + p.full, 0);
  return full > 0 ? (achieved / full) * 100 : null;
}

/**
 * Total percentage after excluding the `count` worst-scoring items.
 *
 * A dropped item's marks leave both sides of the fraction, so dropping a 0/20
 * genuinely removes those 20 marks from the total. At least one item always
 * survives, so a count larger than the list keeps the single best score.
 */
export function applyDropLowest(sortedPairs: MarkPair[], count: number): number | null {
  const dropCount = Math.min(count, sortedPairs.length - 1);
  return totalPercentage(sortedPairs.slice(dropCount));
}

/**
 * Total percentage where the `count` worst-scoring items count for
 * `1 - percent/100` of their marks — on both sides of the fraction, so a
 * downweighted item shrinks rather than distorting the result.
 *
 * Returns `null` when every item is discounted to zero weight and no marks
 * remain to divide by.
 */
export function applyDownweightLowest(
  sortedPairs: MarkPair[],
  count: number,
  percent: number
): number | null {
  const multiplier = 1 - percent / 100;

  return totalPercentage(
    sortedPairs.map((pair, index) => {
      const weight = index < count ? multiplier : 1;
      return { achieved: pair.achieved * weight, full: pair.full * weight };
    })
  );
}
