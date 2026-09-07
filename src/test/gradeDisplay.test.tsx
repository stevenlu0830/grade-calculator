import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GradeDisplay } from '@/components/GradeDisplay';
import { getGradeBg, getGradeColor } from '@/lib/gradeFormatting';

/**
 * The one component allowed to turn a number into a grade on screen.
 *
 * The formatting itself is asserted in `gradeFormatting.test.ts`. What is here
 * is the decision this component makes on top of it: a course is *recorded*
 * with its rounded grade, so the letter and the colour have to follow that
 * number and not the exact percentage. A 79.6 is recorded as 80 — an A-, in
 * green-yellow — and colouring it as the B+ that 79.6 would earn is the bug
 * this is guarding.
 */

afterEach(cleanup);

/** The outer pill, which carries the colour when there's no official grade shown. */
const pill = () => document.querySelector('.grade-display') as HTMLElement;
/** The inner pill: the recorded whole number and its letter. */
const official = () => pill().querySelector('span:last-child') as HTMLElement;

describe('GradeDisplay', () => {
  it('shows the exact percentage to two decimals', () => {
    render(<GradeDisplay grade={78.8} />);

    expect(screen.getByText('78.80')).toBeTruthy();
  });

  it('shows a dash for a grade that has not been earned yet', () => {
    render(<GradeDisplay grade={null} />);

    expect(pill().textContent).toBe('—');
  });

  it('adds the recorded grade and its letter when asked', () => {
    render(<GradeDisplay grade={78.8} showLetterGrade />);

    expect(pill().textContent).toContain('78.80');
    expect(official().textContent).toBe('79 : B+');
  });

  it('colours by the recorded grade, not the percentage it rounded from', () => {
    // 79.6 is a B+ as a percentage and an A- once recorded. The letter beside
    // it says A-, so anything but the A- colour reads as a contradiction.
    render(<GradeDisplay grade={79.6} showLetterGrade />);

    expect(official().textContent).toBe('80 : A-');
    expect(official().className).toContain(getGradeColor(80));
    expect(official().className).toContain(getGradeBg(80));
  });

  it('leaves the exact figure uncoloured, since it is the working number', () => {
    render(<GradeDisplay grade={79.6} showLetterGrade />);

    // A wash behind the whole pill made the two numbers read as one grade.
    expect(pill().className).toContain('text-foreground');
    expect(pill().className).not.toContain(getGradeBg(80));
  });

  it('colours the figure itself when it is the only number shown', () => {
    render(<GradeDisplay grade={91} />);

    expect(pill().className).toContain(getGradeColor(91));
    expect(pill().className).toContain(getGradeBg(91));
  });

  it('drops the tint but keeps the colour when the background is off', () => {
    render(<GradeDisplay grade={91} showBackground={false} />);

    expect(pill().className).toContain(getGradeColor(91));
    expect(pill().className).not.toContain(getGradeBg(91));
  });

  it('has no official grade to show for an unearned one', () => {
    render(<GradeDisplay grade={null} showLetterGrade />);

    // No arrow, no letter — there is nothing yet for either to describe.
    expect(pill().textContent).toBe('—');
    expect(pill().textContent).not.toContain('→');
  });

  it('sizes the text without changing what it says', () => {
    const { rerender } = render(<GradeDisplay grade={88} size="sm" />);
    expect(pill().className).toContain('text-[11px]');

    rerender(<GradeDisplay grade={88} size="lg" />);
    expect(pill().className).toContain('text-base');
    expect(pill().textContent).toBe('88.00');
  });

  it('keeps a bonus-inflated grade above 100 rather than clamping it', () => {
    render(<GradeDisplay grade={102.5} showLetterGrade />);

    expect(pill().textContent).toContain('102.50');
    expect(official().textContent).toBe('103 : A+');
  });

  it('takes an extra class from its caller', () => {
    render(<GradeDisplay grade={70} className="ml-4" />);

    expect(pill().className).toContain('ml-4');
  });
});
