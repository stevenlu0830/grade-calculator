import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AddBreakdownDialog } from '@/components/AddBreakdownDialog';

/**
 * One weighted line of a syllabus, before it exists.
 *
 * Three things here are easy to get wrong and expensive to notice later: the
 * singular that new rows will be auto-named from has to come from the preset
 * rather than the label, a custom name has to be its own singular, and a policy
 * switched on with an empty box has to be refused *and* revealed — the advanced
 * section is collapsed by default, so complaining about a field nobody can see
 * would be a dead end.
 */

afterEach(cleanup);

const weightField = () => document.getElementById('breakdown-weight') as HTMLInputElement;
const addButton = () => screen.getByRole('button', { name: 'Add' });
const setWeight = (value: string) => fireEvent.change(weightField(), { target: { value } });

/** Opens the breakdown dropdown by keyboard and picks an option. */
function chooseType(option: string) {
  fireEvent.keyDown(document.getElementById('breakdown-type') as HTMLElement, { key: 'ArrowDown' });
  fireEvent.click(screen.getByRole('option', { name: option }));
}

const openAdvanced = () =>
  fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));

function open() {
  const onAdd = vi.fn();
  const onOpenChange = vi.fn();
  render(<AddBreakdownDialog open onOpenChange={onOpenChange} onAdd={onAdd} />);
  return { onAdd, onOpenChange };
}

describe('AddBreakdownDialog', () => {
  it('needs both a type and a weight before it can be added', () => {
    open();
    expect(addButton()).toBeDisabled();

    chooseType('Assignments');
    expect(addButton()).toBeDisabled();

    setWeight('40');
    expect(addButton()).toBeEnabled();
  });

  it('carries the preset’s singular, which is what auto-names new rows', () => {
    // "Assignments" has to produce "Assignment 1", not "Assignments 1".
    const { onAdd, onOpenChange } = open();

    chooseType('Assignments');
    setWeight('40');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Assignments', weight: 40, subBreakdownLabel: 'Assignment' })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('asks for a name only when the type is Others', () => {
    open();
    expect(document.getElementById('breakdown-custom-name')).toBeNull();

    chooseType('Others (Specify)');

    expect(document.getElementById('breakdown-custom-name')).toBeTruthy();
  });

  it('trims a custom name and uses it as its own singular', () => {
    const { onAdd } = open();

    chooseType('Others (Specify)');
    fireEvent.change(document.getElementById('breakdown-custom-name') as HTMLInputElement, {
      target: { value: '  Reading Responses  ' },
    });
    setWeight('15');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Reading Responses', subBreakdownLabel: 'Reading Responses' })
    );
  });

  it('stays disabled while a custom name is blank', () => {
    open();

    chooseType('Others (Specify)');
    setWeight('15');

    expect(addButton()).toBeDisabled();
  });

  it('adds with no policy at all, which is what most breakdowns want', () => {
    const { onAdd } = open();

    chooseType('Final Exam');
    setWeight('45');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        dropLowestCount: null,
        downweightLowestCount: null,
        fullCreditGrade: null,
        isBonus: false,
        equalWeightSubBreakdowns: false,
      })
    );
  });

  it('keeps advanced options collapsed until asked for', () => {
    open();

    expect(screen.queryByRole('switch', { name: 'Drop lowest' })).toBeNull();

    openAdvanced();

    expect(screen.getByRole('switch', { name: 'Drop lowest' })).toBeTruthy();
  });

  it('carries a policy set here through to the new breakdown', () => {
    const { onAdd } = open();

    chooseType('Quizzes');
    setWeight('20');
    openAdvanced();
    fireEvent.click(screen.getByRole('switch', { name: 'Drop lowest' }));
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ dropLowestCount: 1 }));
  });

  it('summarises an active policy while the section is collapsed', () => {
    // Otherwise a rule set and then folded away is invisible at the moment of
    // pressing Add.
    open();
    openAdvanced();
    fireEvent.click(screen.getByRole('switch', { name: 'Bonus grade' }));

    openAdvanced();

    expect(screen.getByText(/bonus/i)).toBeTruthy();
  });

  it('reopens the collapsed section to show which box it is complaining about', () => {
    const { onAdd } = open();
    chooseType('Quizzes');
    setWeight('20');
    openAdvanced();
    fireEvent.click(screen.getByRole('switch', { name: 'Drop lowest' }));
    fireEvent.change(screen.getByLabelText('Number to drop'), { target: { value: '' } });
    openAdvanced(); // Fold it away again, with the empty box inside.

    fireEvent.click(addButton());

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText(/can't have an empty box/i)).toBeTruthy();
    expect(screen.getByLabelText('Number to drop')).toBeTruthy();
  });

  it('adds nothing if the form is submitted before it is complete', () => {
    // Return from a field reaches the form even while Add is disabled.
    const { onAdd } = open();
    chooseType('Assignments');

    fireEvent.submit(weightField().closest('form') as HTMLFormElement);

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('forgets everything on cancel, policy included', () => {
    const { onAdd, onOpenChange } = open();
    chooseType('Quizzes');
    setWeight('20');
    openAdvanced();
    fireEvent.click(screen.getByRole('switch', { name: 'Bonus grade' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(addButton()).toBeDisabled();
    expect(weightField().value).toBe('');
    // The advanced section is collapsed again, and holds no leftover switch.
    expect(screen.queryByRole('switch', { name: 'Bonus grade' })).toBeNull();
  });
});
