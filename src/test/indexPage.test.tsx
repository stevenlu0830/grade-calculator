import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GradeData } from '@/types/grades';
import { CourseStorage } from '@/lib/courseStorage';

/**
 * The whole screen, driven end to end against an in-memory account.
 *
 * Everything below this is unit-tested next door; what only shows up here is the
 * wiring between them — that a course lands in the semester on the left, that
 * the selection survives a semester being deleted out from under it, and that a
 * load which failed stops the app rather than letting an empty tree be saved
 * over a term's work.
 */

const saveSnapshot = vi.fn<[GradeData], Promise<void>>();
const loadSnapshot = vi.fn();

vi.mock('@/lib/supabaseProgress', () => ({
  supabaseProgressStorage: () => ({ save: saveSnapshot, load: loadSnapshot }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const Index = (await import('@/pages/Index')).default;

const user = { id: 'user-1', email: 'student@ubc.ca' } as User;

/** An account in memory, so the store's own load/save loop runs for real. */
function memoryStorage(initial: GradeData = { courses: [], semesters: [] }): CourseStorage {
  let held = initial;
  return {
    load: async () => held,
    save: async (data: GradeData) => void (held = data),
  };
}

/** Storage whose read fails, which is the case the app has to refuse to edit on. */
const brokenStorage = (): CourseStorage => ({
  load: async () => {
    throw new Error('network down');
  },
  save: async () => {},
});

async function renderApp(storage: CourseStorage = memoryStorage()) {
  // `App` supplies the provider in the real tree; the semester rows and the
  // breakdown headers both render tooltips.
  const view = render(
    <TooltipProvider>
      <Index storage={storage} user={user} />
    </TooltipProvider>
  );
  // The first paint is the loader; everything below waits for the account.
  await waitFor(() => expect(screen.queryByText(/Loading your courses/)).toBeNull());
  return view;
}

/** Adds a semester through the dialog, exactly as a student would. */
function addSemester(year = '2026', term = 'Winter Term 1') {
  fireEvent.click(screen.getByRole('button', { name: /add semester/i }));
  for (const [id, option] of [
    ['semester-year', year],
    ['semester-term', term],
  ] as const) {
    fireEvent.keyDown(document.getElementById(id) as HTMLElement, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: option }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

/** Adds a course through the header button and its dialog. */
function addCourse(name: string) {
  fireEvent.click(screen.getByRole('button', { name: /new course/i }));
  fireEvent.change(document.getElementById('course-name') as HTMLInputElement, {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole('button', { name: /add course/i }));
}

const lastToast = (spy: typeof toastSuccess) => JSON.stringify(spy.mock.calls.at(-1));

beforeEach(() => {
  localStorage.clear();
  saveSnapshot.mockReset().mockResolvedValue(undefined);
  loadSnapshot.mockReset().mockResolvedValue(null);
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(cleanup);

describe('the empty account', () => {
  it('asks for a semester first, since courses have to live in one', async () => {
    await renderApp();

    expect(screen.getByRole('heading', { name: 'No semesters yet' })).toBeTruthy();
  });

  it('refuses New Course until there is one, and says why', async () => {
    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: /new course/i }));

    expect(screen.queryByRole('heading', { name: 'New course' })).toBeNull();
    expect(lastToast(toastError)).toMatch(/Add a semester first/);
  });
});

describe('building a course', () => {
  it('selects a new semester so the next click lands somewhere', async () => {
    await renderApp();

    addSemester();

    expect(screen.getByRole('button', { name: '2026 Winter Term 1' }).getAttribute('aria-current'))
      .toBe('true');
    expect(screen.getByRole('heading', { name: /No courses in 2026 Winter Term 1/ })).toBeTruthy();
  });

  it('adds a course into the selected semester', async () => {
    await renderApp();
    addSemester();

    addCourse('CPSC 320');

    expect(screen.getByDisplayValue('CPSC 320')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026 Winter Term 1' }).textContent).toContain('1');
  });

  it('shows only the selected semester’s courses', async () => {
    await renderApp();
    addSemester('2026', 'Winter Term 1');
    addCourse('CPSC 320');
    addSemester('2025', 'Summer Term 1');
    addCourse('MATH 200');

    expect(screen.queryByDisplayValue('CPSC 320')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2026 Winter Term 1' }));

    expect(screen.getByDisplayValue('CPSC 320')).toBeTruthy();
    expect(screen.queryByDisplayValue('MATH 200')).toBeNull();
  });

  it('calculates the final grade as marks are typed', async () => {
    await renderApp();
    addSemester();
    addCourse('CPSC 320');

    fireEvent.click(screen.getByRole('button', { name: /add breakdown/i }));
    fireEvent.keyDown(document.getElementById('breakdown-type') as HTMLElement, {
      key: 'ArrowDown',
    });
    fireEvent.click(screen.getByRole('option', { name: 'Final Exam' }));
    fireEvent.change(document.getElementById('breakdown-weight') as HTMLInputElement, {
      target: { value: '100' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    fireEvent.change(screen.getByLabelText('Marks achieved'), { target: { value: '43' } });
    fireEvent.change(screen.getByLabelText('Full marks'), { target: { value: '50' } });

    const header = screen.getByText('Final Grade').parentElement as HTMLElement;
    expect(header.querySelector('.grade-display')?.textContent).toBe('86.00→86 : A');
  });

  it('deletes a semester and falls back to whichever one is left', async () => {
    await renderApp();
    addSemester('2026', 'Winter Term 1');
    addCourse('CPSC 320');
    addSemester('2025', 'Summer Term 1');

    fireEvent.click(screen.getByRole('button', { name: 'Delete 2025 Summer Term 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete semester' }));

    expect(screen.queryByRole('button', { name: '2025 Summer Term 1' })).toBeNull();
    expect(lastToast(toastSuccess)).toMatch(/Deleted 2025 Summer Term 1/);
    // The selection was on the deleted one, so the panel falls through to the
    // survivor rather than showing nothing.
    expect(screen.getByDisplayValue('CPSC 320')).toBeTruthy();
  });
});

describe('the account menu', () => {
  it('falls back to a generic label for a user with no address on file', async () => {
    render(
      <TooltipProvider>
        <Index storage={memoryStorage()} user={{ id: 'user-1' } as User} />
      </TooltipProvider>
    );
    await waitFor(() => expect(screen.queryByText(/Loading your courses/)).toBeNull());

    expect(screen.getByRole('button', { name: 'Account: your account' })).toBeTruthy();
  });
});

describe('deleting inside a course', () => {
  /** A course with one breakdown of two rows, saved and reopened. */
  const withBreakdown = () =>
    memoryStorage({
      courses: [
        {
          id: 'c1',
          name: 'CPSC 320',
          semester: '2026 Winter Term 1',
          breakdowns: [
            {
              id: 'b1',
              courseId: 'c1',
              name: 'Assignments',
              weight: 100,
              dropLowestCount: null,
              downweightLowestCount: null,
              downweightPercent: null,
              fullCreditGrade: null,
              isBonus: false,
              equalWeightSubBreakdowns: false,
              subBreakdownLabel: 'Assignment',
              subBreakdowns: [
                { id: 's1', breakdownId: 'b1', name: 'Assignment 1', achievedMarks: 8, fullMarks: 10 },
                { id: 's2', breakdownId: 'b1', name: 'Assignment 2', achievedMarks: 9, fullMarks: 10 },
              ],
            },
          ],
        },
      ],
      semesters: ['2026 Winter Term 1'],
    });

  it('deletes a row once confirmed', async () => {
    await renderApp(withBreakdown());

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete sub-breakdown' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete row' }));

    expect(screen.queryByDisplayValue('Assignment 2')).toBeNull();
    expect(screen.getByDisplayValue('Assignment 1')).toBeTruthy();
  });

  it('deletes a breakdown once confirmed, taking its rows', async () => {
    await renderApp(withBreakdown());

    fireEvent.click(screen.getByRole('button', { name: 'Delete breakdown' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete breakdown' }));

    expect(screen.queryByDisplayValue('Assignment 1')).toBeNull();
    expect(screen.getByText(/No breakdowns yet/)).toBeTruthy();
  });

  it('applies an advanced option to the breakdown it was opened on', async () => {
    await renderApp(withBreakdown());

    fireEvent.click(screen.getByRole('button', { name: /advanced/i }));
    fireEvent.click(screen.getByRole('switch', { name: 'Equal weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    // 8/10 and 9/10 average to 85% either way; the summary line is what says the
    // rule landed on the store rather than staying in the dialog's draft.
    expect(screen.getByText(/equal weight/i)).toBeTruthy();
  });

  it('deletes the course itself, leaving the semester behind', async () => {
    await renderApp(withBreakdown());

    fireEvent.click(screen.getByRole('button', { name: 'Delete course' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete course' }));

    expect(screen.queryByDisplayValue('CPSC 320')).toBeNull();
    expect(screen.getByRole('button', { name: '2026 Winter Term 1' })).toBeTruthy();
  });
});

describe('reopening the account', () => {
  it('shows what was saved, including a semester with no courses in it', async () => {
    await renderApp(
      memoryStorage({
        courses: [{ id: 'c1', name: 'CPSC 110', semester: '2026 Winter Term 1', breakdowns: [] }],
        semesters: ['2026 Winter Term 1', '2025 Summer Term 1'],
      })
    );

    expect(screen.getByDisplayValue('CPSC 110')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2025 Summer Term 1' })).toBeTruthy();
  });
});

describe('save and reload progress', () => {
  const saved: GradeData = {
    courses: [{ id: 'c9', name: 'From the snapshot', semester: '2026 Winter Term 1', breakdowns: [] }],
    semesters: ['2026 Winter Term 1'],
  };

  it('saves what is on screen', async () => {
    await renderApp(memoryStorage(saved));

    fireEvent.click(screen.getByRole('button', { name: /save progress/i }));

    await waitFor(() => expect(saveSnapshot).toHaveBeenCalledWith(saved));
  });

  it('puts a reloaded snapshot on screen', async () => {
    loadSnapshot.mockResolvedValue({ ...saved, savedAt: null });
    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: /reload progress/i }));

    expect(await screen.findByDisplayValue('From the snapshot')).toBeTruthy();
  });
});

describe('the offer of pre-account data', () => {
  /** A payload written by a build from before the app had accounts. */
  const savedInThisBrowser = async () => {
    const { STORAGE_KEY, SCHEMA_VERSION } = await import('@/lib/courseStorage');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        courses: [{ id: 'c1', name: 'Old course', semester: '2025 Winter Term 1', breakdowns: [] }],
        semesters: ['2025 Winter Term 1'],
      })
    );
  };

  it('offers it to an empty account, and imports on request', async () => {
    await savedInThisBrowser();
    await renderApp();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Bring your saved courses over/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));

    expect(await screen.findByDisplayValue('Old course')).toBeTruthy();
    expect(lastToast(toastSuccess)).toMatch(/Imported 1 course/);
  });

  it('does not offer it to an account that already has courses', async () => {
    // Importing there could only duplicate or overwrite.
    await savedInThisBrowser();

    await renderApp(
      memoryStorage({
        courses: [{ id: 'c1', name: 'CPSC 110', semester: '2026 Winter Term 1', breakdowns: [] }],
        semesters: ['2026 Winter Term 1'],
      })
    );

    expect(screen.queryByText(/Bring your saved courses over/)).toBeNull();
  });
});

describe('when the account cannot be read', () => {
  it('stops rather than letting an empty tree be saved over the real one', async () => {
    await renderApp(brokenStorage());

    expect(screen.getByRole('heading', { name: /Couldn’t load your courses/ })).toBeTruthy();
    expect(screen.getByText(/network down/)).toBeTruthy();
    // No editing surface at all, which is the point.
    expect(screen.queryByRole('button', { name: /new course/i })).toBeNull();
  });
});

describe('when a save fails', () => {
  it('says so, because the screen still shows the edit either way', async () => {
    const storage: CourseStorage = {
      load: async () => ({ courses: [], semesters: [] }),
      save: async () => {
        throw new Error('row level security');
      },
    };
    await renderApp(storage);

    addSemester();

    await waitFor(() => expect(lastToast(toastError)).toMatch(/row level security/));
    expect(JSON.stringify(toastError.mock.calls)).toMatch(/aren’t saving/);
  });
});
