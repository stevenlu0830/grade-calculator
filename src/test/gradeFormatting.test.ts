import { describe, it, expect } from 'vitest';
import {
  formatGrade,
  formatOfficialGrade,
  formatWeight,
  getGradeBg,
  getGradeColor,
  getLetterGrade,
  toOfficialGrade,
} from '@/lib/gradeFormatting';

describe('formatWeight', () => {
  it('shows why a total misses 100 instead of rounding it away', () => {
    // The old one-decimal format printed this as "100.0".
    expect(formatWeight(33.33 * 3)).toBe('99.99');
  });

  it('drops trailing zeros on clean totals', () => {
    expect(formatWeight(90)).toBe('90');
    expect(formatWeight(33.5)).toBe('33.5');
  });

  it('absorbs floating-point noise', () => {
    expect(formatWeight(0.01 + 64.04 + 35.95)).toBe('100');
  });
});

describe('formatGrade', () => {
  it('renders an em dash for an unentered grade', () => {
    expect(formatGrade(null)).toBe('—');
  });

  it('always shows two decimal places', () => {
    expect(formatGrade(90)).toBe('90.00');
    expect(formatGrade(82.3)).toBe('82.30');
    expect(formatGrade(82.346)).toBe('82.35');
    expect(formatGrade(82.344)).toBe('82.34');
    expect(formatGrade(0)).toBe('0.00');
  });

  it('rounds only at display, keeping the underlying value intact', () => {
    expect(formatGrade(100 / 3)).toBe('33.33');
    expect(formatGrade(2 / 3 * 100)).toBe('66.67');
  });
});

describe('getLetterGrade', () => {
  it('renders an em dash for an unentered grade', () => {
    expect(getLetterGrade(null)).toBe('—');
  });

  it.each([
    [100, 'A+'],
    [90, 'A+'],
    [89.9, 'A'],
    [85, 'A'],
    [84.9, 'A-'],
    [80, 'A-'],
    [79.9, 'B+'],
    [76, 'B+'],
    [75.9, 'B'],
    [72, 'B'],
    [71.9, 'B-'],
    [68, 'B-'],
    [67.9, 'C+'],
    [64, 'C+'],
    [63.9, 'C'],
    [60, 'C'],
    [59.9, 'C-'],
    [55, 'C-'],
    [54.9, 'D'],
    [50, 'D'],
    [49.9, 'F'],
    [0, 'F'],
  ])('maps %s to %s on the UBC scale', (grade, letter) => {
    expect(getLetterGrade(grade)).toBe(letter);
  });

  it('clamps out-of-range values', () => {
    expect(getLetterGrade(150)).toBe('A+');
    expect(getLetterGrade(-20)).toBe('F');
  });
});

describe('grade colour bands', () => {
  it.each([
    [null, 'text-muted-foreground'],
    [95, 'text-grade-excellent'],
    [90, 'text-grade-excellent'],
    [89.9, 'text-grade-good'],
    [80, 'text-grade-good'],
    [79.9, 'text-grade-average'],
    [70, 'text-grade-average'],
    [69.9, 'text-grade-passing'],
    [60, 'text-grade-passing'],
    [59.9, 'text-grade-failing'],
    [0, 'text-grade-failing'],
  ])('maps %s to %s', (grade, expected) => {
    expect(getGradeColor(grade)).toBe(expected);
  });

  it('pairs each text colour with a matching tinted background', () => {
    expect(getGradeBg(null)).toBe('bg-muted');
    expect(getGradeBg(95)).toBe('bg-grade-excellent/10');
    expect(getGradeBg(85)).toBe('bg-grade-good/10');
    expect(getGradeBg(75)).toBe('bg-grade-average/10');
    expect(getGradeBg(65)).toBe('bg-grade-passing/10');
    expect(getGradeBg(55)).toBe('bg-grade-failing/10');
  });
});


describe('toOfficialGrade', () => {
  it('rounds to the whole number a course is recorded with', () => {
    expect(toOfficialGrade(84.4)).toBe(84);
    expect(toOfficialGrade(84.6)).toBe(85);
  });

  it('rounds a half up', () => {
    expect(toOfficialGrade(79.5)).toBe(80);
  });

  it('leaves a whole number alone', () => {
    expect(toOfficialGrade(84)).toBe(84);
    expect(toOfficialGrade(0)).toBe(0);
  });

  it('does not clamp — a bonus can genuinely exceed 100', () => {
    expect(toOfficialGrade(103.6)).toBe(104);
  });

  it('propagates an unentered grade', () => {
    expect(toOfficialGrade(null)).toBeNull();
    expect(formatOfficialGrade(null)).toBe('—');
  });
});

describe('formatOfficialGrade', () => {
  it('shows no decimals, unlike the exact grade beside it', () => {
    expect(formatOfficialGrade(84.56)).toBe('85');
    expect(formatGrade(84.56)).toBe('84.56');
  });
});

describe('the letter follows the official grade, not the exact one', () => {
  it('promotes a grade that rounds up into the next band', () => {
    // 79.6 is recorded as an 80, and an 80 is an A-.
    expect(getLetterGrade(toOfficialGrade(79.6))).toBe('A-');
    // Read against the exact figure it would have been a B+, which is the bug.
    expect(getLetterGrade(79.6)).toBe('B+');
  });

  it('leaves a grade that rounds down where it was', () => {
    expect(getLetterGrade(toOfficialGrade(79.4))).toBe('B+');
  });
});
