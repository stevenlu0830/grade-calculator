import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Breakdown } from '@/types/grades';
import { BreakdownCard } from '@/components/BreakdownCard';

/**
 * One weighted line of the syllabus, with its rows underneath.
 *
 * The header carries three numbers that are easy to confuse: the weight the
 * student typed, the breakdown's own grade, and what it contributes to the
 * course. These check that each is the one it claims to be — a card showing the
 * contribution where the grade belongs would look plausible and be wrong all
 * term.
 */

afterEach(cleanup);

const breakdown = (over: Partial<Breakdown> = {}): Breakdown => ({
  id: 'b1',
  courseId: 'c1',
  name: 'Assignments',
  weight: 40,
  dropLowestCount: null,
  downweightLowestCount: null,
  downweightPercent: null,
  fullCreditGrade: null,
  isBonus: false,
  equalWeightSubBreakdowns: false,
  subBreakdownLabel: 'Assignment',
  subBreakdowns: [
    { id: 's1', breakdownId: 'b1', name: 'Assignment 1', achievedMarks: 8, fullMarks: 10 },
    { id: 's2', breakdownId: 'b1', name: 'Assignment 2', achievedMarks: 17, fullMarks: 20 },
  ],
  ...over,
});

const weightField = () => screen.getByLabelText('Breakdown weight') as HTMLInputElement;

function renderCard(value = breakdown()) {
  const handlers = {
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onAddSubBreakdown: vi.fn(),
    onUpdateSubBreakdown: vi.fn(),
    onDeleteSubBreakdown: vi.fn(),
  };
  render(
    <TooltipProvider>
      <BreakdownCard breakdown={value} {...handlers} />
    </TooltipProvider>
  );
  return handlers;
}

describe('BreakdownCard', () => {
  it('shows the weight, the grade, and what it contributes', () => {
    // 25 marks out of 30 is 83.33%, which is 33.33 of the 40 points on offer.
    renderCard();

    expect(weightField().value).toBe('40');
    expect(screen.getByText('83.33')).toBeTruthy();
    expect(screen.getByText('33.33')).toBeTruthy();
  });

  it('lists a row per sub-breakdown', () => {
    renderCard();

    expect(screen.getByDisplayValue('Assignment 1')).toBeTruthy();
    expect(screen.getByDisplayValue('Assignment 2')).toBeTruthy();
  });

  it('renames on typing', () => {
    const { onUpdate } = renderCard();

    fireEvent.change(screen.getByDisplayValue('Assignments'), { target: { value: 'Homework' } });

    expect(onUpdate).toHaveBeenCalledWith({ name: 'Homework' });
  });

  it('records a typed weight', () => {
    const { onUpdate } = renderCard();

    fireEvent.change(weightField(), { target: { value: '35' } });

    expect(onUpdate).toHaveBeenCalledWith({ weight: 35 });
  });

  it('clears the weight when the box is emptied, rather than reading it as zero', () => {
    const { onUpdate } = renderCard();

    fireEvent.change(weightField(), { target: { value: '' } });

    expect(onUpdate).toHaveBeenCalledWith({ weight: null });
  });

  it('tags a bonus breakdown in the header, beside the weight it changes', () => {
    // Bonus is the one option surfaced up here rather than only in the policy
    // summary, because it changes what the number next to it means.
    renderCard(breakdown({ isBonus: true }));

    const tag = screen.getAllByText('Bonus').find(node => node.tagName === 'DIV');
    expect(tag).toBeTruthy();
    expect(weightField().parentElement?.contains(tag as Node)).toBe(true);
  });

  it('summarises an active policy beside the Advanced button', () => {
    // The options live in a modal now, so without this a rule set weeks ago is
    // invisible.
    renderCard(breakdown({ dropLowestCount: 1 }));

    expect(screen.getByText(/drop/i)).toBeTruthy();
  });

  it('collapses to the header, keeping the numbers on show', () => {
    renderCard();

    fireEvent.click(document.querySelector('[data-state="open"] button') as HTMLElement);

    expect(screen.queryByDisplayValue('Assignment 1')).toBeNull();
    expect(screen.getByText('83.33')).toBeTruthy();
  });

  it('adds a row through its caller', () => {
    const { onAddSubBreakdown } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: /add sub-breakdown/i }));

    expect(onAddSubBreakdown).toHaveBeenCalledTimes(1);
  });

  it('closes over each row’s id, so the child never sees one', () => {
    const { onUpdateSubBreakdown } = renderCard();

    fireEvent.change(screen.getByDisplayValue('Assignment 2'), { target: { value: 'A2' } });

    expect(onUpdateSubBreakdown).toHaveBeenCalledWith('s2', { name: 'A2' });
  });

  it('deletes a row through its caller, once confirmed', () => {
    const { onDeleteSubBreakdown } = renderCard();

    const row = screen.getByDisplayValue('Assignment 1').closest('div') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Delete sub-breakdown' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete row' }));

    expect(onDeleteSubBreakdown).toHaveBeenCalledWith('s1');
  });

  it('confirms a breakdown delete by spelling out what goes with it', () => {
    const { onDelete } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Delete breakdown' }));

    expect(screen.getByText('Delete Assignments?')).toBeTruthy();
    expect(screen.getByText(/2 sub-breakdowns/)).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete breakdown' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps the confirmation up even if the card is collapsed underneath it', () => {
    // The dialog lives outside the collapsible for exactly this reason.
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Delete breakdown' }));

    fireEvent.click(document.querySelector('[data-state="open"] button') as HTMLElement);

    expect(screen.getByText('Delete Assignments?')).toBeTruthy();
  });

  it('applies an advanced option through the same update path as the header fields', () => {
    const { onUpdate } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: /advanced/i }));
    fireEvent.click(screen.getByRole('switch', { name: 'Equal weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ equalWeightSubBreakdowns: true })
    );
  });

  it('shows an empty weight box rather than a zero, for a breakdown with none set', () => {
    // `?? ''`, not `|| ''` — a real 0% weight has to survive, and an unset one
    // must not read as one.
    renderCard(breakdown({ weight: null }));
    expect(weightField().value).toBe('');
    cleanup();

    renderCard(breakdown({ weight: 0 }));
    expect(weightField().value).toBe('0');
  });

  it('falls back to a generic title for an unnamed breakdown', () => {
    renderCard(breakdown({ name: '   ' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete breakdown' }));

    expect(screen.getByText('Delete this breakdown?')).toBeTruthy();
  });

  it('shows a dash where there is no grade yet, and no contribution either', () => {
    renderCard(
      breakdown({
        subBreakdowns: [
          { id: 's1', breakdownId: 'b1', name: 'Assignment 1', achievedMarks: null, fullMarks: null },
        ],
      })
    );

    // Both the grade pill and the weighted figure; neither may show a zero.
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
