import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Course } from '@/types/grades';
import { UNASSIGNED_SEMESTER_LABEL } from '@/lib/semesters';
import { SemesterPanel } from '@/components/SemesterPanel';

/**
 * The left panel: which semester's courses are on show, and the one delete in
 * the app that takes a whole term with it.
 *
 * Rows are abbreviated to fit the panel, so the accessible name has to carry the
 * full label the rest of the app stores — and the courses-with-no-semester
 * bucket needs a readable name rather than the empty string it is keyed on.
 */

afterEach(cleanup);

const course = (id: string, semester: string): Course => ({
  id,
  name: `Course ${id}`,
  semester,
  breakdowns: [],
});

const SEMESTERS = ['2026 Winter Term 1', '2025 Summer Term 1'];
const COURSES = [
  course('a', '2026 Winter Term 1'),
  course('b', '2026 Winter Term 1'),
  course('c', '2025 Summer Term 1'),
];

function renderPanel(semesters = SEMESTERS, selected: string | null = '2026 Winter Term 1', courses = COURSES) {
  const onSelect = vi.fn();
  const onAddSemester = vi.fn();
  const onDeleteSemester = vi.fn();
  render(
    <TooltipProvider>
      <SemesterPanel
        semesters={semesters}
        selected={selected}
        courses={courses}
        onSelect={onSelect}
        onAddSemester={onAddSemester}
        onDeleteSemester={onDeleteSemester}
      />
    </TooltipProvider>
  );
  return { onSelect, onAddSemester, onDeleteSemester };
}

const row = (semester: string) => screen.getByRole('button', { name: semester });

describe('SemesterPanel', () => {
  it('says what to do when there are no semesters yet', () => {
    renderPanel([], null, []);

    expect(screen.getByText(/No semesters yet/)).toBeTruthy();
  });

  it('abbreviates each row but keeps the full label reachable', () => {
    renderPanel();

    expect(screen.getByText('2026W1')).toBeTruthy();
    expect(row('2026 Winter Term 1')).toBeTruthy();
  });

  it('shows how many courses are in each, before it is clicked', () => {
    renderPanel();

    expect(row('2026 Winter Term 1').textContent).toContain('2');
    expect(row('2025 Summer Term 1').textContent).toContain('1');
  });

  it('marks the selected row as current', () => {
    renderPanel();

    expect(row('2026 Winter Term 1').getAttribute('aria-current')).toBe('true');
    expect(row('2025 Summer Term 1').getAttribute('aria-current')).toBeNull();
  });

  it('selects on click', () => {
    const { onSelect } = renderPanel();

    fireEvent.click(row('2025 Summer Term 1'));

    expect(onSelect).toHaveBeenCalledWith('2025 Summer Term 1');
  });

  it('gives the unassigned bucket a readable name', () => {
    // Courses saved before semesters existed live under the empty string, which
    // is no kind of label.
    renderPanel([''], '', [course('legacy', '')]);

    expect(screen.getByRole('button', { name: UNASSIGNED_SEMESTER_LABEL })).toBeTruthy();
  });

  it('adds a semester through its caller', () => {
    const { onAddSemester } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /add semester/i }));

    expect(onAddSemester).toHaveBeenCalledTimes(1);
  });

  it('confirms a delete by counting what goes with it', () => {
    // This is the widest-reaching delete in the app: a term, its courses, and
    // every mark on them.
    const { onDeleteSemester } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Delete 2026 Winter Term 1' }));

    expect(screen.getByText('Delete 2026 Winter Term 1?')).toBeTruthy();
    expect(screen.getByText(/2 courses, along with their breakdowns/)).toBeTruthy();
    expect(onDeleteSemester).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete semester' }));
    expect(onDeleteSemester).toHaveBeenCalledWith('2026 Winter Term 1');
  });

  it('says plainly when the semester is empty', () => {
    renderPanel(['2024 Winter Term 2'], null, []);

    fireEvent.click(screen.getByRole('button', { name: 'Delete 2024 Winter Term 2' }));

    expect(
      screen.getByText('This semester has no courses in it. Deleting it cannot be undone.')
    ).toBeTruthy();
  });

  it('deletes nothing when the confirmation is dismissed', () => {
    const { onDeleteSemester } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Delete 2026 Winter Term 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDeleteSemester).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete 2026 Winter Term 1?')).toBeNull();
  });

  it('asks about the row that was clicked, not the one that is selected', () => {
    const { onDeleteSemester } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Delete 2025 Summer Term 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete semester' }));

    expect(onDeleteSemester).toHaveBeenCalledWith('2025 Summer Term 1');
  });
});
