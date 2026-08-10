import { clampPercentage } from '@/lib/gradeCalculations';

/**
 * How a grade is rendered: text, letter, and colour.
 *
 * Separated from `gradeCalculations.ts` so the arithmetic has no opinion about
 * Tailwind classes, and so restyling never risks touching the maths.
 */

/** Shown wherever a grade has not been entered. */
export const NO_GRADE = '—';

/**
 * Decimal places shown in the UI.
 *
 * This is the *only* place grades get rounded — every calculation upstream runs
 * at full double precision (see `gradeCalculations.ts`). Because each number is
 * rounded independently for display, a column of them may not visibly add up to
 * its total; the UI carries a note saying so.
 */
export const DISPLAY_DECIMALS = 2;

/**
 * The UBC letter scale, highest band first. Deliberately distinct from the
 * colour bands below — an 82 reads "good" but grades as an A-.
 *
 * The bands are read against the *official* grade — the percentage rounded to a
 * whole number — because that's the mark a course is recorded with. An 84.6
 * therefore grades as an A, not an A-.
 */
const LETTER_SCALE = [
  { min: 90, letter: 'A+' },
  { min: 85, letter: 'A' },
  { min: 80, letter: 'A-' },
  { min: 76, letter: 'B+' },
  { min: 72, letter: 'B' },
  { min: 68, letter: 'B-' },
  { min: 64, letter: 'C+' },
  { min: 60, letter: 'C' },
  { min: 55, letter: 'C-' },
  { min: 50, letter: 'D' },
] as const;

const FAILING_LETTER = 'F';

/** Colour bands, highest first. Text and background are paired so they can't drift. */
const COLOUR_BANDS = [
  { min: 90, text: 'text-grade-excellent', bg: 'bg-grade-excellent/10' },
  { min: 80, text: 'text-grade-good', bg: 'bg-grade-good/10' },
  { min: 70, text: 'text-grade-average', bg: 'bg-grade-average/10' },
  { min: 60, text: 'text-grade-passing', bg: 'bg-grade-passing/10' },
] as const;

const FAILING_BAND = { text: 'text-grade-failing', bg: 'bg-grade-failing/10' } as const;
const NO_GRADE_BAND = { text: 'text-muted-foreground', bg: 'bg-muted' } as const;

const bandFor = (grade: number | null) => {
  if (grade === null) return NO_GRADE_BAND;
  return COLOUR_BANDS.find(band => grade >= band.min) ?? FAILING_BAND;
};

/** A grade rounded to `DISPLAY_DECIMALS`, or an em dash if unentered. */
export function formatGrade(grade: number | null): string {
  if (grade === null) return NO_GRADE;
  return grade.toFixed(DISPLAY_DECIMALS);
}

/**
 * The grade a course is officially recorded with: the calculated percentage
 * rounded to a whole number, half up.
 *
 * The letter scale is read against this rather than the exact percentage, so an
 * 84.6 is an A. Both figures are shown side by side — the exact one explains
 * where the official one came from.
 */
export function toOfficialGrade(grade: number | null): number | null {
  return grade === null ? null : Math.round(grade);
}

/** The official grade as a whole number, or an em dash if unentered. */
export function formatOfficialGrade(grade: number | null): string {
  const official = toOfficialGrade(grade);
  return official === null ? NO_GRADE : official.toFixed(0);
}

/**
 * A weight total, carrying just enough precision to show why it misses 100.
 *
 * A fixed one decimal rendered 33.33 x 3 as "100.0", so the shortfall warning
 * read "weights total 100.0%. They should sum to 100%" — which told the student
 * nothing. Trailing zeros are dropped so a clean 90 stays "90".
 */
export function formatWeight(weight: number): string {
  return parseFloat(weight.toFixed(2)).toString();
}

/** A grade as a UBC letter, or an em dash if unentered. */
export function getLetterGrade(grade: number | null): string {
  if (grade === null) return NO_GRADE;
  const clamped = clampPercentage(grade);
  return LETTER_SCALE.find(band => clamped >= band.min)?.letter ?? FAILING_LETTER;
}

export function getGradeColor(grade: number | null): string {
  return bandFor(grade).text;
}

export function getGradeBg(grade: number | null): string {
  return bandFor(grade).bg;
}
