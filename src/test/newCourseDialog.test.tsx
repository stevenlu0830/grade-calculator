import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NewCourseDialog } from '@/components/NewCourseDialog';

/** Prompts for a course name. Small, but it owns the draft, so Cancel has work to do. */

afterEach(cleanup);

const nameField = () => document.getElementById('course-name') as HTMLInputElement;
const addButton = () => screen.getByRole('button', { name: /add course/i });
const type = (value: string) => fireEvent.change(nameField(), { target: { value } });

function open(semester?: string) {
  const onAdd = vi.fn();
  const onOpenChange = vi.fn();
  const view = render(
    <NewCourseDialog open onOpenChange={onOpenChange} onAdd={onAdd} semester={semester} />
  );
  return { onAdd, onOpenChange, view };
}

describe('NewCourseDialog', () => {
  it('says which semester the course will land in', () => {
    open('2026 Winter Term 1');

    expect(screen.getByText(/added to 2026 Winter Term 1/)).toBeTruthy();
  });

  it('falls back to a generic description with no semester named', () => {
    open();

    expect(screen.getByText(/rename it later/i)).toBeTruthy();
  });

  it('cannot be submitted empty', () => {
    open();

    expect(addButton()).toBeDisabled();
  });

  it('cannot be submitted with only spaces', () => {
    const { onAdd } = open();

    type('   ');

    expect(addButton()).toBeDisabled();
    fireEvent.submit(nameField().closest('form') as HTMLFormElement);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('adds the trimmed name and closes', () => {
    const { onAdd, onOpenChange } = open();

    type('  CPSC 121  ');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith('CPSC 121');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('submits on Return, so the name field is the whole interaction', () => {
    const { onAdd } = open();

    type('MATH 200');
    fireEvent.submit(nameField().closest('form') as HTMLFormElement);

    expect(onAdd).toHaveBeenCalledWith('MATH 200');
  });

  it('cancels without adding, and forgets what was typed', () => {
    const { onAdd, onOpenChange } = open();

    type('CPSC 121');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // The draft is cleared on the way out, so reopening doesn't offer a name the
    // student already decided against.
    expect(nameField().value).toBe('');
  });

  it('clears the draft after a successful add too', () => {
    open();

    type('CPSC 121');
    fireEvent.click(addButton());

    expect(nameField().value).toBe('');
  });
});
