import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AppCredits } from '@/components/AppCredits';

/**
 * The disclaimer and the icon credit.
 *
 * Both are obligations rather than copy: the icon's free licence holds only
 * while the credit is visible and links back, and the disclaimer is what keeps
 * a "UBC" in the app's name from reading as an official tool.
 */

afterEach(cleanup);

describe('AppCredits', () => {
  it('says the app is not an official UBC tool', () => {
    render(<AppCredits />);

    expect(screen.getByText(/not affiliated with or endorsed by the university of british columbia/i)).toBeTruthy();
  });

  it('credits the icon in the form Flaticon asks for, linking back to it', () => {
    render(<AppCredits />);

    const link = screen.getByRole('link', { name: 'Exam icons created by Awicon - Flaticon' });
    expect(link.getAttribute('href')).toBe('https://www.flaticon.com/free-icons/exam');
    // A new tab, so following the credit doesn't navigate away from unsaved edits.
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
