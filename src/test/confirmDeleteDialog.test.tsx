import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

/**
 * The confirmation every delete in the app goes through.
 *
 * There is no undo anywhere here, so this dialog is the only safety net — which
 * makes two things worth pinning down: that it says nothing until it is opened,
 * and that dismissing it never reaches the caller's `onConfirm`.
 */

afterEach(cleanup);

const confirmButton = () => screen.getByRole('button', { name: 'Delete course' });

function open(onConfirm = vi.fn(), onOpenChange = vi.fn()) {
  render(
    <ConfirmDeleteDialog
      open
      onOpenChange={onOpenChange}
      title='Delete "CPSC 110"?'
      description="Deleting a course also deletes everything under it — 3 breakdowns."
      confirmLabel="Delete course"
      onConfirm={onConfirm}
    />
  );
  return { onConfirm, onOpenChange };
}

describe('ConfirmDeleteDialog', () => {
  it('shows nothing while it is closed', () => {
    render(
      <ConfirmDeleteDialog
        open={false}
        onOpenChange={() => {}}
        title='Delete "CPSC 110"?'
        description="Everything under it goes too."
        onConfirm={() => {}}
      />
    );

    expect(screen.queryByText('Delete "CPSC 110"?')).toBeNull();
  });

  it('names what is going, and what else goes with it', () => {
    open();

    expect(screen.getByText('Delete "CPSC 110"?')).toBeTruthy();
    expect(screen.getByText(/3 breakdowns/)).toBeTruthy();
  });

  it('confirms through the caller', () => {
    const { onConfirm } = open();

    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancels without deleting anything', () => {
    const { onConfirm, onOpenChange } = open();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('treats Escape as a cancel, not as a confirm', () => {
    const { onConfirm, onOpenChange } = open();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('falls back to a plain "Delete" when the caller names no verb', () => {
    render(
      <ConfirmDeleteDialog
        open
        onOpenChange={() => {}}
        title="Delete this row?"
        description="This cannot be undone."
        onConfirm={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
});
