import { describe, it, expect } from 'vitest';
import { Breakdown, SubBreakdown } from '@/types/grades';
import {
  areWeightsValid,
  calculateBreakdownGrade,
  calculateCourseGrade,
  calculateWeightedValue,
  clampAchievedMarks,
  clampPercentage,
  getEnteredMarks,
  getTotalWeight,
} from '@/lib/gradeCalculations';

/** A mark entry: `[achieved, full]`, or `[null, full]` for an ungraded row. */
type Entry = [number | null, number];

const makeBreakdown = (entries: Entry[], overrides: Partial<Breakdown> = {}): Breakdown => {
  const subBreakdowns: SubBreakdown[] = entries.map(([achievedMarks, fullMarks], i) => ({
    id: `sub-${i}`,
    breakdownId: 'b-1',
    name: `Item ${i}`,
    achievedMarks,
    fullMarks,
  }));

  return {
    id: 'b-1',
    courseId: 'course-1',
    name: 'Breakdown',
    weight: null,
    dropLowestCount: null,
    downweightLowestCount: null,
    downweightPercent: null,
    subBreakdownLabel: 'Item',
    subBreakdowns,
    ...overrides,
  };
};

/** Shorthand for the pre-full-marks world: everything out of 100. */
const outOf100 = (grades: (number | null)[], overrides: Partial<Breakdown> = {}) =>
  makeBreakdown(
    grades.map(g => [g, 100] as Entry),
    overrides
  );

describe('getEnteredMarks', () => {
  it('keeps only scored rows, preserving order', () => {
    const subs = makeBreakdown([
      [9, 10],
      [null, 10],
      [7, 10],
    ]).subBreakdowns;
    expect(getEnteredMarks(subs)).toEqual([
      { achieved: 9, full: 10 },
      { achieved: 7, full: 10 },
    ]);
  });

  it('keeps a real zero', () => {
    expect(getEnteredMarks(makeBreakdown([[0, 10]]).subBreakdowns)).toEqual([
      { achieved: 0, full: 10 },
    ]);
  });

  it('skips rows worth zero marks, which cannot contribute a score', () => {
    expect(getEnteredMarks(makeBreakdown([[5, 0]]).subBreakdowns)).toEqual([]);
  });
});

describe('calculateBreakdownGrade', () => {
  it('returns null when there are no sub-breakdowns', () => {
    expect(calculateBreakdownGrade(makeBreakdown([]))).toBeNull();
  });

  it('returns null when nothing has been graded', () => {
    const breakdown = makeBreakdown([
      [null, 10],
      [null, 20],
    ]);
    expect(calculateBreakdownGrade(breakdown)).toBeNull();
  });

  it('returns null when every row is worth zero marks', () => {
    expect(calculateBreakdownGrade(makeBreakdown([[0, 0]]))).toBeNull();
  });

  it('divides total achieved by total available marks', () => {
    // 18/20 + 27/30 -> 45/50
    const breakdown = makeBreakdown([
      [18, 20],
      [27, 30],
    ]);
    expect(calculateBreakdownGrade(breakdown)).toBe(90);
  });

  it('weights a big test more heavily than a small quiz', () => {
    // 9/10 and 30/50 -> 39/60 = 65%, not the 75% a plain average would give.
    const breakdown = makeBreakdown([
      [9, 10],
      [30, 50],
    ]);
    expect(calculateBreakdownGrade(breakdown)).toBe(65);
    expect(calculateBreakdownGrade(breakdown)).not.toBe((90 + 60) / 2);
  });

  it('ignores ungraded rows entirely rather than scoring them zero', () => {
    const breakdown = makeBreakdown([
      [18, 20],
      [null, 80],
    ]);
    expect(calculateBreakdownGrade(breakdown)).toBe(90);
  });

  it('counts a zero score', () => {
    const breakdown = makeBreakdown([
      [0, 10],
      [10, 10],
    ]);
    expect(calculateBreakdownGrade(breakdown)).toBe(50);
  });

  describe('drop lowest', () => {
    it('drops the worst score by percentage, not by raw marks lost', () => {
      // 4/10 (40%) is dropped ahead of 15/20 (75%), though 15/20 lost more marks.
      const breakdown = makeBreakdown(
        [
          [4, 10],
          [15, 20],
        ],
        { dropLowestCount: 1 }
      );
      expect(calculateBreakdownGrade(breakdown)).toBe(75);
    });

    it("removes the dropped row's full marks from the total too", () => {
      // Dropping 0/20 leaves 10/10, not 10/30.
      const breakdown = makeBreakdown(
        [
          [0, 20],
          [10, 10],
        ],
        { dropLowestCount: 1 }
      );
      expect(calculateBreakdownGrade(breakdown)).toBe(100);
    });

    it('always keeps at least one row when the count exceeds the list', () => {
      const breakdown = makeBreakdown(
        [
          [4, 10],
          [8, 10],
          [10, 10],
        ],
        { dropLowestCount: 5 }
      );
      expect(calculateBreakdownGrade(breakdown)).toBe(100);
    });

    it('is skipped when there is only one score', () => {
      expect(calculateBreakdownGrade(makeBreakdown([[6, 10]], { dropLowestCount: 1 }))).toBe(60);
    });

    it('is inert when the count is zero', () => {
      const breakdown = makeBreakdown(
        [
          [6, 10],
          [10, 10],
        ],
        { dropLowestCount: 0 }
      );
      expect(calculateBreakdownGrade(breakdown)).toBe(80);
    });
  });

  describe('downweight lowest', () => {
    const pair = (overrides: Partial<Breakdown>) =>
      makeBreakdown(
        [
          [6, 10],
          [10, 10],
        ],
        overrides
      );

    it('shrinks both sides of the fraction for the lowest row', () => {
      // 6/10 at half weight + 10/10 -> (3 + 10) / (5 + 10)
      const grade = calculateBreakdownGrade(
        pair({ downweightLowestCount: 1, downweightPercent: 50 })
      );
      expect(grade).toBeCloseTo(86.666, 2);
    });

    it('matches the plain total at 0%', () => {
      expect(
        calculateBreakdownGrade(pair({ downweightLowestCount: 1, downweightPercent: 0 }))
      ).toBe(80);
    });

    it('matches dropping at 100%', () => {
      expect(
        calculateBreakdownGrade(pair({ downweightLowestCount: 1, downweightPercent: 100 }))
      ).toBe(100);
    });

    it('returns null when every row is discounted to zero weight', () => {
      expect(
        calculateBreakdownGrade(pair({ downweightLowestCount: 2, downweightPercent: 100 }))
      ).toBeNull();
    });
  });

  it('prefers drop lowest when both policies are somehow set', () => {
    const breakdown = makeBreakdown(
      [
        [6, 10],
        [8, 10],
        [10, 10],
      ],
      { dropLowestCount: 1, downweightLowestCount: 2, downweightPercent: 50 }
    );
    expect(calculateBreakdownGrade(breakdown)).toBe(90);
  });

  // The marks model must reduce to the old average when nothing is out of a
  // custom total, so migrated data keeps the grade it had before.
  describe('reduces to a plain average when everything is out of 100', () => {
    it('with no policy', () => {
      expect(calculateBreakdownGrade(outOf100([60, null, 80]))).toBe(70);
    });

    it('with drop lowest', () => {
      expect(calculateBreakdownGrade(outOf100([60, 80, 100], { dropLowestCount: 1 }))).toBe(90);
    });

    it('with downweight', () => {
      // Historic expectation: sorted [60,80,100], weights [0.5,1,1] -> 84
      const grade = calculateBreakdownGrade(
        outOf100([60, 80, 100], { downweightLowestCount: 1, downweightPercent: 50 })
      );
      expect(grade).toBe(84);
    });
  });
});

describe('calculateWeightedValue', () => {
  it('scales the breakdown grade by its weight', () => {
    expect(calculateWeightedValue(makeBreakdown([[18, 20]], { weight: 40 }))).toBe(36);
  });

  it('returns null when the weight is unset', () => {
    expect(calculateWeightedValue(makeBreakdown([[18, 20]]))).toBeNull();
  });

  it('returns null when there is no grade', () => {
    expect(calculateWeightedValue(makeBreakdown([[null, 20]], { weight: 40 }))).toBeNull();
  });
});

describe('calculateCourseGrade', () => {
  it('returns null with no breakdowns', () => {
    expect(calculateCourseGrade([])).toBeNull();
  });

  it('returns null when nothing has both a grade and a weight', () => {
    expect(
      calculateCourseGrade([
        makeBreakdown([[18, 20]]),
        makeBreakdown([[null, 20]], { weight: 50 }),
      ])
    ).toBeNull();
  });

  it('sums the weighted contributions', () => {
    const breakdowns = [
      makeBreakdown([[18, 20]], { weight: 40 }),
      makeBreakdown([[40, 50]], { weight: 60 }),
    ];
    expect(calculateCourseGrade(breakdowns)).toBeCloseTo(84, 10);
  });

  it('ignores breakdowns missing a grade', () => {
    const breakdowns = [
      makeBreakdown([[18, 20]], { weight: 40 }),
      makeBreakdown([[null, 50]], { weight: 60 }),
    ];
    expect(calculateCourseGrade(breakdowns)).toBeCloseTo(36, 10);
  });

  it('applies the drop policy before weighting', () => {
    const breakdowns = [
      makeBreakdown(
        [
          [6, 10],
          [8, 10],
          [10, 10],
        ],
        { weight: 50, dropLowestCount: 1 }
      ),
    ];
    expect(calculateCourseGrade(breakdowns)).toBeCloseTo(45, 10);
  });
});

describe('getTotalWeight', () => {
  it('sums weights, treating unset as zero', () => {
    const breakdowns = [
      makeBreakdown([], { weight: 40 }),
      makeBreakdown([], { weight: null }),
      makeBreakdown([], { weight: 60 }),
    ];
    expect(getTotalWeight(breakdowns)).toBe(100);
  });

  it('is zero for no breakdowns', () => {
    expect(getTotalWeight([])).toBe(0);
  });
});

describe('areWeightsValid', () => {
  const weighted = (...weights: number[]) => weights.map(w => makeBreakdown([], { weight: w }));

  it('accepts weights that total exactly 100', () => {
    expect(areWeightsValid(weighted(40, 60))).toBe(true);
  });

  it('accepts thirds that add up exactly', () => {
    expect(areWeightsValid(weighted(33.33, 33.33, 33.34))).toBe(true);
  });

  it('accepts a sum that floating-point error nudges off 100', () => {
    // Evaluates to 100.00000000000001, which `=== 100` wrongly rejected.
    expect(getTotalWeight(weighted(0.01, 64.04, 35.95))).not.toBe(100);
    expect(areWeightsValid(weighted(0.01, 64.04, 35.95))).toBe(true);
  });

  it('still rejects weights that genuinely fall short', () => {
    expect(areWeightsValid(weighted(33.33, 33.33, 33.33))).toBe(false);
    expect(areWeightsValid(weighted(40, 50))).toBe(false);
    expect(areWeightsValid(weighted(40, 61))).toBe(false);
  });

  it('rejects a course with no breakdowns', () => {
    expect(areWeightsValid([])).toBe(false);
  });
});

describe('clamping', () => {
  it('constrains a percentage to 0-100', () => {
    expect(clampPercentage(-5)).toBe(0);
    expect(clampPercentage(42)).toBe(42);
    expect(clampPercentage(150)).toBe(100);
  });

  it('constrains achieved marks to the marks available', () => {
    expect(clampAchievedMarks(-5, 20)).toBe(0);
    expect(clampAchievedMarks(18, 20)).toBe(18);
    expect(clampAchievedMarks(30, 20)).toBe(20);
  });

  it('allows marks above 100 when the paper is worth more', () => {
    expect(clampAchievedMarks(130, 150)).toBe(130);
  });
});
