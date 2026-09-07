import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Breakdown, Course } from '@/types/grades';
import { CourseSection } from '@/components/CourseSection';

/**
 * One course card: the final grade, and everything under it.
 *
 * The behaviour worth pinning down is the refusal. A course whose weights don't
 * total 100 has no meaningful final grade, so the card shows a dash and says
 * what the weights currently add up to — showing a number computed from 85% of
 * a syllabus would be confidently wrong. Bonus breakdowns are the usual
 * surprise there, since they're deliberately outside the 100.
 */

afterEach(cleanup);

const breakdown = (over: Partial<Breakdown> = {}): Breakdown => ({
  id: 'b1',
  courseId: 'c1',
  name: 'Assignments',
  weight: 100,
  dropLowestCount: null,
  downweightLowestCount: null,
  downweightPercent: null,
  fullCreditGrade: null,
  isBonus: false,
  equalWeightSubBreakdowns: false,
  subBreakdownLabel: 'Assignment',
  subBreakdowns: [
    { id: 's1', breakdownId: 'b1', name: 'Assignment 1', achievedMarks: 79, fullMarks: 100 },
  ],
  ...over,
});

const course = (breakdowns: Breakdown[] = [breakdown()]): Course => ({
  id: 'c1',
  name: 'CPSC 320',
  semester: '2026 Winter Term 1',
  breakdowns,
});

/**
 * The course grade in the sticky header, told apart from a breakdown's own
 * grade — which can read identically on a one-breakdown course.
 */
const finalGrade = () =>
  screen.getByText('Final Grade').parentElement?.querySelector('.grade-display') as HTMLElement;

function renderCourse(value = course()) {
  const handlers = {
    onUpdateName: vi.fn(),
    onDelete: vi.fn(),
    onAddBreakdown: vi.fn(),
    onDeleteBreakdown: vi.fn(),
    onUpdateBreakdown: vi.fn(),
    onAddSubBreakdown: vi.fn(),
    onDeleteSubBreakdown: vi.fn(),
    onUpdateSubBreakdown: vi.fn(),
  };
  render(
    <TooltipProvider>
      <CourseSection course={value} {...handlers} />
    </TooltipProvider>
  );
  return handlers;
}

describe('CourseSection', () => {
  it('shows the final grade with the number it would be recorded as', () => {
    renderCourse();

    expect(finalGrade().textContent).toBe('79.00→79 : B+');
  });

  it('renames the course on typing', () => {
    const { onUpdateName } = renderCourse();

    fireEvent.change(screen.getByDisplayValue('CPSC 320'), { target: { value: 'CPSC 322' } });

    expect(onUpdateName).toHaveBeenCalledWith('CPSC 322');
  });

  it('refuses a grade when the weights do not total 100, and says what they do', () => {
    renderCourse(course([breakdown({ weight: 40 })]));

    expect(screen.getByText(/total 40%/)).toBeTruthy();
    expect(screen.queryByText(/: B\+/)).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('leaves a bonus breakdown out of the 100, and says where the weight went', () => {
    // A course that adds up correctly without its bonus must not look short.
    renderCourse(course([breakdown(), breakdown({ id: 'b2', weight: 5, isBonus: true })]));

    expect(screen.queryByText(/should sum to 100/)).toBeNull();
    expect(screen.getByText(/Bonus breakdowns add up to 5% on top/)).toBeTruthy();
  });

  it('warns nothing about a course with no breakdowns at all', () => {
    // Zero isn't a mistake yet — it's a course nobody has started.
    renderCourse(course([]));

    expect(screen.queryByText(/should sum to 100/)).toBeNull();
    expect(screen.getByText(/No breakdowns yet/)).toBeTruthy();
  });

  it('offers Add Breakdown from the empty state and from the foot of a full card', () => {
    const empty = renderCourse(course([]));
    fireEvent.click(screen.getByRole('button', { name: /add breakdown/i }));
    expect(screen.getByRole('heading', { name: 'Add breakdown' })).toBeTruthy();
    cleanup();

    renderCourse();
    fireEvent.click(screen.getByRole('button', { name: /add breakdown/i }));
    expect(screen.getByRole('heading', { name: 'Add breakdown' })).toBeTruthy();
    expect(empty.onAddBreakdown).not.toHaveBeenCalled();
  });

  it('adds the breakdown the dialog built', () => {
    const { onAddBreakdown } = renderCourse(course([]));

    fireEvent.click(screen.getByRole('button', { name: /add breakdown/i }));
    fireEvent.keyDown(document.getElementById('breakdown-type') as HTMLElement, {
      key: 'ArrowDown',
    });
    fireEvent.click(screen.getByRole('option', { name: 'Labs' }));
    fireEvent.change(document.getElementById('breakdown-weight') as HTMLInputElement, {
      target: { value: '25' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAddBreakdown).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Labs', weight: 25 })
    );
  });

  it('closes over each breakdown’s id on the way down', () => {
    const { onUpdateBreakdown, onAddSubBreakdown } = renderCourse();

    fireEvent.change(screen.getByLabelText('Breakdown weight'), { target: { value: '90' } });
    expect(onUpdateBreakdown).toHaveBeenCalledWith('b1', { weight: 90 });

    fireEvent.click(screen.getByRole('button', { name: /add sub-breakdown/i }));
    expect(onAddSubBreakdown).toHaveBeenCalledWith('b1');
  });

  it('carries both ids down to a sub-breakdown edit', () => {
    const { onUpdateSubBreakdown } = renderCourse();

    fireEvent.change(screen.getByLabelText('Marks achieved'), { target: { value: '85' } });

    expect(onUpdateSubBreakdown).toHaveBeenCalledWith('b1', 's1', { achievedMarks: 85 });
  });

  it('carries the ids down to the two deletes as well', () => {
    const { onDeleteBreakdown, onDeleteSubBreakdown } = renderCourse(
      course([
        breakdown({
          subBreakdowns: [
            { id: 's1', breakdownId: 'b1', name: 'A1', achievedMarks: 8, fullMarks: 10 },
            { id: 's2', breakdownId: 'b1', name: 'A2', achievedMarks: 9, fullMarks: 10 },
          ],
        }),
      ])
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete sub-breakdown' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete row' }));
    expect(onDeleteSubBreakdown).toHaveBeenCalledWith('b1', 's2');

    fireEvent.click(screen.getByRole('button', { name: 'Delete breakdown' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete breakdown' }));
    expect(onDeleteBreakdown).toHaveBeenCalledWith('b1');
  });

  it('confirms a course delete by naming its blast radius', () => {
    const { onDelete } = renderCourse();

    fireEvent.click(screen.getByRole('button', { name: 'Delete course' }));

    expect(screen.getByText('Delete CPSC 320?')).toBeTruthy();
    expect(screen.getByText(/1 breakdown and every mark/)).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete course' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('says plainly when there is nothing under the course', () => {
    renderCourse(course([]));

    fireEvent.click(screen.getByRole('button', { name: 'Delete course' }));

    expect(screen.getByText('This course has no breakdowns in it. Deleting it cannot be undone.'))
      .toBeTruthy();
  });

  it('falls back to a generic title for an unnamed course', () => {
    renderCourse({ ...course(), name: '  ' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete course' }));

    expect(screen.getByText('Delete this course?')).toBeTruthy();
  });

  it('lets a bonus push the final grade past 100, unclamped', () => {
    renderCourse(
      course([
        breakdown({
          subBreakdowns: [
            { id: 's1', breakdownId: 'b1', name: 'Assignment 1', achievedMarks: 100, fullMarks: 100 },
          ],
        }),
        breakdown({
          id: 'b2',
          weight: 5,
          isBonus: true,
          subBreakdowns: [
            { id: 's2', breakdownId: 'b2', name: 'Extra', achievedMarks: 10, fullMarks: 10 },
          ],
        }),
      ])
    );

    expect(finalGrade().textContent).toBe('105.00→105 : A+');
  });
});
