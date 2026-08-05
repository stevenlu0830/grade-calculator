import { useState, useCallback, useEffect } from 'react';
import { Course, Breakdown, SubBreakdown } from '@/types/grades';
import { CourseStorage, localCourseStorage } from '@/lib/courseStorage';
import { nextSubBreakdownName } from '@/lib/breakdownPresets';
import { GradingPolicy } from '@/lib/gradePolicies';
import { createId } from '@/lib/id';

/**
 * What a newly added breakdown needs; everything else has a sensible default.
 *
 * Extends `GradingPolicy` so the add dialog can set drop/downweight up front
 * rather than forcing a second trip through the advanced options.
 */
export interface NewBreakdown extends GradingPolicy {
  name: string;
  weight: number | null;
  subBreakdownLabel: string;
}

const createSubBreakdown = (breakdownId: string, name: string): SubBreakdown => ({
  id: createId(),
  breakdownId,
  name,
  achievedMarks: null,
  // Both blank: the student fills in what the item was out of.
  fullMarks: null,
});

const createBreakdown = (courseId: string, input: NewBreakdown): Breakdown => {
  const breakdownId = createId();
  return {
    id: breakdownId,
    courseId,
    name: input.name,
    weight: input.weight,
    dropLowestCount: input.dropLowestCount,
    downweightLowestCount: input.downweightLowestCount,
    downweightPercent: input.downweightPercent,
    fullCreditGrade: input.fullCreditGrade,
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
            // Stored verbatim — marks are never corrected on the student's
            // behalf, so a score above full marks is kept as a bonus.
            subBreakdowns: breakdown.subBreakdowns.map(sb =>
              sb.id === subBreakdownId ? { ...sb, ...updates } : sb
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

