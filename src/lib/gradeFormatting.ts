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
 * The UBC letter scale, highest band first. Deliberately distinct from the
 * colour bands below — an 82 reads "good" but grades as an A-.
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

/** A grade as a fixed one-decimal string, or an em dash if unentered. */
export function formatGrade(grade: number | null): string {
  if (grade === null) return NO_GRADE;
  return grade.toFixed(1);
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
