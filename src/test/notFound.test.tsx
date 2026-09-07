import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '@/pages/NotFound';

/** The catch-all route. Small, but it is the only screen with no way back except its link. */

let logged: unknown[][];

beforeEach(() => {
  logged = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => void logged.push(args));
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NotFound />
    </MemoryRouter>
  );

describe('NotFound', () => {
  it('says what happened and offers the way home', () => {
    renderAt('/nope');

    expect(screen.getByRole('heading', { name: '404' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /return to home/i }).getAttribute('href')).toBe('/');
  });

  it('logs the path that missed, which is the only record of a broken link', () => {
    renderAt('/courses/does-not-exist');

    expect(logged.at(-1)?.at(-1)).toBe('/courses/does-not-exist');
  });
});
