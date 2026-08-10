import { Course, Term } from '@/types/grades';

/**
 * Semesters, stored on each course as a label like `"2026 Summer Term 2"`.
 *
 * There is no separate semester record: a semester exists because a course
 * says it belongs to one. That keeps the saved file exactly as specified —
 * one `"semester"` key per course — at the cost of an empty semester not
 * surviving a reload, since nothing anchors it.
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
 * The semesters to show: those in use, plus any added this session that have no
 * courses yet, so a freshly created semester is selectable straight away.
 */
export function visibleSemesters(courses: Course[], pending: string[]): string[] {
  const all = new Set([...semestersFromCourses(courses), ...pending]);
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
 * Year choices for the dialog: a few back for finished courses, a couple ahead
 * for planning. Takes the reference year so it stays pure and testable.
 */
export function semesterYearOptions(referenceYear: number): number[] {
  const years: number[] = [];
  for (let year = referenceYear + 1; year >= referenceYear - 5; year--) years.push(year);
  return years;
}
