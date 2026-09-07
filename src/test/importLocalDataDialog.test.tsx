import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ImportLocalDataDialog } from '@/components/ImportLocalDataDialog';

/**
 * The one-time offer of courses saved in this browser before the app had
 * accounts.
 *
 * Both buttons are a final answer — the offer isn't made again either way — so
 * every route out has to reach a handler. Dismissing it by pressing Escape is
 * the one that would otherwise leave the offer to reappear on the next render.
 */

afterEach(cleanup);

function open(courseCount = 3) {
  const onImport = vi.fn();
  const onDecline = vi.fn();
  render(
    <ImportLocalDataDialog
      open
      courseCount={courseCount}
      onImport={onImport}
      onDecline={onDecline}
    />
  );
  return { onImport, onDecline };
}

const description = () => screen.getByText(/from before you had an account/).textContent ?? '';

describe('ImportLocalDataDialog', () => {
  it('says how much is on offer', () => {
    open(3);

    expect(description()).toMatch(/3 courses/);
    expect(description()).toMatch(/are still saved/);
  });

  it('reads correctly for a single course', () => {
    open(1);

    expect(description()).toMatch(/1 course /);
    expect(description()).toMatch(/is still saved/);
    expect(description()).toMatch(/Import it/);
  });

  it('imports on request', () => {
    const { onImport, onDecline } = open();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
  });

  it('declines on request', () => {
    const { onImport, onDecline } = open();

    fireEvent.click(screen.getByRole('button', { name: /start fresh/i }));

    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('treats a dismissal as declining, so the offer is settled either way', () => {
    const { onImport, onDecline } = open();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalled();
  });
});
