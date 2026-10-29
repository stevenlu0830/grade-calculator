import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FeatureGuideDialog } from '@/components/FeatureGuideDialog';

/**
 * The info button on the main screen and the paged guide it opens.
 *
 * What's worth pinning down is the paging: it starts at the introduction every
 * time, Back and Next walk one page at a time without running off either end,
 * every page is reachable, and the last one closes the guide.
 */

afterEach(cleanup);

const open = () => fireEvent.click(screen.getByRole('button', { name: 'App guide' }));
const title = () => screen.getByRole('heading').textContent;
const next = () => fireEvent.click(screen.getByRole('button', { name: /next/i }));
const back = () => screen.getByRole('button', { name: /back/i });
const dots = () => screen.getAllByRole('button', { name: /^page \d+:/i });

describe('FeatureGuideDialog', () => {
  it('stays closed until the info button is pressed, then opens on the introduction', () => {
    render(<FeatureGuideDialog />);

    expect(screen.queryByRole('dialog')).toBeNull();

    open();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(title()).toBe('Welcome to UBC Grade Calculator');
    expect(screen.getByText(/saves to your account automatically/i)).toBeTruthy();
    // Nothing before the first page.
    expect(back()).toBeDisabled();
  });

  it('walks through a page per feature, one at a time, and the last one closes', () => {
    render(<FeatureGuideDialog />);
    open();

    const pageCount = dots().length;
    const seen = [title()];
    while (!screen.queryByRole('button', { name: 'Done' })) {
      next();
      seen.push(title());
    }

    // Every dot's page was visited exactly once, in order.
    expect(seen).toHaveLength(pageCount);
    expect(new Set(seen).size).toBe(pageCount);
    expect(seen).toContain('Drop lowest');
    expect(screen.getByText(`${pageCount} / ${pageCount}`)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('goes back a page', () => {
    render(<FeatureGuideDialog />);
    open();

    next();
    expect(title()).toBe('Semesters');

    fireEvent.click(back());
    expect(title()).toBe('Welcome to UBC Grade Calculator');
  });

  it('jumps straight to a page from its dot, and marks it as the current one', () => {
    render(<FeatureGuideDialog />);
    open();

    const target = screen.getByRole('button', { name: /: bonus grade$/i });
    fireEvent.click(target);

    expect(title()).toBe('Bonus grade');
    expect(target.getAttribute('aria-current')).toBe('step');
    expect(dots().filter(dot => dot.getAttribute('aria-current'))).toHaveLength(1);
  });

  it('starts from the introduction again when reopened', () => {
    render(<FeatureGuideDialog />);
    open();
    next();
    next();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    open();

    expect(title()).toBe('Welcome to UBC Grade Calculator');
  });
});
