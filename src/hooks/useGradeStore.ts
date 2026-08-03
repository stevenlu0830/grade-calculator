import { useState, useCallback, useEffect } from 'react';
import { Course, Breakdown, SubBreakdown } from '@/types/grades';
import { CourseStorage, localCourseStorage } from '@/lib/courseStorage';
import { DEFAULT_FULL_MARKS, clampAchievedMarks } from '@/lib/gradeCalculations';
import { nextSubBreakdownName } from '@/lib/breakdownPresets';
import { createId } from '@/lib/id';

/** What a newly added breakdown needs; everything else has a sensible default. */
export interface NewBreakdown {
  name: string;
  weight: number | null;
  subBreakdownLabel: string;
}

const createSubBreakdown = (breakdownId: string, name: string): SubBreakdown => ({
  id: createId(),
  breakdownId,
  name,
  achievedMarks: null,
  fullMarks: DEFAULT_FULL_MARKS,
});

const createBreakdown = (courseId: string, input: NewBreakdown): Breakdown => {
  const breakdownId = createId();
  return {
    id: breakdownId,
    courseId,
    name: input.name,
    weight: input.weight,
    dropLowestCount: null,
    downweightLowestCount: null,
    downweightPercent: null,
    subBreakdownLabel: input.subBreakdownLabel,
    // Every breakdown starts with one row so there's somewhere to type a mark.
    subBreakdowns: [createSubBreakdown(breakdownId, `${input.subBreakdownLabel} 1`)],
  };
};

/** Applies `update` to the matching course, leaving the others untouched. */
const mapCourse = (courses: Course[], courseId: string, update: (course: Course) => Course) =>
  courses.map(course => (course.id === courseId ? update(course) : course));

/** Applies `update` to the matching breakdown within a course. */
const mapBreakdown = (
  course: Course,
  breakdownId: string,
  update: (breakdown: Breakdown) => Breakdown
): Course => ({
  ...course,
  breakdowns: course.breakdowns.map(b => (b.id === breakdownId ? update(b) : b)),
});

/**
 * The single source of truth for course data.
 *
 * Call this once, at the top of the tree, and pass its actions down: a second
 * instance would be an independent state tree racing the first over the same
 * storage key.
 */
export function useGradeStore(storage: CourseStorage = localCourseStorage) {
  const [courses, setCourses] = useState<Course[]>(() => storage.load());

  // Autosave: no component ever writes to storage itself.
  useEffect(() => {
    storage.save(courses);
  }, [courses, storage]);

  const addCourse = useCallback((name: string) => {
    setCourses(prev => [...prev, { id: createId(), name, breakdowns: [] }]);
  }, []);

  const deleteCourse = useCallback((courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
  }, []);

  const updateCourseName = useCallback((courseId: string, name: string) => {
    setCourses(prev => mapCourse(prev, courseId, course => ({ ...course, name })));
  }, []);

  const addBreakdown = useCallback((courseId: string, input: NewBreakdown) => {
    setCourses(prev =>
      mapCourse(prev, courseId, course => ({
        ...course,
        breakdowns: [...course.breakdowns, createBreakdown(courseId, input)],
      }))
    );
  }, []);

  const deleteBreakdown = useCallback((courseId: string, breakdownId: string) => {
    setCourses(prev =>
      mapCourse(prev, courseId, course => ({
        ...course,
        breakdowns: course.breakdowns.filter(b => b.id !== breakdownId),
      }))
    );
  }, []);

  const updateBreakdown = useCallback(
    (courseId: string, breakdownId: string, updates: Partial<Breakdown>) => {
      setCourses(prev =>
        mapCourse(prev, courseId, course =>
          mapBreakdown(course, breakdownId, breakdown => ({ ...breakdown, ...updates }))
        )
      );
    },
    []
  );

  const addSubBreakdown = useCallback((courseId: string, breakdownId: string) => {
    setCourses(prev =>
      mapCourse(prev, courseId, course =>
        mapBreakdown(course, breakdownId, breakdown => ({
          ...breakdown,
          subBreakdowns: [
            ...breakdown.subBreakdowns,
            createSubBreakdown(
              breakdownId,
              nextSubBreakdownName(
                breakdown.subBreakdownLabel,
                breakdown.subBreakdowns.map(sb => sb.name)
              )
            ),
          ],
        }))
      )
    );
  }, []);

  const deleteSubBreakdown = useCallback(
    (courseId: string, breakdownId: string, subBreakdownId: string) => {
      setCourses(prev =>
        mapCourse(prev, courseId, course =>
          mapBreakdown(course, breakdownId, breakdown =>
            // A breakdown always keeps at least one sub-breakdown.
            breakdown.subBreakdowns.length <= 1
              ? breakdown
              : {
                  ...breakdown,
                  subBreakdowns: breakdown.subBreakdowns.filter(sb => sb.id !== subBreakdownId),
                }
          )
        )
      );
    },
    []
  );

  const updateSubBreakdown = useCallback(
    (
      courseId: string,
      breakdownId: string,
      subBreakdownId: string,
      updates: Partial<SubBreakdown>
    ) => {
      setCourses(prev =>
        mapCourse(prev, courseId, course =>
          mapBreakdown(course, breakdownId, breakdown => ({
            ...breakdown,
            subBreakdowns: breakdown.subBreakdowns.map(sb =>
              sb.id === subBreakdownId ? applySubBreakdownUpdate(sb, updates) : sb
            ),
          }))
        )
      );
    },
    []
  );

  const importCourses = useCallback((newCourses: Course[]) => {
    setCourses(newCourses);
  }, []);

  return {
    courses,
    addCourse,
    deleteCourse,
    updateCourseName,
    addBreakdown,
    deleteBreakdown,
    updateBreakdown,
    addSubBreakdown,
    deleteSubBreakdown,
    updateSubBreakdown,
    importCourses,
  };
}

/**
 * Marks are clamped on write so nothing out of range can enter the store.
 *
 * Lowering full marks re-clamps the achieved marks with it, so a 90/100 that
 * becomes "out of 50" lands on 50/50 rather than an impossible 90/50.
 */
function applySubBreakdownUpdate(
  subBreakdown: SubBreakdown,
  updates: Partial<SubBreakdown>
): SubBreakdown {
  const merged = { ...subBreakdown, ...updates };
  const fullMarks = Math.max(0, merged.fullMarks);

  return {
    ...merged,
    fullMarks,
    achievedMarks:
      merged.achievedMarks === null ? null : clampAchievedMarks(merged.achievedMarks, fullMarks),
  };
}
