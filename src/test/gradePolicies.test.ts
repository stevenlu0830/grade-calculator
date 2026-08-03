import { describe, it, expect } from 'vitest';
import { Component } from '@/types/grades';
import {
  DEFAULT_DOWNWEIGHT_COUNT,
  DEFAULT_DOWNWEIGHT_PERCENT,
  DEFAULT_DROP_LOWEST_COUNT,
  advancedOptionUpdate,
  applyDownweightLowest,
  applyDropLowest,
  clampPercent,
  getActiveAdvancedOption,
} from '@/lib/gradePolicies';

const component = (overrides: Partial<Component> = {}): Component => ({
  id: 'c',
  courseId: 'course',
  name: '',
  weight: null,
  dropLowestCount: null,
  downweightLowestCount: null,
  downweightPercent: null,
  subComponents: [],
  ...overrides,
});

describe('getActiveAdvancedOption', () => {
  it('is none when neither policy is configured', () => {
    expect(getActiveAdvancedOption(component())).toBe('none');
  });

  it('is dropLowest when a drop count is set', () => {
    expect(getActiveAdvancedOption(component({ dropLowestCount: 1 }))).toBe('dropLowest');
  });

  it('is downweight when a downweight count is set', () => {
    expect(getActiveAdvancedOption(component({ downweightLowestCount: 2 }))).toBe('downweight');
  });

  it('treats an explicit zero as configured, not absent', () => {
    expect(getActiveAdvancedOption(component({ dropLowestCount: 0 }))).toBe('dropLowest');
  });

  it('prefers drop when both are somehow set, matching the calculator', () => {
    const both = component({ dropLowestCount: 1, downweightLowestCount: 1 });
    expect(getActiveAdvancedOption(both)).toBe('dropLowest');
  });
});

describe('advancedOptionUpdate', () => {
  it('clears the downweight fields when switching to drop', () => {
    expect(advancedOptionUpdate('dropLowest')).toEqual({
      dropLowestCount: DEFAULT_DROP_LOWEST_COUNT,
      downweightLowestCount: null,
      downweightPercent: null,
    });
  });

  it('clears the drop field when switching to downweight', () => {
    expect(advancedOptionUpdate('downweight')).toEqual({
      dropLowestCount: null,
      downweightLowestCount: DEFAULT_DOWNWEIGHT_COUNT,
      downweightPercent: DEFAULT_DOWNWEIGHT_PERCENT,
    });
  });

  it('clears everything for none', () => {
    expect(advancedOptionUpdate('none')).toEqual({
      dropLowestCount: null,
      downweightLowestCount: null,
      downweightPercent: null,
    });
  });

  it('round-trips through getActiveAdvancedOption', () => {
    for (const option of ['none', 'dropLowest', 'downweight'] as const) {
      const updated = component(advancedOptionUpdate(option));
      expect(getActiveAdvancedOption(updated)).toBe(option);
    }
  });
});

describe('applyDropLowest', () => {
  it('drops the N lowest', () => {
    expect(applyDropLowest([60, 80, 100], 1)).toBe(90);
    expect(applyDropLowest([60, 80, 100], 2)).toBe(100);
  });

  it('keeps one grade when the count exceeds the list', () => {
    expect(applyDropLowest([60, 80, 100], 99)).toBe(100);
  });

  it('is the plain mean at zero', () => {
    expect(applyDropLowest([60, 80, 100], 0)).toBe(80);
  });
});

describe('applyDownweightLowest', () => {
  it('halves the weight of the lowest grade at 50%', () => {
    expect(applyDownweightLowest([60, 80, 100], 1, 50)).toBe(84);
  });

  it('matches a plain mean at 0%', () => {
    expect(applyDownweightLowest([60, 80, 100], 1, 0)).toBe(80);
  });

  it('matches dropping at 100%', () => {
    expect(applyDownweightLowest([60, 80, 100], 1, 100)).toBe(90);
  });

  it('returns null when nothing carries any weight', () => {
    expect(applyDownweightLowest([60, 80], 2, 100)).toBeNull();
  });
});

describe('clampPercent', () => {
  it('constrains to 0-100', () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(150)).toBe(100);
  });
});
