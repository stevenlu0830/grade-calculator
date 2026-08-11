import { AdvancedOption } from '@/types/grades';
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

/**
 * Just the policy fields of a breakdown.
 *
 * A `Breakdown` satisfies this structurally, so the same helpers serve both a
 * saved breakdown and the draft policy the add/edit dialogs hold before commit.
 */
export interface GradingPolicy {
  dropLowestCount: number | null;
  downweightLowestCount: number | null;
  downweightPercent: number | null;
  fullCreditGrade: number | null;
  /** Extra credit: the weight lands on top of the course's 100% rather than in it. */
  isBonus: boolean;
  /**
   * Whether every sub-breakdown counts the same, whatever it was out of.
   *
   * Off — the default — a breakdown is total marks over total marks available,
   * so a 45/50 test outweighs a 9/10 quiz. On, each item is rescaled to the same
   * size first, which is what a course means by "each assignment is worth 5% of
   * your grade" even though the assignments are marked out of different totals.
   */
  equalWeightSubBreakdowns: boolean;
}

/**
 * The mutually-exclusive pair: which marks count towards the total.
 *
 * `fullCreditGrade` is deliberately outside this group — it scales whatever
 * percentage those produce, so it composes with either of them.
 */
export type MarksPolicyFields = Pick<
  GradingPolicy,
  'dropLowestCount' | 'downweightLowestCount' | 'downweightPercent'
>;

/**
 * No policy applied — the starting point for a new breakdown.
 *
 * Frozen because it's a shared module-level value; callers that need something
 * mutable should spread it.
 */
export const NO_POLICY: GradingPolicy = Object.freeze({
  dropLowestCount: null,
  downweightLowestCount: null,
  downweightPercent: null,
  fullCreditGrade: null,
  isBonus: false,
  equalWeightSubBreakdowns: false,
});

export const DEFAULT_DROP_LOWEST_COUNT = 1;
export const DEFAULT_DOWNWEIGHT_COUNT = 1;
export const DEFAULT_DOWNWEIGHT_PERCENT = 50;
// Full credit has no default on purpose: the switch reveals an empty field so
// the student states the threshold rather than accepting a guess.

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
export function getActiveAdvancedOption(policy: GradingPolicy): AdvancedOption {
  if (policy.dropLowestCount !== null) return 'dropLowest';
  if (policy.downweightLowestCount !== null) return 'downweight';
  return 'none';
}

/**
 * The marks-selection fields for `option`, with whichever it replaces cleared.
 * Keeps mutual exclusivity out of the toggle handlers.
 *
 * Returns only the exclusive pair, so spreading it over an existing policy
 * leaves `fullCreditGrade` untouched.
 */
export function advancedOptionUpdate(option: AdvancedOption): MarksPolicyFields {
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
      // A fresh object, so callers can treat every result as their own.
      return { dropLowestCount: null, downweightLowestCount: null, downweightPercent: null };
  }
}

/**
 * Scales a breakdown percentage so that `fullCreditGrade` earns 100%.
 *
 * A course might say "80% on the iClickers earns you the full marks". With
 * `x = 80`, a raw 60% becomes `60 / 80 * 100 = 75%`, and anything at or above
 * 80% caps at full credit — which is what "or higher" means.
 *
 * `x = 0` would divide by zero; since every score already clears a threshold of
 * zero, it simply awards full credit.
 */
export function applyFullCreditGrade(
  percentage: number,
  fullCreditGrade: number | null | undefined
): number {
  if (fullCreditGrade === null || fullCreditGrade === undefined) return percentage;
  if (fullCreditGrade <= 0) return PERCENT_MAX;
  return Math.min(PERCENT_MAX, (percentage / fullCreditGrade) * PERCENT_MAX);
}

/**
 * A one-line summary of the active policy, or `null` when none applies.
 *
 * Full credit can combine with a marks policy, so parts are joined rather than
 * returned first-match-wins. Shared by the breakdown card and the PDF report so
 * the two always describe a policy the same way.
 */
export function describePolicy(policy: GradingPolicy): string | null {
  const { dropLowestCount, downweightLowestCount, downweightPercent, fullCreditGrade } = policy;
  const parts: string[] = [];

  // First, because it changes what the breakdown's weight means.
  if (policy.isBonus) parts.push('Bonus');

  // Before the marks policies, because it changes what marks they're ranking.
  if (policy.equalWeightSubBreakdowns) parts.push('Equal weight');

  if (dropLowestCount && dropLowestCount > 0) {
    parts.push(`Drop lowest ${dropLowestCount}`);
  } else if (
    downweightLowestCount &&
    downweightLowestCount > 0 &&
    downweightPercent &&
    downweightPercent > 0
  ) {
    parts.push(`Downweight lowest ${downweightLowestCount} by ${downweightPercent}%`);
  }

  if (fullCreditGrade !== null && fullCreditGrade !== undefined) {
    parts.push(`${fullCreditGrade}% for full credit`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

// --- Editing a policy -------------------------------------------------------

/**
 * A policy mid-edit, with every number held as raw text.
 *
 * A `GradingPolicy` can't represent "switched on, box currently empty" — a null
 * count *is* what "off" means — so clearing a field to retype it would silently
 * turn the option off, or snap back to a default. The draft separates the two:
 * a boolean says whether the option is on, and the text says what's in the box,
 * blank included. `policyDraftErrors` then rejects blanks at commit time.
 */
export interface PolicyDraft {
  dropLowest: boolean;
  dropLowestCount: string;
  downweight: boolean;
  downweightLowestCount: string;
  downweightPercent: string;
  fullCredit: boolean;
  fullCreditGrade: string;
  isBonus: boolean;
  equalWeight: boolean;
}

const asDraftText = (value: number | null) => (value === null ? '' : String(value));

/**
 * Seeds a draft from a saved policy.
 *
 * A switched-off option still carries its default in the box, so switching it on
 * shows a usable starting value. Full credit is the exception: it opens blank on
 * purpose, so the student states the threshold rather than accepting a guess.
 */
export function toPolicyDraft(policy: GradingPolicy): PolicyDraft {
  const option = getActiveAdvancedOption(policy);

  return {
    dropLowest: option === 'dropLowest',
    dropLowestCount: asDraftText(policy.dropLowestCount ?? DEFAULT_DROP_LOWEST_COUNT),
    downweight: option === 'downweight',
    downweightLowestCount: asDraftText(
      policy.downweightLowestCount ?? DEFAULT_DOWNWEIGHT_COUNT
    ),
    downweightPercent: asDraftText(policy.downweightPercent ?? DEFAULT_DOWNWEIGHT_PERCENT),
    fullCredit: policy.fullCreditGrade !== null,
    fullCreditGrade: asDraftText(policy.fullCreditGrade),
    isBonus: policy.isBonus,
    equalWeight: policy.equalWeightSubBreakdowns,
  };
}

/** A blank draft, for the add-breakdown dialog. */
export const NO_POLICY_DRAFT: PolicyDraft = Object.freeze(toPolicyDraft(NO_POLICY));

const isFilled = (raw: string) => raw.trim() !== '' && !Number.isNaN(Number(raw));

/**
 * The labels of any switched-on fields left empty (or unparseable).
 *
 * Empty is allowed while typing — that's the point of the draft — but not on
 * commit, so callers apply only when this comes back empty.
 */
export function policyDraftErrors(draft: PolicyDraft): string[] {
  const blank: string[] = [];

  if (draft.dropLowest && !isFilled(draft.dropLowestCount)) blank.push('Drop Lowest');
  if (draft.downweight) {
    if (!isFilled(draft.downweightLowestCount)) blank.push('Downweight (how many)');
    if (!isFilled(draft.downweightPercent)) blank.push('Downweight (by how much)');
  }
  if (draft.fullCredit && !isFilled(draft.fullCreditGrade)) blank.push('Full Credit');

  return blank;
}

/**
 * Why a draft can't be committed, or `null` when it can.
 *
 * Lives beside `describePolicy` so the two speak about options the same way.
 */
export function describeDraftErrors(blank: string[]): string | null {
  if (blank.length === 0) return null;
  const fields = blank.length === 1 ? blank[0] : `${blank.slice(0, -1).join(', ')} and ${blank.at(-1)}`;
  return `Enter a number for ${fields}. An option that's switched on can't have an empty box.`;
}

/** At least one item, whole — the counts are "how many of them", after all. */
const toCount = (raw: string, fallback: number) =>
  isFilled(raw) ? Math.max(1, Math.trunc(Number(raw))) : fallback;

const toPercent = (raw: string, fallback: number) =>
  clampPercent(isFilled(raw) ? Number(raw) : fallback);

/**
 * The committed policy for a draft.
 *
 * Clamping happens here rather than on each keystroke, so typing "100" doesn't
 * get rewritten to "10" the moment "1" and "0" have been typed. Blank fields
 * fall back to their defaults; callers reject them via `policyDraftErrors`
 * first, so that only matters for a draft applied without checking.
 */
export function policyFromDraft(draft: PolicyDraft): GradingPolicy {
  const option: AdvancedOption = draft.dropLowest
    ? 'dropLowest'
    : draft.downweight
      ? 'downweight'
      : 'none';

  // Routed through `advancedOptionUpdate`, which returns a fresh object, so
  // mutual exclusivity is enforced in exactly one place.
  const marks = advancedOptionUpdate(option);

  if (option === 'dropLowest') {
    marks.dropLowestCount = toCount(draft.dropLowestCount, DEFAULT_DROP_LOWEST_COUNT);
  } else if (option === 'downweight') {
    marks.downweightLowestCount = toCount(draft.downweightLowestCount, DEFAULT_DOWNWEIGHT_COUNT);
    marks.downweightPercent = toPercent(draft.downweightPercent, DEFAULT_DOWNWEIGHT_PERCENT);
  }

  return {
    ...marks,
    fullCreditGrade: draft.fullCredit ? toPercent(draft.fullCreditGrade, PERCENT_MAX) : null,
    isBonus: draft.isBonus,
    equalWeightSubBreakdowns: draft.equalWeight,
  };
}

// --- Mark arithmetic --------------------------------------------------------

/** A single item's score as a percentage, used only for ranking. */
export const percentageOf = (pair: MarkPair): number => (pair.achieved / pair.full) * 100;

/**
 * What each item is rescaled to be out of when they're weighted equally.
 *
 * Any shared number gives the same result; 100 is chosen because it makes the
 * intermediate marks readable as the percentages they are.
 */
export const EQUAL_WEIGHT_FULL_MARKS = 100;

/**
 * Every item rescaled to be out of the same marks, keeping its percentage.
 *
 * This is what turns total-marks arithmetic into a plain average of
 * percentages: an 18/20 and a 4/5 both become 90/100, so the 20-mark item stops
 * counting for four times as much as the 5-mark one.
 *
 * Applied before ranking and before any marks policy, so drop-lowest and
 * downweight still pick the worst *percentages* — which equalising doesn't
 * change — and then operate on items of equal size.
 */
export function equalizeWeights(pairs: MarkPair[]): MarkPair[] {
  return pairs.map(pair => ({
    achieved: (percentageOf(pair) / 100) * EQUAL_WEIGHT_FULL_MARKS,
    full: EQUAL_WEIGHT_FULL_MARKS,
  }));
}

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
