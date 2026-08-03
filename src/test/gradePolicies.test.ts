import { describe, it, expect } from 'vitest';
import { Breakdown } from '@/types/grades';
import {
  DEFAULT_DOWNWEIGHT_COUNT,
  DEFAULT_DOWNWEIGHT_PERCENT,
  DEFAULT_DROP_LOWEST_COUNT,
  MarkPair,
  advancedOptionUpdate,
  applyDownweightLowest,
  applyDropLowest,
  clampPercent,
  getActiveAdvancedOption,
  sortByPercentage,
  totalPercentage,
} from '@/lib/gradePolicies';

const breakdown = (overrides: Partial<Breakdown> = {}): Breakdown => ({
  id: 'b',
  courseId: 'course',
  name: '',
  weight: null,
  dropLowestCount: null,
  downweightLowestCount: null,
  downweightPercent: null,
  subBreakdownLabel: 'Item',
  subBreakdowns: [],
  ...overrides,
});

/** `[achieved, full]` pairs, for brevity. */
const pairs = (...entries: [number, number][]): MarkPair[] =>
  entries.map(([achieved, full]) => ({ achieved, full }));

describe('getActiveAdvancedOption', () => {
  it('is none when neither policy is configured', () => {
    expect(getActiveAdvancedOption(breakdown())).toBe('none');
  });

  it('is dropLowest when a drop count is set', () => {
    expect(getActiveAdvancedOption(breakdown({ dropLowestCount: 1 }))).toBe('dropLowest');
  });

  it('is downweight when a downweight count is set', () => {
    expect(getActiveAdvancedOption(breakdown({ downweightLowestCount: 2 }))).toBe('downweight');
  });

  it('treats an explicit zero as configured, not absent', () => {
    expect(getActiveAdvancedOption(breakdown({ dropLowestCount: 0 }))).toBe('dropLowest');
  });

  it('prefers drop when both are somehow set, matching the calculator', () => {
    const both = breakdown({ dropLowestCount: 1, downweightLowestCount: 1 });
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
      expect(getActiveAdvancedOption(breakdown(advancedOptionUpdate(option)))).toBe(option);
    }
  });
});

describe('sortByPercentage', () => {
  it('orders worst-scoring first regardless of marks available', () => {
    const sorted = sortByPercentage(pairs([15, 20], [4, 10], [9, 10]));
    expect(sorted).toEqual(pairs([4, 10], [15, 20], [9, 10]));
  });

  it('does not mutate its input', () => {
    const original = pairs([9, 10], [4, 10]);
    sortByPercentage(original);
    expect(original).toEqual(pairs([9, 10], [4, 10]));
  });
});

describe('totalPercentage', () => {
  it('divides summed marks by summed availability', () => {
    expect(totalPercentage(pairs([18, 20], [27, 30]))).toBe(90);
  });

  it('returns null when no marks are available', () => {
    expect(totalPercentage([])).toBeNull();
    expect(totalPercentage(pairs([0, 0]))).toBeNull();
  });
});

describe('applyDropLowest', () => {
  it('drops the N worst and their marks availability', () => {
    const sorted = sortByPercentage(pairs([0, 20], [10, 10]));
    expect(applyDropLowest(sorted, 1)).toBe(100);
  });

  it('keeps one row when the count exceeds the list', () => {
    const sorted = sortByPercentage(pairs([4, 10], [8, 10], [10, 10]));
    expect(applyDropLowest(sorted, 99)).toBe(100);
  });

  it('is the plain total at zero', () => {
    const sorted = sortByPercentage(pairs([6, 10], [10, 10]));
    expect(applyDropLowest(sorted, 0)).toBe(80);
  });
});

describe('applyDownweightLowest', () => {
  const sorted = sortByPercentage(pairs([6, 10], [10, 10]));

  it('halves the lowest row on both sides of the fraction at 50%', () => {
    expect(applyDownweightLowest(sorted, 1, 50)).toBeCloseTo(86.666, 2);
  });

  it('matches a plain total at 0%', () => {
    expect(applyDownweightLowest(sorted, 1, 0)).toBe(80);
  });

  it('matches dropping at 100%', () => {
    expect(applyDownweightLowest(sorted, 1, 100)).toBe(100);
  });

  it('returns null when nothing carries any weight', () => {
    expect(applyDownweightLowest(sorted, 2, 100)).toBeNull();
  });
});

describe('clampPercent', () => {
  it('constrains to 0-100', () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(150)).toBe(100);
  });
});
