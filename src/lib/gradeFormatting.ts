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
 * The UBC letter scale, highest band first, each with the colour it's shown in.
 *
 * Letter and colour are one table on purpose: the colour *is* the letter's, so a
 * grade can never be lettered A- and coloured as something else. Several letters
 * deliberately share a colour — the B and C bands each get one — so the colour
 * says which grade family a mark is in and the letter says where in it.
 *
 * The bands are read against the *official* grade — the percentage rounded to a
 * whole number — because that's the mark a course is recorded with. An 84.6
 * therefore grades as an A, not an A-.
 *
 * Text and background are spelled out rather than built from the token name, so
 * every class here is a literal Tailwind can find when it scans this file.
 */
const LETTER_SCALE = [
  { min: 90, letter: 'A+', text: 'text-grade-a', bg: 'bg-grade-a/10' },
  { min: 85, letter: 'A', text: 'text-grade-a', bg: 'bg-grade-a/10' },
  { min: 80, letter: 'A-', text: 'text-grade-a-minus', bg: 'bg-grade-a-minus/10' },
  { min: 76, letter: 'B+', text: 'text-grade-b', bg: 'bg-grade-b/10' },
  { min: 72, letter: 'B', text: 'text-grade-b', bg: 'bg-grade-b/10' },
  { min: 68, letter: 'B-', text: 'text-grade-b', bg: 'bg-grade-b/10' },
  { min: 64, letter: 'C+', text: 'text-grade-c', bg: 'bg-grade-c/10' },
  { min: 60, letter: 'C', text: 'text-grade-c', bg: 'bg-grade-c/10' },
  { min: 55, letter: 'C-', text: 'text-grade-c', bg: 'bg-grade-c/10' },
  { min: 50, letter: 'D', text: 'text-grade-d', bg: 'bg-grade-d/10' },
] as const;

/** Below every band in the scale. */
const FAILING_BAND = { letter: 'F', text: 'text-grade-f', bg: 'bg-grade-f/10' } as const;

const NO_GRADE_BAND = { letter: NO_GRADE, text: 'text-muted-foreground', bg: 'bg-muted' } as const;

/**
 * The band a grade falls in, clamped — a bonus can push a percentage past 100,
 * and there is no band above A+ for it to land in.
 */
const bandFor = (grade: number | null) => {
  if (grade === null) return NO_GRADE_BAND;
  const clamped = clampPercentage(grade);
  return LETTER_SCALE.find(band => clamped >= band.min) ?? FAILING_BAND;
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

/**
 * A mark, as close to how it was typed as possible: "18", not "18.00".
 *
 * Marks aren't percentages — they're whatever the course marked the item out of
 * — so they don't take the fixed two decimals grades do. Trailing zeros are
 * dropped, and the six places kept are the ones a rescaled mark carries (see
 * `rescaleAchievedMarks`), so a scaled mark reads back exactly as it's stored.
 */
export function formatMarks(marks: number | null): string {
  if (marks === null) return NO_GRADE;
  return parseFloat(marks.toFixed(6)).toString();
}

/** A grade as a UBC letter, or an em dash if unentered. */
export function getLetterGrade(grade: number | null): string {
  return bandFor(grade).letter;
}

export function getGradeColor(grade: number | null): string {
  return bandFor(grade).text;
}

export function getGradeBg(grade: number | null): string {
  return bandFor(grade).bg;
}
