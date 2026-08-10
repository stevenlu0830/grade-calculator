import { Course, Term } from '@/types/grades';

/**
 * Semesters, stored on each course as a label like `"2026 Summer Term 2"`, and
 * also as an explicit list alongside the courses.
 *
 * The list is what lets a semester with no courses in it survive a save and
 * reload — nothing else would anchor it. Courses still carry their own label, so
 * the two can disagree: a course can name a semester the list has never heard
 * of (older saves, hand-edited files). `visibleSemesters` unions both, and
 * `persistedSemesters` folds the courses' labels back into the list, so the
 * disagreement heals on the next load rather than losing a semester.
 */

/**
 * UBC's four terms, in the order they occur within an academic year.
 *
 * Winter Term 1 starts in September, Winter Term 2 in January, then the two
 * summer terms — so this order is chronological, not alphabetical.
 */
export const TERMS: readonly Term[] = [
  'Winter Term 1',
  'Winter Term 2',
  'Summer Term 1',
  'Summer Term 2',
] as const;

/** Courses carried over from before semesters existed. */
export const UNASSIGNED_SEMESTER = '';
export const UNASSIGNED_SEMESTER_LABEL = 'Unassigned';

export interface Semester {
  year: number;
  term: Term;
}

/** `2026` + `Summer Term 2` → `"2026 Summer Term 2"`. */
export function formatSemester(year: number, term: Term): string {
  return `${year} ${term}`;
}

/** The inverse, or `null` for anything that isn't a semester label. */
export function parseSemester(label: string): Semester | null {
  const match = /^(\d{4})\s+(.+)$/.exec(label.trim());
  if (!match) return null;

  const term = TERMS.find(candidate => candidate === match[2]);
  return term ? { year: Number(match[1]), term } : null;
}

/**
 * Most recent first, which is what a student wants at the top of the panel.
 *
 * Unparseable labels — including the unassigned empty string — sort last, so
 * legacy courses sit at the bottom rather than jumping to the top.
 */
export function compareSemestersDescending(a: string, b: string): number {
  const left = parseSemester(a);
  const right = parseSemester(b);

  if (!left && !right) return a.localeCompare(b);
  if (!left) return 1;
  if (!right) return -1;

  if (left.year !== right.year) return right.year - left.year;
  return TERMS.indexOf(right.term) - TERMS.indexOf(left.term);
}

/** Every semester any course belongs to, most recent first. */
export function semestersFromCourses(courses: Course[]): string[] {
  const seen = new Set(courses.map(course => course.semester ?? UNASSIGNED_SEMESTER));
  return [...seen].sort(compareSemestersDescending);
}

/**
 * The semesters to show: those in use, plus every one on the saved list, so a
 * semester stays put after its last course is deleted — or before its first one
 * is added.
 */
export function visibleSemesters(courses: Course[], semesters: string[]): string[] {
  const all = new Set([...semestersFromCourses(courses), ...semesters]);
  return [...all].sort(compareSemestersDescending);
}

/**
 * The semester list to store: everything explicitly on it, plus every semester
 * a course names, so nothing visible is lost on the next load.
 *
 * The unassigned bucket is deliberately excluded — it isn't a semester anyone
 * created, it's where courses with no semester show up, so it should vanish
 * once none are left.
 */
export function persistedSemesters(courses: Course[], semesters: string[]): string[] {
  const all = new Set([...semesters, ...semestersFromCourses(courses)]);
  all.delete(UNASSIGNED_SEMESTER);
  return [...all].sort(compareSemestersDescending);
}

export function countCoursesIn(courses: Course[], semester: string): number {
  return courses.filter(course => (course.semester ?? UNASSIGNED_SEMESTER) === semester).length;
}

export function coursesIn(courses: Course[], semester: string): Course[] {
  return courses.filter(course => (course.semester ?? UNASSIGNED_SEMESTER) === semester);
}

/** What to show in the panel; the unassigned bucket needs a readable name. */
export function semesterLabel(semester: string): string {
  return semester === UNASSIGNED_SEMESTER ? UNASSIGNED_SEMESTER_LABEL : semester;
}

/**
 * The compact form of each term. Spelled out rather than derived from the
 * words, so a term whose name doesn't start with its season still gets a
 * sensible abbreviation. A test keeps this exhaustive over `TERMS`.
 */
const TERM_ABBREVIATIONS: Record<Term, string> = {
  'Winter Term 1': 'W1',
  'Winter Term 2': 'W2',
  'Summer Term 1': 'S1',
  'Summer Term 2': 'S2',
};

/**
 * `"2023 Winter Term 1"` → `"2023W1"`, for the semester panel, where the full
 * label was wide enough to be truncated into uselessness ("2023 Winter Te…").
 *
 * Only ever a display shorthand — nothing parses it back, and the full label is
 * what's stored and what every other surface shows. Anything that isn't a
 * semester (the unassigned bucket, a hand-edited label) is left as it reads.
 */
export function shortSemesterLabel(semester: string): string {
  const parsed = parseSemester(semester);
  return parsed ? `${parsed.year}${TERM_ABBREVIATIONS[parsed.term]}` : semesterLabel(semester);
}

/**
 * Year choices for the dialog: a few back for finished courses, a couple ahead
 * for planning. Takes the reference year so it stays pure and testable.
 */
export function semesterYearOptions(referenceYear: number): number[] {
  const years: number[] = [];
  for (let year = referenceYear + 1; year >= referenceYear - 5; year--) years.push(year);
  return years;
}
