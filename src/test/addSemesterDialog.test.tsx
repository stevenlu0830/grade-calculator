import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AddSemesterDialog } from '@/components/AddSemesterDialog';

/**
 * Picks a year and a term and joins them into the label everything else stores.
 *
 * The year list is injected rather than read from the clock, so these assert the
 * range as well as the joining — a student entering last year's transcript needs
 * the past on the list, and someone planning ahead needs next year.
 */

afterEach(cleanup);

const addButton = () => screen.getByRole('button', { name: 'Add' });

/**
 * Opens a Radix select and picks an option by its text.
 *
 * Keyboard rather than a click: the listbox positions itself against a layout
 * jsdom doesn't compute, and `ArrowDown` is the documented way in regardless.
 */
function choose(triggerId: string, option: string) {
  fireEvent.keyDown(document.getElementById(triggerId) as HTMLElement, { key: 'ArrowDown' });
  fireEvent.click(screen.getByRole('option', { name: option }));
}

function open(referenceYear = 2026) {
  const onAdd = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <AddSemesterDialog
      open
      onOpenChange={onOpenChange}
      onAdd={onAdd}
      referenceYear={referenceYear}
    />
  );
  return { onAdd, onOpenChange };
}

describe('AddSemesterDialog', () => {
  it('cannot be submitted until both halves are chosen', () => {
    open();
    expect(addButton()).toBeDisabled();

    choose('semester-year', '2026');
    expect(addButton()).toBeDisabled();

    choose('semester-term', 'Winter Term 1');
    expect(addButton()).toBeEnabled();
  });

  it('joins the two into the label the rest of the app stores', () => {
    const { onAdd, onOpenChange } = open();

    choose('semester-year', '2026');
    choose('semester-term', 'Summer Term 2');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith('2026 Summer Term 2');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('offers years either side of now, for a past transcript or a future plan', () => {
    open(2026);

    fireEvent.keyDown(document.getElementById('semester-year') as HTMLElement, {
      key: 'ArrowDown',
    });

    expect(screen.getByRole('option', { name: '2027' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '2021' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: '2028' })).toBeNull();
  });

  it('offers all four terms', () => {
    open();

    fireEvent.keyDown(document.getElementById('semester-term') as HTMLElement, {
      key: 'ArrowDown',
    });

    for (const term of ['Winter Term 1', 'Winter Term 2', 'Summer Term 1', 'Summer Term 2']) {
      expect(screen.getByRole('option', { name: term })).toBeTruthy();
    }
  });

  it('adds nothing if the form is submitted with a half-made choice', () => {
    // The button is disabled, but Return from a focused field reaches the form
    // regardless — and half a semester is not a semester.
    const { onAdd } = open();
    choose('semester-year', '2026');

    fireEvent.submit(addButton().closest('form') as HTMLFormElement);

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('forgets both choices on cancel', () => {
    const { onAdd, onOpenChange } = open();

    choose('semester-year', '2026');
    choose('semester-term', 'Winter Term 1');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Reopening starts from the placeholders, not from a half-made decision.
    expect(addButton()).toBeDisabled();
  });
});
