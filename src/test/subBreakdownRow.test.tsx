import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SubBreakdown } from '@/types/grades';
import { SubBreakdownRow } from '@/components/SubBreakdownRow';

/**
 * One graded item: a name, what was scored, and what it was out of.
 *
 * The rule that matters most here is what an empty box means. A blank row is
 * *not* a zero — it's a mark that hasn't come back yet, and treating it as zero
 * would drag a grade down for weeks. So blank has to clear the value to `null`,
 * a typed `0` has to survive as a real zero, and anything unparseable has to be
 * ignored rather than "corrected" into something the student didn't type.
 */

afterEach(cleanup);

const row = (over: Partial<SubBreakdown> = {}): SubBreakdown => ({
  id: 's1',
  breakdownId: 'b1',
  name: 'Quiz 3',
  achievedMarks: 8,
  fullMarks: 10,
  ...over,
});

const achieved = () => screen.getByLabelText('Marks achieved') as HTMLInputElement;
const outOf = () => screen.getByLabelText('Full marks') as HTMLInputElement;
const deleteButton = () => screen.getByRole('button', { name: 'Delete sub-breakdown' });

function renderRow(subBreakdown = row(), canDelete = true) {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  render(
    <TooltipProvider>
      <SubBreakdownRow
        subBreakdown={subBreakdown}
        canDelete={canDelete}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </TooltipProvider>
  );
  return { onUpdate, onDelete };
}

describe('SubBreakdownRow', () => {
  it('shows the marks and the percentage they make', () => {
    renderRow();

    expect(achieved().value).toBe('8');
    expect(outOf().value).toBe('10');
    expect(screen.getByText('80.00%')).toBeTruthy();
  });

  it('shows no percentage for a row with nothing to divide by', () => {
    renderRow(row({ fullMarks: 0 }));

    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it('shows no percentage until a mark has been entered', () => {
    renderRow(row({ achievedMarks: null, fullMarks: null }));

    expect(achieved().value).toBe('');
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it('shows a bonus mark as over 100 rather than capping it', () => {
    renderRow(row({ achievedMarks: 22, fullMarks: 20 }));

    expect(screen.getByText('110.00%')).toBeTruthy();
  });

  it('renames on typing', () => {
    const { onUpdate } = renderRow();

    fireEvent.change(screen.getByPlaceholderText('Sub-breakdown name'), {
      target: { value: 'Quiz 3 (dropped)' },
    });

    expect(onUpdate).toHaveBeenCalledWith({ name: 'Quiz 3 (dropped)' });
  });

  it('records a typed mark', () => {
    const { onUpdate } = renderRow();

    fireEvent.change(achieved(), { target: { value: '9.5' } });

    expect(onUpdate).toHaveBeenCalledWith({ achievedMarks: 9.5 });
  });

  it('records a real zero, which is a score and not a blank', () => {
    const { onUpdate } = renderRow();

    fireEvent.change(achieved(), { target: { value: '0' } });

    expect(onUpdate).toHaveBeenCalledWith({ achievedMarks: 0 });
  });

  it('clears a mark back to unentered when the box is emptied', () => {
    // `null`, never `0` — an unmarked row is excluded from the totals entirely.
    const { onUpdate } = renderRow();

    fireEvent.change(achieved(), { target: { value: '' } });

    expect(onUpdate).toHaveBeenCalledWith({ achievedMarks: null });
  });

  it('clears the total the same way', () => {
    const { onUpdate } = renderRow();

    fireEvent.change(outOf(), { target: { value: '' } });

    expect(onUpdate).toHaveBeenCalledWith({ fullMarks: null });
  });

  it('records a typed total', () => {
    const { onUpdate } = renderRow();

    fireEvent.change(outOf(), { target: { value: '20' } });

    expect(onUpdate).toHaveBeenCalledWith({ fullMarks: 20 });
  });

  it('never turns letters into a mark', () => {
    const { onUpdate } = renderRow();

    // A number field can't hold "abc" — it reports an empty value instead — so
    // this arrives as a clear, not as a number the student didn't type. The
    // `NaN` guard behind it is the belt to this braces.
    fireEvent.change(achieved(), { target: { value: 'abc' } });

    expect(onUpdate).toHaveBeenCalledWith({ achievedMarks: null });
  });

  it('confirms before deleting, naming what the row is worth', () => {
    const { onDelete } = renderRow();

    fireEvent.click(deleteButton());

    expect(screen.getByText('Delete Quiz 3?')).toBeTruthy();
    expect(screen.getByText(/marked 8 out of 10/)).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete row' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('says plainly that an unmarked row loses nothing', () => {
    renderRow(row({ achievedMarks: null, fullMarks: null }));

    fireEvent.click(deleteButton());

    expect(screen.getByText('Deleting this row cannot be undone.')).toBeTruthy();
  });

  it('falls back to a generic title for an unnamed row', () => {
    renderRow(row({ name: '  ' }));

    fireEvent.click(deleteButton());

    expect(screen.getByText('Delete this sub-breakdown?')).toBeTruthy();
  });

  it('cannot delete the last row in a breakdown', () => {
    renderRow(row(), false);

    expect(deleteButton()).toBeDisabled();
  });

  it('opens the re-mark dialog from its own button', () => {
    // Separate from the boxes on purpose: this keeps the percentage, typing
    // over the total does not.
    renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Change full mark' }));

    expect(screen.getByRole('heading', { name: 'Change full mark' })).toBeTruthy();
  });

  it('applies a re-mark through the same update path', () => {
    const { onUpdate } = renderRow();

    fireEvent.click(screen.getByRole('button', { name: 'Change full mark' }));
    fireEvent.change(document.getElementById('new-full-mark') as HTMLInputElement, {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onUpdate).toHaveBeenCalledWith({ fullMarks: 30, achievedMarks: 24 });
  });
});
