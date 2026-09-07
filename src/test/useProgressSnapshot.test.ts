import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Course, GradeData } from '@/types/grades';
import { ProgressSnapshot } from '@/lib/supabaseProgress';

/**
 * Save Progress and Reload Progress, as the buttons in the header drive them.
 *
 * The row-building is asserted in `supabaseProgress.test.ts`; what is here is
 * the part the student actually experiences — which of the four outcomes each
 * press produces, and, for the two that refuse, that nothing on screen is
 * touched. A reload replaces the whole tree, so "your saved copy is empty" has
 * to stop before it wipes an afternoon's work.
 */

const save = vi.fn<[GradeData], Promise<void>>();
const load = vi.fn<[], Promise<ProgressSnapshot | null>>();
/** Whose snapshot each call reached for. */
const openedFor: string[] = [];

vi.mock('@/lib/supabaseProgress', () => ({
  supabaseProgressStorage: (userId: string) => {
    openedFor.push(userId);
    return { save, load };
  },
}));

const success = vi.fn();
const failure = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => failure(...args),
  },
}));

const { useProgressSnapshot } = await import('@/hooks/useProgressSnapshot');

const course = (name: string): Course => ({
  id: `id-${name}`,
  name,
  semester: '2026 Winter Term 1',
  breakdowns: [],
});

const SEMESTERS = ['2026 Winter Term 1'];

/** The hook as `Index` calls it, with a spy standing in for `importData`. */
function renderSnapshot(courses: Course[] = [course('CPSC 320')], semesters = SEMESTERS) {
  const onLoad = vi.fn();
  const { result } = renderHook(() => useProgressSnapshot('user-1', courses, semesters, onLoad));
  return { onLoad, saveProgress: () => result.current.saveProgress(), reload: () => result.current.reloadProgress() };
}

/** The text of the last toast — its title, and the description under it. */
const lastToast = (spy: typeof success) => JSON.stringify(spy.mock.calls.at(-1));

beforeEach(() => {
  save.mockReset().mockResolvedValue(undefined);
  load.mockReset().mockResolvedValue(null);
  success.mockReset();
  failure.mockReset();
  openedFor.length = 0;
  // The two failure paths log before they toast; the console noise is expected.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('saveProgress', () => {
  it('writes the courses and semesters that are on screen, to this account', async () => {
    const courses = [course('CPSC 320'), course('MATH 200')];
    const { saveProgress } = renderSnapshot(courses);

    await act(saveProgress);

    expect(openedFor).toEqual(['user-1']);
    expect(save).toHaveBeenCalledWith({ courses, semesters: SEMESTERS });
  });

  it('reports how much was saved, since that is the only acknowledgement', async () => {
    const { saveProgress } = renderSnapshot([course('CPSC 320'), course('MATH 200')]);

    await act(saveProgress);

    expect(success).toHaveBeenCalledWith('2 Courses Saved');
  });

  it('says "1 Course" rather than "1 Courses"', async () => {
    const { saveProgress } = renderSnapshot([course('CPSC 320')]);

    await act(saveProgress);

    expect(success).toHaveBeenCalledWith('1 Course Saved');
  });

  it('saves an empty screen rather than quietly keeping the previous snapshot', async () => {
    // Deleting every course and pressing Save has to leave the snapshot empty,
    // or the next reload would resurrect them.
    const { saveProgress } = renderSnapshot([], SEMESTERS);

    await act(saveProgress);

    expect(save).toHaveBeenCalledWith({ courses: [], semesters: SEMESTERS });
    expect(lastToast(success)).toMatch(/1 empty semester/);
  });

  it('says there was nothing at all to save when there are no semesters either', async () => {
    const { saveProgress } = renderSnapshot([], []);

    await act(saveProgress);

    expect(lastToast(success)).toMatch(/no courses to save/i);
  });

  it('reports a failed write instead of claiming a save that never happened', async () => {
    save.mockRejectedValue(new Error('row level security'));
    const { saveProgress } = renderSnapshot();

    await act(saveProgress);

    expect(success).not.toHaveBeenCalled();
    expect(lastToast(failure)).toMatch(/row level security/);
  });

  it('reports a thrown non-Error too', async () => {
    save.mockRejectedValue('offline');
    const { saveProgress } = renderSnapshot();

    await act(saveProgress);

    expect(lastToast(failure)).toMatch(/offline/);
  });
});

describe('reloadProgress', () => {
  const snapshot = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
    courses: [course('CPSC 320')],
    semesters: SEMESTERS,
    savedAt: null,
    ...over,
  });

  it('puts the saved copy back on screen', async () => {
    const restored = snapshot();
    load.mockResolvedValue(restored);
    const { onLoad, reload } = renderSnapshot();

    await act(reload);

    expect(onLoad).toHaveBeenCalledWith({
      courses: restored.courses,
      semesters: restored.semesters,
    });
    expect(success).toHaveBeenCalledWith('Reloaded 1 course', expect.anything());
  });

  it('says when the copy was taken — the one thing the student cannot see', async () => {
    const savedAt = new Date('2026-08-19T14:03:00.000Z');
    load.mockResolvedValue(snapshot({ savedAt }));
    const { reload } = renderSnapshot();

    await act(reload);

    expect(lastToast(success)).toContain(savedAt.toLocaleString());
  });

  it('refuses, without wiping the screen, when nothing was ever saved', async () => {
    load.mockResolvedValue(null);
    const { onLoad, reload } = renderSnapshot();

    await act(reload);

    expect(onLoad).not.toHaveBeenCalled();
    expect(lastToast(failure)).toMatch(/nothing saved yet/i);
  });

  it('refuses a snapshot with neither courses nor semesters', async () => {
    // Restoring it could only blank the screen, so it stops here — and says so,
    // rather than looking like the button did nothing.
    load.mockResolvedValue(snapshot({ courses: [], semesters: [] }));
    const { onLoad, reload } = renderSnapshot();

    await act(reload);

    expect(onLoad).not.toHaveBeenCalled();
    expect(lastToast(failure)).toMatch(/empty/i);
  });

  it('restores a snapshot of empty semesters, which is worth having', async () => {
    load.mockResolvedValue(snapshot({ courses: [], semesters: ['2025 Summer Term 1'] }));
    const { onLoad, reload } = renderSnapshot();

    await act(reload);

    expect(onLoad).toHaveBeenCalledWith({ courses: [], semesters: ['2025 Summer Term 1'] });
    expect(success).toHaveBeenCalledWith('Reloaded 0 courses', expect.anything());
  });

  it('reports a failed read rather than replacing the screen with nothing', async () => {
    load.mockRejectedValue(new Error('offline'));
    const { onLoad, reload } = renderSnapshot();

    await act(reload);

    expect(onLoad).not.toHaveBeenCalled();
    expect(lastToast(failure)).toMatch(/offline/);
  });
});
