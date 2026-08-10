import { describe, it, expect } from 'vitest';
import {
  BREAKDOWN_PRESETS,
  nextSubBreakdownName,
  presetFor,
} from '@/lib/breakdownPresets';

describe('BREAKDOWN_PRESETS', () => {
  it('offers every breakdown type the dialog advertises, A-Z', () => {
    expect(BREAKDOWN_PRESETS.map(p => p.label)).toEqual([
      'Assignments',
      'Final Exam',
      'iClickers',
      'In-class Exercises',
      'Labs',
      'Midterms',
      'Participation',
      'Project Phases',
      'Quizzes',
      'Tests',
      'Tutorials',
      'WebWorks',
    ]);
  });

  it('stays sorted case-insensitively as presets are added', () => {
    const labels = BREAKDOWN_PRESETS.map(p => p.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    expect(labels).toEqual(sorted);
  });

  it('does not fall back to a raw ASCII sort, which would strand iClickers', () => {
    // 'i' (105) > 'W' (87), so a naive sort would push iClickers to the end.
    const labels = BREAKDOWN_PRESETS.map(p => p.label);
    expect(labels.indexOf('iClickers')).toBeLessThan(labels.indexOf('WebWorks'));
  });

  it('gives each preset a singular that rule-based de-pluralising would get wrong', () => {
    expect(presetFor('Quizzes').singular).toBe('Quiz');
    expect(presetFor('WebWorks').singular).toBe('WebWork');
    expect(presetFor('iClickers').singular).toBe('iClicker');
    expect(presetFor('In-class Exercises').singular).toBe('In-class Exercise');
    expect(presetFor('Project Phases').singular).toBe('Project Phase');
  });

  it('leaves an already-singular label alone', () => {
    expect(presetFor('Final Exam').singular).toBe('Final Exam');
    // A mass noun: "Participation 1" is the sensible auto-name, not "Participation".
    expect(presetFor('Participation').singular).toBe('Participation');
  });
});

describe('presetFor', () => {
  it('treats an unrecognised name as its own singular', () => {
    expect(presetFor('Reading Responses')).toEqual({
      label: 'Reading Responses',
      singular: 'Reading Responses',
    });
  });
});

describe('nextSubBreakdownName', () => {
  it('starts at 1', () => {
    expect(nextSubBreakdownName('Assignment', [])).toBe('Assignment 1');
  });

  it('continues the sequence', () => {
    expect(nextSubBreakdownName('Assignment', ['Assignment 1', 'Assignment 2'])).toBe(
      'Assignment 3'
    );
  });

  it('does not collide after a middle row is deleted', () => {
    // Counting rows would give "Assignment 3", duplicating the existing one.
    expect(nextSubBreakdownName('Assignment', ['Assignment 1', 'Assignment 3'])).toBe(
      'Assignment 4'
    );
  });

  it('ignores renamed rows that no longer match the pattern', () => {
    expect(nextSubBreakdownName('Assignment', ['Take-home essay', 'Assignment 2'])).toBe(
      'Assignment 3'
    );
  });

  it('ignores near-misses rather than mis-parsing them', () => {
    expect(nextSubBreakdownName('Lab', ['Lab 2b', 'Lab'])).toBe('Lab 1');
  });

  it('handles labels containing regex metacharacters', () => {
    expect(nextSubBreakdownName('Quiz (extra)', ['Quiz (extra) 2'])).toBe('Quiz (extra) 3');
  });
});
