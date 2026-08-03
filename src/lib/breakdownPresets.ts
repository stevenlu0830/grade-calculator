/**
 * The breakdown types offered when adding a breakdown.
 *
 * Each preset carries an explicit `singular`, used to auto-name sub-breakdowns
 * ("Assignments" → "Assignment 1"). Spelled out rather than derived, because
 * de-pluralising English by rule mangles cases like Quizzes and WebWorks.
 */
export interface BreakdownPreset {
  label: string;
  singular: string;
}

/**
 * Kept in ascending alphabetical order, case-insensitively — so iClickers sits
 * between Final Exam and In-class Exercises rather than after WebWorks, where a
 * raw ASCII sort would put it. A test enforces this as presets are added.
 * "Others (Specify)" is rendered last by the dialog, outside this list.
 */
export const BREAKDOWN_PRESETS: readonly BreakdownPreset[] = [
  { label: 'Assignments', singular: 'Assignment' },
  { label: 'Final Exam', singular: 'Final Exam' },
  { label: 'iClickers', singular: 'iClicker' },
  { label: 'In-class Exercises', singular: 'In-class Exercise' },
  { label: 'Labs', singular: 'Lab' },
  { label: 'Midterms', singular: 'Midterm' },
  { label: 'Project Phases', singular: 'Project Phase' },
  { label: 'Quizzes', singular: 'Quiz' },
  { label: 'Tests', singular: 'Test' },
  { label: 'Tutorials', singular: 'Tutorial' },
  { label: 'WebWorks', singular: 'WebWork' },
] as const;

/** Sentinel for the "Others (Specify)" choice, which takes a free-text name. */
export const OTHER_BREAKDOWN = 'other';

/** A custom name is its own singular — there's no safe way to guess one. */
export function presetFor(label: string): BreakdownPreset {
  return BREAKDOWN_PRESETS.find(p => p.label === label) ?? { label, singular: label };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The next auto-name for a sub-breakdown: `<label> <n>`.
 *
 * `n` continues past the highest number already used rather than counting rows,
 * so deleting "Assignment 2" of three doesn't make the next one collide.
 */
export function nextSubBreakdownName(label: string, existingNames: string[]): string {
  const pattern = new RegExp(`^${escapeRegExp(label)}\\s+(\\d+)$`);
  const used = existingNames.map(name => Number(name.match(pattern)?.[1] ?? 0));
  return `${label} ${Math.max(0, ...used) + 1}`;
}
