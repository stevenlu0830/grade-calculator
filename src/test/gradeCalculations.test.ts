import { describe, it, expect } from 'vitest';
import { Component, SubComponent } from '@/types/grades';
import {
  areWeightsValid,
  calculateComponentGrade,
  calculateCourseGrade,
  calculateSubComponentGrades,
  calculateWeightedValue,
  clampGrade,
  getTotalWeight,
} from '@/lib/gradeCalculations';

/** Builds a Component from a terse grade list; `null` entries model ungraded rows. */
const makeComponent = (
  grades: (number | null)[],
  overrides: Partial<Component> = {}
): Component => {
  const subComponents: SubComponent[] = grades.map((grade, i) => ({
    id: `sub-${i}`,
    componentId: 'comp-1',
    name: `Item ${i}`,
    grade,
  }));

  return {
    id: 'comp-1',
    courseId: 'course-1',
    name: 'Component',
    weight: null,
    dropLowestCount: null,
    downweightLowestCount: null,
    downweightPercent: null,
    subComponents,
    ...overrides,
  };
};

describe('calculateSubComponentGrades', () => {
  it('keeps only entered grades, preserving order', () => {
    expect(calculateSubComponentGrades(makeComponent([90, null, 70]).subComponents)).toEqual([
      90, 70,
    ]);
  });

  it('keeps a real zero', () => {
    expect(calculateSubComponentGrades(makeComponent([0, null]).subComponents)).toEqual([0]);
  });
});

describe('calculateComponentGrade', () => {
  it('returns null when there are no sub-components', () => {
    expect(calculateComponentGrade(makeComponent([]))).toBeNull();
  });

  it('returns null when every grade is unentered', () => {
    expect(calculateComponentGrade(makeComponent([null, null]))).toBeNull();
  });

  it('averages entered grades and ignores unentered ones', () => {
    expect(calculateComponentGrade(makeComponent([60, null, 80]))).toBe(70);
  });

  it('counts a zero rather than treating it as unentered', () => {
    expect(calculateComponentGrade(makeComponent([0, 100]))).toBe(50);
  });

  describe('drop lowest', () => {
    it('excludes the N lowest grades', () => {
      expect(calculateComponentGrade(makeComponent([60, 80, 100], { dropLowestCount: 1 }))).toBe(
        90
      );
    });

    it('always keeps at least one grade when N exceeds the count', () => {
      expect(calculateComponentGrade(makeComponent([60, 80, 100], { dropLowestCount: 5 }))).toBe(
        100
      );
    });

    it('is skipped when there is only one grade', () => {
      expect(calculateComponentGrade(makeComponent([60], { dropLowestCount: 1 }))).toBe(60);
    });

    it('is inert when the count is zero', () => {
      expect(calculateComponentGrade(makeComponent([60, 80, 100], { dropLowestCount: 0 }))).toBe(80);
    });
  });

  describe('downweight lowest', () => {
    it('reduces the weight of the N lowest grades', () => {
      // sorted [60,80,100] with weights [0.5,1,1] -> 210 / 2.5
      const component = makeComponent([60, 80, 100], {
        downweightLowestCount: 1,
        downweightPercent: 50,
      });
      expect(calculateComponentGrade(component)).toBe(84);
    });

    it('is skipped when there is only one grade', () => {
      const component = makeComponent([60], {
        downweightLowestCount: 1,
        downweightPercent: 50,
      });
      expect(calculateComponentGrade(component)).toBe(60);
    });

    it('leaves the average unchanged at 0%', () => {
      const component = makeComponent([60, 80, 100], {
        downweightLowestCount: 1,
        downweightPercent: 0,
      });
      expect(calculateComponentGrade(component)).toBe(80);
    });

    it('fully discounts the lowest at 100%', () => {
      const component = makeComponent([60, 80, 100], {
        downweightLowestCount: 1,
        downweightPercent: 100,
      });
      expect(calculateComponentGrade(component)).toBe(90);
    });

    it('returns null when every grade is discounted to zero weight', () => {
      // Degenerate but reachable: nothing is left to average.
      const component = makeComponent([60, 80], {
        downweightLowestCount: 2,
        downweightPercent: 100,
      });
      expect(calculateComponentGrade(component)).toBeNull();
    });

    it('ignores the policy when the percentage is unset', () => {
      const component = makeComponent([60, 80, 100], {
        downweightLowestCount: 1,
        downweightPercent: null,
      });
      expect(calculateComponentGrade(component)).toBe(80);
    });
  });

  it('prefers drop lowest when both policies are somehow set', () => {
    const component = makeComponent([60, 80, 100], {
      dropLowestCount: 1,
      downweightLowestCount: 2,
      downweightPercent: 50,
    });
    expect(calculateComponentGrade(component)).toBe(90);
  });
});

describe('calculateWeightedValue', () => {
  it('scales the component grade by its weight', () => {
    expect(calculateWeightedValue(makeComponent([90], { weight: 40 }))).toBe(36);
  });

  it('returns null when the weight is unset', () => {
    expect(calculateWeightedValue(makeComponent([90]))).toBeNull();
  });

  it('returns null when there is no grade', () => {
    expect(calculateWeightedValue(makeComponent([null], { weight: 40 }))).toBeNull();
  });
});

describe('calculateCourseGrade', () => {
  it('returns null with no components', () => {
    expect(calculateCourseGrade([])).toBeNull();
  });

  it('returns null when no component has both a grade and a weight', () => {
    expect(calculateCourseGrade([makeComponent([90]), makeComponent([null], { weight: 50 })])).toBeNull();
  });

  it('sums the weighted contributions', () => {
    const components = [
      makeComponent([90], { weight: 40 }),
      makeComponent([80], { weight: 60 }),
    ];
    expect(calculateCourseGrade(components)).toBeCloseTo(84, 10);
  });

  it('ignores components that are missing a grade', () => {
    const components = [
      makeComponent([90], { weight: 40 }),
      makeComponent([null], { weight: 60 }),
    ];
    expect(calculateCourseGrade(components)).toBeCloseTo(36, 10);
  });

  it('applies the drop policy before weighting', () => {
    const components = [makeComponent([60, 80, 100], { weight: 50, dropLowestCount: 1 })];
    expect(calculateCourseGrade(components)).toBeCloseTo(45, 10);
  });
});

describe('getTotalWeight', () => {
  it('sums weights, treating unset as zero', () => {
    const components = [
      makeComponent([], { weight: 40 }),
      makeComponent([], { weight: null }),
      makeComponent([], { weight: 60 }),
    ];
    expect(getTotalWeight(components)).toBe(100);
  });

  it('is zero for no components', () => {
    expect(getTotalWeight([])).toBe(0);
  });
});

describe('areWeightsValid', () => {
  const weighted = (...weights: number[]) => weights.map(w => makeComponent([], { weight: w }));

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
    // 99.99 is a real 0.01 shortfall, not float drift — the warning should show.
    expect(areWeightsValid(weighted(33.33, 33.33, 33.33))).toBe(false);
    expect(areWeightsValid(weighted(40, 50))).toBe(false);
    expect(areWeightsValid(weighted(40, 61))).toBe(false);
    expect(areWeightsValid(weighted(99.9))).toBe(false);
  });

  it('rejects a course with no components', () => {
    expect(areWeightsValid([])).toBe(false);
  });
});

describe('clampGrade', () => {
  it('constrains to 0-100', () => {
    expect(clampGrade(-5)).toBe(0);
    expect(clampGrade(42)).toBe(42);
    expect(clampGrade(150)).toBe(100);
  });
});
