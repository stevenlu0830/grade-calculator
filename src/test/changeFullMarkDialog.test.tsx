import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SubBreakdown } from '@/types/grades';
import { ChangeFullMarkDialog } from '@/components/ChangeFullMarkDialog';

/**
 * Restating one row out of a different number of marks.
 *
 * This exists because typing over the "out of" box does the *other* thing — it
 * turns an 8/10 into an 8/30, a much worse grade — so the scaling has to be a
 * deliberate, separate action that shows its work before it commits.
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

const entry = () => document.getElementById('new-full-mark') as HTMLInputElement;
const type = (value: string) => fireEvent.change(entry(), { target: { value } });
const applyButton = () => screen.getByRole('button', { name: 'Apply' });
/** The line that spells out what the change will do. */
const preview = () => entry().closest('form')?.querySelector('.bg-secondary\\/50') as HTMLElement;

function open(subBreakdown = row()) {
  const onApply = vi.fn();
  const onOpenChange = vi.fn();
  const view = render(
    <ChangeFullMarkDialog
      open
      onOpenChange={onOpenChange}
      subBreakdown={subBreakdown}
      onApply={onApply}
    />
  );
  return { onApply, onOpenChange, view };
}

describe('ChangeFullMarkDialog', () => {
  it('opens on what the row is currently out of', () => {
    open();

    expect(entry().value).toBe('10');
  });

  it('names the row it is about', () => {
    open();

    expect(screen.getByText(/What Quiz 3 is marked out of/)).toBeTruthy();
  });

  it('falls back to "this row" for an unnamed one', () => {
    open(row({ name: '   ' }));

    expect(screen.getByText(/What this row is marked out of/)).toBeTruthy();
  });

  it('previews the scaling before anything is committed', () => {
    open();

    type('30');

    // The whole point: 80% stays 80%, so the mark moves with the total.
    expect(preview().textContent).toContain('8 / 10');
    expect(preview().textContent).toContain('(80.00%)');
    expect(preview().textContent).toContain('24 / 30');
  });

  it('applies both halves together and closes', () => {
    const { onApply, onOpenChange } = open();

    type('30');
    fireEvent.click(applyButton());

    expect(onApply).toHaveBeenCalledWith({ fullMarks: 30, achievedMarks: 24 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies on Return', () => {
    const { onApply } = open();

    type('20');
    fireEvent.submit(entry().closest('form') as HTMLFormElement);

    expect(onApply).toHaveBeenCalledWith({ fullMarks: 20, achievedMarks: 16 });
  });

  it('changes only the total for a row with no mark yet', () => {
    const { onApply } = open(row({ achievedMarks: null, fullMarks: null }));

    type('25');
    fireEvent.click(applyButton());

    expect(onApply).toHaveBeenCalledWith({ fullMarks: 25, achievedMarks: null });
  });

  it('says when there is nothing to scale from', () => {
    open(row({ achievedMarks: 8, fullMarks: 0 }));

    expect(screen.getByText(/no full marks to scale from/i)).toBeTruthy();
  });

  it('refuses a blank rather than inventing a total', () => {
    const { onApply } = open();

    type('');
    fireEvent.click(applyButton());

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/can’t be blank or negative/i)).toBeTruthy();
    expect(preview().textContent).toContain('—');
  });

  it('refuses a negative total, twice over', () => {
    const { onApply } = open();

    type('-5');

    // The field's own `min` stops the press reaching the handler at all…
    expect(entry().validity.rangeUnderflow).toBe(true);
    fireEvent.click(applyButton());
    expect(onApply).not.toHaveBeenCalled();

    // …and the handler refuses it too, for anything that gets past that.
    fireEvent.submit(entry().closest('form') as HTMLFormElement);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/can’t be blank or negative/i)).toBeTruthy();
  });

  it('drops the complaint as soon as the box is typed in again', () => {
    open();
    type('');
    fireEvent.click(applyButton());

    type('20');

    expect(screen.queryByText(/can’t be blank or negative/i)).toBeNull();
  });

  it('keeps a bonus mark above full rather than correcting it', () => {
    // 22/20 is a real thing a course can award; scaling must not clamp it.
    const { onApply } = open(row({ achievedMarks: 22, fullMarks: 20 }));

    type('40');
    fireEvent.click(applyButton());

    expect(onApply).toHaveBeenCalledWith({ fullMarks: 40, achievedMarks: 44 });
  });

  it('discards an abandoned entry, so Cancel really does discard', () => {
    const { onApply, onOpenChange, view } = open();
    type('999');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onApply).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // The form is keyed on `open`, so reopening starts from the row again.
    view.rerender(
      <ChangeFullMarkDialog
        open={false}
        onOpenChange={() => {}}
        subBreakdown={row()}
        onApply={() => {}}
      />
    );
    view.rerender(
      <ChangeFullMarkDialog open onOpenChange={() => {}} subBreakdown={row()} onApply={() => {}} />
    );
    expect(entry().value).toBe('10');
  });
});
