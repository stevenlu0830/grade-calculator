import { describe, it, expect } from 'vitest';
import { Breakdown } from '@/types/grades';
import {
  DEFAULT_DOWNWEIGHT_COUNT,
  DEFAULT_DOWNWEIGHT_PERCENT,
  DEFAULT_DROP_LOWEST_COUNT,
  MarkPair,
  NO_POLICY,
  advancedOptionUpdate,
  applyDownweightLowest,
  applyDropLowest,
  applyFullCreditGrade,
  clampPercent,
  describePolicy,
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
  fullCreditGrade: null,
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

  it('clears only the marks fields for none, leaving full credit alone', () => {
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

  it('returns a fresh object each time, never the shared NO_POLICY', () => {
    const first = advancedOptionUpdate('none');
    const second = advancedOptionUpdate('none');
    expect(first).not.toBe(NO_POLICY);
    expect(first).not.toBe(second);

    // Mutating a result must not corrupt the constant or the next caller.
    first.dropLowestCount = 3;
    expect(NO_POLICY.dropLowestCount).toBeNull();
    expect(second.dropLowestCount).toBeNull();
  });
});

describe('NO_POLICY', () => {
  it('has no policy configured', () => {
    expect(getActiveAdvancedOption(NO_POLICY)).toBe('none');
  });

  it('is frozen, since it is shared module state', () => {
    expect(Object.isFrozen(NO_POLICY)).toBe(true);
  });
});

describe('describePolicy', () => {
  it('is null when no policy applies', () => {
    expect(describePolicy(NO_POLICY)).toBeNull();
  });

  it('describes drop lowest', () => {
    expect(describePolicy({ ...NO_POLICY, ...advancedOptionUpdate('dropLowest') })).toBe('Drop lowest 1');
    expect(describePolicy({ ...NO_POLICY, dropLowestCount: 3 })).toBe('Drop lowest 3');
  });

  it('describes downweight', () => {
    expect(
      describePolicy({ ...NO_POLICY, ...advancedOptionUpdate('downweight') })
    ).toBe('Downweight lowest 1 by 50%');
  });

  it('is null for a zero count, which has no effect', () => {
    expect(describePolicy({ ...NO_POLICY, dropLowestCount: 0 })).toBeNull();
  });

  it('is null for a downweight of 0%, which has no effect', () => {
    expect(
      describePolicy({ ...NO_POLICY, downweightLowestCount: 2, downweightPercent: 0 })
    ).toBeNull();
  });

  it('prefers drop when both are set, matching the calculator', () => {
    const both = { ...NO_POLICY, dropLowestCount: 1, downweightLowestCount: 2, downweightPercent: 50 };
    expect(describePolicy(both)).toBe('Drop lowest 1');
  });
});

describe('applyFullCreditGrade', () => {
  it('is a no-op when unset', () => {
    expect(applyFullCreditGrade(59, null)).toBe(59);
  });

  it('is also a no-op for a missing field, not a division by undefined', () => {
    // Data saved before the field existed deserialises as `undefined`.
    expect(applyFullCreditGrade(59, undefined)).toBe(59);
  });

  it('scales below the threshold', () => {
    expect(applyFullCreditGrade(59, 60)).toBeCloseTo(98.33333333333333, 10);
    expect(applyFullCreditGrade(30, 60)).toBe(50);
  });

  it('hits exactly 100 at the threshold', () => {
    expect(applyFullCreditGrade(60, 60)).toBe(100);
  });

  it('caps above the threshold', () => {
    expect(applyFullCreditGrade(80, 60)).toBe(100);
    expect(applyFullCreditGrade(1000, 60)).toBe(100);
  });

  it('is the identity at 100', () => {
    expect(applyFullCreditGrade(42.5, 100)).toBe(42.5);
  });

  it('awards full credit at 0 rather than dividing by zero', () => {
    expect(applyFullCreditGrade(0, 0)).toBe(100);
    expect(Number.isFinite(applyFullCreditGrade(50, 0))).toBe(true);
  });

  it('keeps a zero score at zero', () => {
    expect(applyFullCreditGrade(0, 60)).toBe(0);
  });
});

describe('describePolicy with full credit', () => {
  it('describes full credit on its own', () => {
    expect(describePolicy({ ...NO_POLICY, fullCreditGrade: 80 })).toBe('80% for full credit');
  });

  it('reports a threshold of 0, which is meaningful', () => {
    expect(describePolicy({ ...NO_POLICY, fullCreditGrade: 0 })).toBe('0% for full credit');
  });

  it('joins full credit with a marks policy, since they combine', () => {
    expect(describePolicy({ ...NO_POLICY, dropLowestCount: 2, fullCreditGrade: 80 })).toBe(
      'Drop lowest 2 · 80% for full credit'
    );
  });

  it('joins with downweight too', () => {
    expect(
      describePolicy({
        ...NO_POLICY,
        downweightLowestCount: 1,
        downweightPercent: 50,
        fullCreditGrade: 90,
      })
    ).toBe('Downweight lowest 1 by 50% · 90% for full credit');
  });
});

describe('advancedOptionUpdate leaves full credit alone', () => {
  it('returns only the marks fields', () => {
    expect(Object.keys(advancedOptionUpdate('dropLowest')).sort()).toEqual([
      'downweightLowestCount',
      'downweightPercent',
      'dropLowestCount',
    ]);
  });

  it('preserves full credit when spread over an existing policy', () => {
    const withFullCredit = { ...NO_POLICY, fullCreditGrade: 75 };
    const switched = { ...withFullCredit, ...advancedOptionUpdate('downweight') };
    expect(switched.fullCreditGrade).toBe(75);
    expect(switched.downweightLowestCount).toBe(DEFAULT_DOWNWEIGHT_COUNT);
  });

  it('preserves full credit when turning a marks policy off', () => {
    const active = { ...NO_POLICY, dropLowestCount: 2, fullCreditGrade: 75 };
    const cleared = { ...active, ...advancedOptionUpdate('none') };
    expect(cleared).toMatchObject({ dropLowestCount: null, fullCreditGrade: 75 });
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
