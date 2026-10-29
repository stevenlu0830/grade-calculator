import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AuthLayout } from '@/components/AuthLayout';
import { CourseToolbar } from '@/components/CourseToolbar';
import { FullPageLoader } from '@/components/FullPageLoader';
import { SupabaseSetupNotice } from '@/components/SupabaseSetupNotice';

/**
 * The four chrome pieces with no state of their own.
 *
 * Grouped because each is a handful of lines, and what is worth asserting about
 * them is the same thing: that the words the student reads are the ones the
 * caller asked for, and that the buttons are reachable by name — the header
 * ones especially, since two of them are irreversible in different directions.
 */

afterEach(cleanup);

describe('FullPageLoader', () => {
  it('says which wait this is', () => {
    // There are two, and "Loading…" alone leaves a slow account looking stuck.
    render(<FullPageLoader label="Loading your courses…" />);

    expect(screen.getByText('Loading your courses…')).toBeTruthy();
  });
});

describe('SupabaseSetupNotice', () => {
  it('names the step that was skipped rather than a login form that can only fail', () => {
    render(<SupabaseSetupNotice />);

    expect(screen.getByText(/isn’t configured yet/i)).toBeTruthy();
    expect(screen.getByText('.env.local')).toBeTruthy();
    expect(screen.getByText(/0001_user_data\.sql/)).toBeTruthy();
  });

  it('explains that the anon key is meant to be public', () => {
    // Otherwise the instructions read as "paste your secret into a client app".
    render(<SupabaseSetupNotice />);

    expect(screen.getByText(/anon key is meant to be public/i)).toBeTruthy();
    expect(screen.getByText(/Row-level security/i)).toBeTruthy();
  });
});

describe('AuthLayout', () => {
  it('wraps its children in the shared card, under the app name', () => {
    render(
      <AuthLayout subtitle="Sign in to keep your courses." title="Welcome" description="Only you.">
        <button>Sign in</button>
      </AuthLayout>
    );

    expect(screen.getByRole('heading', { name: 'UBC Grade Calculator' })).toBeTruthy();
    expect(screen.getByText('Sign in to keep your courses.')).toBeTruthy();
    expect(screen.getByText('Welcome')).toBeTruthy();
    expect(screen.getByText('Only you.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('shows the credits, since every visitor passes through this screen', () => {
    render(
      <AuthLayout subtitle="Sign in to keep your courses." title="Welcome" description="Only you.">
        <button>Sign in</button>
      </AuthLayout>
    );

    expect(screen.getByRole('link', { name: /awicon - flaticon/i })).toBeTruthy();
  });
});

describe('CourseToolbar', () => {
  const buttons = () => ({
    reload: screen.getByRole('button', { name: /reload progress/i }),
    save: screen.getByRole('button', { name: /save progress/i }),
    add: screen.getByRole('button', { name: /new course/i }),
  });

  it('offers the three header actions', () => {
    render(<CourseToolbar onReloadClick={() => {}} onSaveClick={() => {}} onAddCourse={() => {}} />);

    const { reload, save, add } = buttons();
    expect(reload).toBeTruthy();
    expect(save).toBeTruthy();
    expect(add).toBeTruthy();
  });

  it('wires each button to its own handler', () => {
    // Reload replaces the screen and Save overwrites the snapshot, so crossing
    // these two would destroy work in either direction.
    const calls: string[] = [];
    render(
      <CourseToolbar
        onReloadClick={() => calls.push('reload')}
        onSaveClick={() => calls.push('save')}
        onAddCourse={() => calls.push('add')}
      />
    );

    const { reload, save, add } = buttons();
    reload.click();
    save.click();
    add.click();

    expect(calls).toEqual(['reload', 'save', 'add']);
  });
});
