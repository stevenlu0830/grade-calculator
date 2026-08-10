import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Course } from '@/types/grades';
import { CourseStorage } from '@/lib/courseStorage';
import { advancedOptionUpdate, NO_POLICY } from '@/lib/gradePolicies';
import { useGradeStore, NewBreakdown } from '@/hooks/useGradeStore';

/** In-memory storage, so the store can be driven without a browser. */
const memoryStorage = (initial: Course[] = []): CourseStorage & { saved: Course[] } => {
  const box = {
    saved: initial,
    load: () => box.saved,
    save: (courses: Course[]) => {
      box.saved = courses;
    },
  };
  return box;
};

const newBreakdown = (overrides: Partial<NewBreakdown> = {}): NewBreakdown => ({
  name: 'Quizzes',
  weight: 30,
  subBreakdownLabel: 'Quiz',
  ...NO_POLICY,
  ...overrides,
});

describe('addBreakdown', () => {
  it('creates a breakdown with one auto-named, blank sub-breakdown', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

    act(() => result.current.addCourse('CPSC 121', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() => result.current.addBreakdown(courseId, newBreakdown()));

    const [breakdown] = result.current.courses[0].breakdowns;
    expect(breakdown).toMatchObject({ name: 'Quizzes', weight: 30, subBreakdownLabel: 'Quiz' });
    expect(breakdown.subBreakdowns).toMatchObject([
      { name: 'Quiz 1', achievedMarks: null, fullMarks: null },
    ]);
  });

  it('defaults to no grading policy', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

    act(() => result.current.addCourse('C', '2026 Winter Term 1'));
    const courseId = result.current.courses[0].id;
    act(() => result.current.addBreakdown(courseId, newBreakdown()));

    expect(result.current.courses[0].breakdowns[0]).toMatchObject(NO_POLICY);
  });

  // The add dialog can set a policy up front; it must survive into the store.
  it('carries a drop-lowest policy set at creation', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

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

  it('carries a downweight policy set at creation', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

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
  it('applies a whole policy over the existing one', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

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

  it('clears both policies for none', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

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
  it('keeps a score above full marks', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

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

  it('does not rewrite the score when full marks are lowered', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

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
  it('continues the counter', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

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

  it('refuses to delete the last sub-breakdown', () => {
    const { result } = renderHook(() => useGradeStore(memoryStorage()));

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
  it('loads through the injected storage and saves on change', () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useGradeStore(storage));

    act(() => result.current.addCourse('CPSC 121', '2026 Winter Term 1'));

    expect(storage.saved.map(c => c.name)).toEqual(['CPSC 121']);
  });
});
