import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { AboutDialog } from '@/components/AboutDialog';
import { Github, Mail } from 'lucide-react';

/**
 * The info button on the sign-in screen and the "about" it opens.
 *
 * The contacts are placeholders until the author fills them in, so what matters
 * is that an unfilled one shows as text rather than a link to nowhere, and that
 * a filled one becomes a real link.
 */

afterEach(cleanup);

const open = () => fireEvent.click(screen.getByRole('button', { name: 'About this app' }));

describe('AboutDialog', () => {
  it('stays closed until the info button is pressed', () => {
    render(<AboutDialog />);

    expect(screen.queryByRole('dialog')).toBeNull();

    open();

    expect(screen.getByRole('dialog', { name: 'About UBC Grade Calculator' })).toBeTruthy();
  });

  it('introduces the app', () => {
    render(<AboutDialog />);

    open();

    expect(screen.getByText(/work out your course grades as you enter each mark/i)).toBeTruthy();
  });

  it('lists the tech stack', () => {
    render(<AboutDialog />);

    open();

    for (const tech of ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Supabase']) {
      expect(screen.getByText(tech)).toBeTruthy();
    }
  });

  it('lists every contact, unlinked while it is still a placeholder', () => {
    render(<AboutDialog />);

    open();

    const dialog = screen.getByRole('dialog');
    for (const label of ['GitHub', 'LinkedIn', 'Email', 'Personal Profile']) {
      expect(within(dialog).getByText(label)).toBeTruthy();
    }
    expect(within(dialog).getAllByText('[placeholder]')).toHaveLength(4);
    expect(within(dialog).queryAllByRole('link')).toHaveLength(0);
  });

  it('links a contact once it has somewhere to go', () => {
    render(
      <AboutDialog
        contacts={[
          { label: 'GitHub', icon: Github, text: 'octocat', href: 'https://github.com/octocat' },
          { label: 'Email', icon: Mail, text: '[placeholder]', href: null },
        ]}
      />
    );

    open();

    const link = screen.getByRole('link', { name: 'octocat' });
    expect(link.getAttribute('href')).toBe('https://github.com/octocat');
    // A new tab, so following it doesn't navigate away from the sign-in form.
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
