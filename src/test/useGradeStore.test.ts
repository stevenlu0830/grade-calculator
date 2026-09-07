import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Course, GradeData } from '@/types/grades';
import { CourseStorage } from '@/lib/courseStorage';
import { advancedOptionUpdate, NO_POLICY } from '@/lib/gradePolicies';
import { UNASSIGNED_SEMESTER } from '@/lib/semesters';
import { useGradeStore, NewBreakdown } from '@/hooks/useGradeStore';

interface MemoryStorage extends CourseStorage {
  saved: GradeData;
  /** How many times `save` has been called, to catch redundant writes. */
  writes: number;
}

/** In-memory storage, so the store can be driven without a browser. */
const memoryStorage = (initial: Partial<GradeData> = {}): MemoryStorage => {
  const box: MemoryStorage = {
    saved: { courses: initial.courses ?? [], semesters: initial.semesters ?? [] },
    writes: 0,
    load: async () => box.saved,
    save: async (data: GradeData) => {
      box.writes += 1;
      box.saved = data;
    },
  };
  return box;
};

/** Storage whose read always fails, for the "don't overwrite what you couldn't read" path. */
const failingStorage = (message = 'network down'): MemoryStorage => {
  const box = memoryStorage();
  box.load = async () => {
    throw new Error(message);
  };
  return box;
};

/**
 * Lets pending promises settle and React apply what they scheduled.
 *
 * `waitFor` would read better, but it comes from `@testing-library/dom`, which
 * this project doesn't have installed. Every promise here is already resolved,
 * so draining the microtask queue inside `act` is enough.
 */
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

/**
 * Renders the store over a *stable* storage and waits for the initial load.
 *
 * The storage is built once, outside the render callback: it's an effect
 * dependency, so building it inline would hand the store a new object every
 * render and reload in a loop.
 */
const renderStore = async (storage: MemoryStorage = memoryStorage()) => {
  const view = renderHook(() => useGradeStore(storage));
  await settle();
  expect(view.result.current.isLoading).toBe(false);
  return { result: view.result, storage, unmount: view.unmount };
};

const newBreakdown = (overrides: Partial<NewBreakdown> = {}): NewBreakdown => ({
  name: 'Quizzes',
  weight: 30,
  subBreakdownLabel: 'Quiz',
  ...NO_POLICY,
  ...overrides,
});

describe('addBreakdown', () => {
  it('creates a breakdown with one auto-named, blank sub-breakdown', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('CPSC 121', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() => result.current.addBreakdown(courseId, newBreakdown()));

    const [breakdown] = result.current.courses[0].breakdowns;
    expect(breakdown).toMatchObject({ name: 'Quizzes', weight: 30, subBreakdownLabel: 'Quiz' });
    expect(breakdown.subBreakdowns).toMatchObject([
      { name: 'Quiz 1', achievedMarks: null, fullMarks: null },
    ]);
  });

  it('defaults to no grading policy', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() => result.current.addBreakdown(courseId, newBreakdown()));

    expect(result.current.courses[0].breakdowns[0]).toMatchObject(NO_POLICY);
  });

  // The add dialog can set a policy up front; it must survive into the store.
  it('carries a drop-lowest policy set at creation', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() =>
      result.current.addBreakdown(
        courseId,
        newBreakdown({ ...advancedOptionUpdate('dropLowest'), dropLowestCount: 2 })
      )
    );

    expect(result.current.courses[0].breakdowns[0]).toMatchObject({
      dropLowestCount: 2,
      downweightLowestCount: null,
      downweightPercent: null,
    });
  });

  it('carries a downweight policy set at creation', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() =>
      result.current.addBreakdown(courseId, newBreakdown(advancedOptionUpdate('downweight')))
    );

    expect(result.current.courses[0].breakdowns[0]).toMatchObject({
      dropLowestCount: null,
      downweightLowestCount: 1,
      downweightPercent: 50,
    });
  });
});

describe('updateBreakdown', () => {
  // What the advanced options dialog does on Apply.
  it('applies a whole policy over the existing one', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() =>
      result.current.addBreakdown(courseId, newBreakdown(advancedOptionUpdate('dropLowest')))
    );
    const breakdownId = result.current.courses[0].breakdowns[0].id;

    act(() =>
      result.current.updateBreakdown(courseId, breakdownId, advancedOptionUpdate('downweight'))
    );

    // Switching policies must clear the one it replaces, not merge with it.
    expect(result.current.courses[0].breakdowns[0]).toMatchObject({
      dropLowestCount: null,
      downweightLowestCount: 1,
      downweightPercent: 50,
    });
  });

  it('clears both policies for none', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() =>
      result.current.addBreakdown(courseId, newBreakdown(advancedOptionUpdate('downweight')))
    );
    const breakdownId = result.current.courses[0].breakdowns[0].id;

    act(() => result.current.updateBreakdown(courseId, breakdownId, advancedOptionUpdate('none')));

    expect(result.current.courses[0].breakdowns[0]).toMatchObject(NO_POLICY);
  });
});

describe('marks are stored verbatim', () => {
  it('keeps a score above full marks', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() => result.current.addBreakdown(courseId, newBreakdown()));
    const breakdown = result.current.courses[0].breakdowns[0];
    const subId = breakdown.subBreakdowns[0].id;

    act(() =>
      result.current.updateSubBreakdown(courseId, breakdown.id, subId, { fullMarks: 20 })
    );
    act(() =>
      result.current.updateSubBreakdown(courseId, breakdown.id, subId, { achievedMarks: 22 })
    );

    expect(result.current.courses[0].breakdowns[0].subBreakdowns[0]).toMatchObject({
      achievedMarks: 22,
      fullMarks: 20,
    });
  });

  it('does not rewrite the score when full marks are lowered', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() => result.current.addBreakdown(courseId, newBreakdown()));
    const breakdown = result.current.courses[0].breakdowns[0];
    const subId = breakdown.subBreakdowns[0].id;

    act(() =>
      result.current.updateSubBreakdown(courseId, breakdown.id, subId, {
        achievedMarks: 90,
        fullMarks: 100,
      })
    );
    act(() => result.current.updateSubBreakdown(courseId, breakdown.id, subId, { fullMarks: 50 }));

    expect(result.current.courses[0].breakdowns[0].subBreakdowns[0]).toMatchObject({
      achievedMarks: 90,
      fullMarks: 50,
    });
  });
});

describe('sub-breakdown auto-naming', () => {
  it('continues the counter', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() => result.current.addBreakdown(courseId, newBreakdown()));
    const breakdownId = result.current.courses[0].breakdowns[0].id;

    act(() => result.current.addSubBreakdown(courseId, breakdownId));
    act(() => result.current.addSubBreakdown(courseId, breakdownId));

    expect(result.current.courses[0].breakdowns[0].subBreakdowns.map(s => s.name)).toEqual([
      'Quiz 1',
      'Quiz 2',
      'Quiz 3',
    ]);
  });

  it('refuses to delete the last sub-breakdown', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() => result.current.addBreakdown(courseId, newBreakdown()));
    const breakdown = result.current.courses[0].breakdowns[0];

    act(() =>
      result.current.deleteSubBreakdown(courseId, breakdown.id, breakdown.subBreakdowns[0].id)
    );

    expect(result.current.courses[0].breakdowns[0].subBreakdowns).toHaveLength(1);
  });
});

describe('persistence', () => {
  it('loads through the injected storage and saves on change', async () => {
    const { result, storage } = await renderStore();

    act(() => result.current.addCourse('CPSC 121', '2026 Winter Term 1'));

    expect(storage.saved.courses.map(c => c.name)).toEqual(['CPSC 121']);
  });

  it('saves the semester list alongside the courses', async () => {
    const { result, storage } = await renderStore();

    act(() => result.current.addSemester('2026 Winter Term 1'));

    // Nothing else records an empty semester, so this is what makes it survive.
    expect(storage.saved.semesters).toEqual(['2026 Winter Term 1']);
    expect(storage.saved.courses).toEqual([]);
  });

  it('adopts the semesters its courses name, for data saved before the list', async () => {
    const legacy = [
      { id: 'c', name: 'MATH 200', semester: '2025 Winter Term 2', breakdowns: [] },
    ];
    const { result } = await renderStore(memoryStorage({ courses: legacy }));

    // Otherwise deleting that course would take the semester with it.
    expect(result.current.semesters).toEqual(['2025 Winter Term 2']);
  });

  it('leaves the unassigned bucket off the list', async () => {
    const legacy = [{ id: 'c', name: 'Old', semester: '', breakdowns: [] }];
    const { result } = await renderStore(memoryStorage({ courses: legacy }));

    // It isn't a semester anyone created; it's where course-less courses land.
    expect(result.current.semesters).toEqual([]);
  });

  // Against a network backend, echoing the load straight back would be a wasted
  // round trip on every page open.
  it('does not write the data it just loaded back to storage', async () => {
    const courses = [{ id: 'c', name: 'MATH 200', semester: '2025 Winter Term 2', breakdowns: [] }];
    const { storage } = await renderStore(memoryStorage({ courses }));

    expect(storage.writes).toBe(0);
  });

  it('reports a load failure instead of showing an empty account', async () => {
    const storage = failingStorage('offline');
    const view = renderHook(() => useGradeStore(storage));
    await settle();

    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.loadError?.message).toBe('offline');
    expect(view.result.current.courses).toEqual([]);
  });

  /**
   * The dangerous case: a failed read leaves the store empty, so saving on top
   * of it would replace a full account with nothing.
   */
  it('refuses to save after a failed load', async () => {
    const storage = failingStorage();
    const view = renderHook(() => useGradeStore(storage));
    await settle();

    act(() => view.result.current.addCourse('CPSC 121', '2026 Winter Term 1'));
    await settle();

    expect(storage.writes).toBe(0);
    expect(storage.saved.courses).toEqual([]);
  });

  it('surfaces a save failure', async () => {
    const storage = memoryStorage();
    storage.save = async () => {
      throw new Error('write rejected');
    };
    const view = renderHook(() => useGradeStore(storage));
    await settle();

    act(() => view.result.current.addCourse('CPSC 121', '2026 Winter Term 1'));
    await settle();

    expect(view.result.current.saveError?.message).toBe('write rejected');
    // The edit stays on screen — it's unsaved, not undone.
    expect(view.result.current.courses.map(c => c.name)).toEqual(['CPSC 121']);
  });

  it('reloads when the storage changes, so switching account swaps the data', async () => {
    const first = memoryStorage({
      courses: [{ id: 'a', name: 'CPSC 121', semester: '', breakdowns: [] }],
    });
    const second = memoryStorage({
      courses: [{ id: 'b', name: 'MATH 100', semester: '', breakdowns: [] }],
    });

    const view = renderHook(({ storage }) => useGradeStore(storage), {
      initialProps: { storage: first as CourseStorage },
    });
    await settle();
    expect(view.result.current.courses.map(c => c.name)).toEqual(['CPSC 121']);

    view.rerender({ storage: second as CourseStorage });
    await settle();

    expect(view.result.current.courses.map(c => c.name)).toEqual(['MATH 100']);
    // The first account must not be written with the second's data.
    expect(first.writes).toBe(0);
  });
});

describe('semesters', () => {
  it('keeps an added semester even with no courses in it', async () => {
    const { result } = await renderStore();

    act(() => result.current.addSemester('2026 Winter Term 1'));

    expect(result.current.semesters).toEqual(['2026 Winter Term 1']);
  });

  it('does not add the same semester twice', async () => {
    const { result } = await renderStore();

    act(() => result.current.addSemester('2026 Winter Term 1'));
    act(() => result.current.addSemester('2026 Winter Term 1'));

    expect(result.current.semesters).toEqual(['2026 Winter Term 1']);
  });

  it('records the semester a course is added to', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('CPSC 121', '2026 Winter Term 1'));

    expect(result.current.semesters).toEqual(['2026 Winter Term 1']);
  });

  it('keeps a semester after its last course is deleted', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('CPSC 121', '2026 Winter Term 1'));
    act(() => result.current.deleteCourse(result.current.courses[0].id));

    expect(result.current.courses).toEqual([]);
    expect(result.current.semesters).toEqual(['2026 Winter Term 1']);
  });

  it('deletes a semester along with every course in it', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('CPSC 121', '2026 Winter Term 1'));
    act(() => result.current.addCourse('MATH 100', '2026 Winter Term 1'));
    act(() => result.current.addCourse('MATH 101', '2026 Winter Term 2'));

    act(() => result.current.deleteSemester('2026 Winter Term 1'));

    expect(result.current.semesters).toEqual(['2026 Winter Term 2']);
    expect(result.current.courses.map(c => c.name)).toEqual(['MATH 101']);
  });

  it('deletes courses saved with no semester when the unassigned bucket goes', async () => {
    const legacy = [{ id: 'c', name: 'Old', semester: '', breakdowns: [] }];
    const { result } = await renderStore(memoryStorage({ courses: legacy }));

    act(() => result.current.deleteSemester(''));

    expect(result.current.courses).toEqual([]);
  });
});

describe('importData', () => {
  it('replaces courses and semesters together', async () => {
    const { result } = await renderStore();

    act(() => result.current.addCourse('CPSC 121', '2026 Winter Term 1'));
    act(() =>
      result.current.importData({
        courses: [{ id: 'x', name: 'MATH 100', semester: '2025 Winter Term 1', breakdowns: [] }],
        semesters: ['2025 Winter Term 1', '2025 Summer Term 1'],
      })
    );

    expect(result.current.courses.map(c => c.name)).toEqual(['MATH 100']);
    expect(result.current.semesters).toEqual(['2025 Summer Term 1', '2025 Winter Term 1']);
  });

  it('keeps the imported course order rather than sorting it', async () => {
    const { result } = await renderStore();
    const course = (name: string): Course => ({
      id: `id-${name}`,
      name,
      semester: '2026 Winter Term 1',
      breakdowns: [],
    });

    act(() =>
      result.current.importData({
        courses: [course('Zoology'), course('Anthropology')],
        semesters: [],
      })
    );

    expect(result.current.courses.map(c => c.name)).toEqual(['Zoology', 'Anthropology']);
  });
});

/**
 * Every mutation reaches into one course, one breakdown, one row — and has to
 * leave the rest untouched. A mis-scoped `.map` is invisible on the single-course
 * fixtures above and quietly rewrites the wrong course as soon as there are two.
 */
describe('edits stay where they were aimed', () => {
  /** Two courses, each with one breakdown of two rows. */
  const twoCourses = (): Course[] =>
    ['a', 'b'].map(key => ({
      id: `course-${key}`,
      name: `Course ${key}`,
      semester: '2026 Winter Term 1',
      breakdowns: [
        {
          id: `breakdown-${key}`,
          courseId: `course-${key}`,
          name: 'Assignments',
          weight: 100,
          ...NO_POLICY,
          subBreakdownLabel: 'Assignment',
          subBreakdowns: [
            {
              id: `sub-${key}-1`,
              breakdownId: `breakdown-${key}`,
              name: 'Assignment 1',
              achievedMarks: 8,
              fullMarks: 10,
            },
            {
              id: `sub-${key}-2`,
              breakdownId: `breakdown-${key}`,
              name: 'Assignment 2',
              achievedMarks: 9,
              fullMarks: 10,
            },
          ],
        },
      ],
    }));

  const renderTwo = () => renderStore(memoryStorage({ courses: twoCourses() }));
  /** The untouched course, which every case below asserts is unchanged. */
  const other = (result: { current: { courses: Course[] } }) =>
    result.current.courses.find(c => c.id === 'course-b');

  it('renames only the named course', async () => {
    const { result } = await renderTwo();

    act(() => result.current.updateCourseName('course-a', 'Renamed'));

    expect(result.current.courses[0].name).toBe('Renamed');
    expect(other(result)?.name).toBe('Course b');
  });

  it('deletes only the named course', async () => {
    const { result } = await renderTwo();

    act(() => result.current.deleteCourse('course-a'));

    expect(result.current.courses.map(c => c.id)).toEqual(['course-b']);
  });

  it('adds a breakdown to only the named course', async () => {
    const { result } = await renderTwo();

    act(() => result.current.addBreakdown('course-a', newBreakdown()));

    expect(result.current.courses[0].breakdowns).toHaveLength(2);
    expect(other(result)?.breakdowns).toHaveLength(1);
  });

  it('deletes a breakdown from only the named course', async () => {
    const { result } = await renderTwo();

    act(() => result.current.deleteBreakdown('course-a', 'breakdown-a'));

    expect(result.current.courses[0].breakdowns).toEqual([]);
    expect(other(result)?.breakdowns).toHaveLength(1);
  });

  it('leaves a breakdown alone when the id names another one', async () => {
    const { result } = await renderTwo();

    act(() => result.current.deleteBreakdown('course-a', 'breakdown-b'));

    expect(result.current.courses[0].breakdowns).toHaveLength(1);
  });

  it('updates only the named breakdown', async () => {
    const { result } = await renderTwo();
    act(() => result.current.addBreakdown('course-a', newBreakdown({ name: 'Labs' })));
    const labsId = result.current.courses[0].breakdowns[1].id;

    act(() => result.current.updateBreakdown('course-a', labsId, { weight: 55 }));

    expect(result.current.courses[0].breakdowns[0].weight).toBe(100);
    expect(result.current.courses[0].breakdowns[1].weight).toBe(55);
  });

  it('adds a row to only the named breakdown', async () => {
    const { result } = await renderTwo();

    act(() => result.current.addSubBreakdown('course-a', 'breakdown-a'));

    expect(result.current.courses[0].breakdowns[0].subBreakdowns).toHaveLength(3);
    expect(other(result)?.breakdowns[0].subBreakdowns).toHaveLength(2);
  });

  it('updates only the named row', async () => {
    const { result } = await renderTwo();

    act(() => result.current.updateSubBreakdown('course-a', 'breakdown-a', 'sub-a-2', { achievedMarks: 3 }));

    const rows = result.current.courses[0].breakdowns[0].subBreakdowns;
    expect(rows.map(r => r.achievedMarks)).toEqual([8, 3]);
    expect(other(result)?.breakdowns[0].subBreakdowns.map(r => r.achievedMarks)).toEqual([8, 9]);
  });

  it('deletes only the named row', async () => {
    const { result } = await renderTwo();

    act(() => result.current.deleteSubBreakdown('course-a', 'breakdown-a', 'sub-a-1'));

    expect(result.current.courses[0].breakdowns[0].subBreakdowns.map(r => r.id)).toEqual(['sub-a-2']);
    expect(other(result)?.breakdowns[0].subBreakdowns).toHaveLength(2);
  });
});

describe('recovering from a failed save', () => {
  it('clears the warning once a later save gets through', async () => {
    // The toast is driven off `saveError`, so leaving it set after a successful
    // write would tell a student their work isn't saving when it is.
    const storage = memoryStorage();
    let refuse = true;
    storage.save = async (data: GradeData) => {
      if (refuse) throw new Error('network down');
      storage.saved = data;
    };
    const { result } = await renderStore(storage);

    act(() => result.current.addSemester('2026 Winter Term 1'));
    await settle();
    expect(result.current.saveError?.message).toBe('network down');

    refuse = false;
    act(() => result.current.addSemester('2025 Summer Term 1'));
    await settle();

    expect(result.current.saveError).toBeNull();
  });

  it('reports a thrown non-Error as one, so the toast has something to say', async () => {
    const storage = memoryStorage();
    storage.save = async () => {
      throw 'offline';
    };
    const { result } = await renderStore(storage);

    act(() => result.current.addSemester('2026 Winter Term 1'));
    await settle();

    expect(result.current.saveError).toBeInstanceOf(Error);
    expect(result.current.saveError?.message).toBe('offline');
  });
});

describe('a load that lands after the store has moved on', () => {
  /** Storage whose read is held open until the test releases it. */
  const heldStorage = () => {
    const box = memoryStorage();
    let release!: (data: GradeData) => void;
    let reject!: (error: unknown) => void;
    box.load = () =>
      new Promise<GradeData>((resolve, rejectIt) => {
        release = resolve;
        reject = rejectIt;
      });
    return { box, release: (data: GradeData) => release(data), fail: (e: unknown) => reject(e) };
  };

  it('ignores a read that resolves after unmount', async () => {
    // Signing out mid-load; setting state here would be a warning about a
    // component that is gone.
    const { box, release } = heldStorage();
    const view = renderHook(() => useGradeStore(box));

    view.unmount();
    await act(async () => {
      release({ courses: [], semesters: ['2026 Winter Term 1'] });
      await Promise.resolve();
    });
  });

  it('ignores a read that fails after unmount', async () => {
    const { box, fail } = heldStorage();
    const view = renderHook(() => useGradeStore(box));

    view.unmount();
    await act(async () => {
      fail(new Error('network down'));
      await Promise.resolve();
    });
  });
});

describe('deleting the unassigned bucket', () => {
  it('takes courses that were saved with no semester field at all', async () => {
    // Pre-semester data has no `semester` key, so the filter has to read it
    // through `?? UNASSIGNED_SEMESTER` or the course would survive the delete.
    const legacy = { id: 'c1', name: 'MATH 100', breakdowns: [] } as unknown as Course;
    const { result } = await renderStore(memoryStorage({ courses: [legacy] }));

    act(() => result.current.deleteSemester(UNASSIGNED_SEMESTER));

    expect(result.current.courses).toEqual([]);
  });
});
