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

export const BREAKDOWN_PRESETS: readonly BreakdownPreset[] = [
  { label: 'Assignments', singular: 'Assignment' },
  { label: 'Tests', singular: 'Test' },
  { label: 'Final Exam', singular: 'Final Exam' },
  { label: 'Quizzes', singular: 'Quiz' },
  { label: 'Midterms', singular: 'Midterm' },
  { label: 'iClickers', singular: 'iClicker' },
  { label: 'In-class Exercises', singular: 'In-class Exercise' },
  { label: 'Tutorials', singular: 'Tutorial' },
  { label: 'Project Phases', singular: 'Project Phase' },
  { label: 'WebWorks', singular: 'WebWork' },
  { label: 'Labs', singular: 'Lab' },
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
