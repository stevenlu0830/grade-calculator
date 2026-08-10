import { useState, useCallback, useEffect } from 'react';
import { Course, Breakdown, GradeData, SubBreakdown } from '@/types/grades';
import { CourseStorage, localCourseStorage } from '@/lib/courseStorage';
import { nextSubBreakdownName } from '@/lib/breakdownPresets';
import { GradingPolicy } from '@/lib/gradePolicies';
import { UNASSIGNED_SEMESTER, persistedSemesters } from '@/lib/semesters';
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
    isBonus: input.isBonus,
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
 * Everything a semester a course names is also on the semester list, so nothing
 * disappears when its last course is deleted.
 */
const normalize = (data: GradeData): GradeData => ({
  courses: data.courses,
  semesters: persistedSemesters(data.courses, data.semesters),
});

/**
 * The single source of truth for course data.
 *
 * Call this once, at the top of the tree, and pass its actions down: a second
 * instance would be an independent state tree racing the first over the same
 * storage key.
 */
export function useGradeStore(storage: CourseStorage = localCourseStorage) {
  const [data, setData] = useState<GradeData>(() => normalize(storage.load()));
  const { courses, semesters } = data;

  // Autosave: no component ever writes to storage itself.
  useEffect(() => {
    storage.save(data);
  }, [data, storage]);

  /** Course actions all edit the same slice; semesters ride along untouched. */
  const setCourses = useCallback((update: (courses: Course[]) => Course[]) => {
    setData(prev => ({ ...prev, courses: update(prev.courses) }));
  }, []);

  const addSemester = useCallback((semester: string) => {
    setData(prev =>
      prev.semesters.includes(semester)
        ? prev
        : { ...prev, semesters: [...prev.semesters, semester] }
    );
  }, []);

  /** Takes the semester's courses with it — the dialog warns before this runs. */
  const deleteSemester = useCallback((semester: string) => {
    setData(prev => ({
      semesters: prev.semesters.filter(s => s !== semester),
      courses: prev.courses.filter(
        course => (course.semester ?? UNASSIGNED_SEMESTER) !== semester
      ),
    }));
  }, []);

  const addCourse = useCallback((name: string, semester: string) => {
    setData(prev => ({
      // A course can be added to a semester loaded from a file that never named
      // it explicitly; recording it here keeps the panel honest.
      semesters:
        semester === UNASSIGNED_SEMESTER || prev.semesters.includes(semester)
          ? prev.semesters
          : [...prev.semesters, semester],
      courses: [...prev.courses, { id: createId(), name, semester, breakdowns: [] }],
    }));
  }, []);

  const deleteCourse = useCallback((courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
  }, [setCourses]);

  const updateCourseName = useCallback((courseId: string, name: string) => {
    setCourses(prev => mapCourse(prev, courseId, course => ({ ...course, name })));
  }, [setCourses]);

  const addBreakdown = useCallback((courseId: string, input: NewBreakdown) => {
    setCourses(prev =>
      mapCourse(prev, courseId, course => ({
        ...course,
        breakdowns: [...course.breakdowns, createBreakdown(courseId, input)],
      }))
    );
  }, [setCourses]);

  const deleteBreakdown = useCallback((courseId: string, breakdownId: string) => {
    setCourses(prev =>
      mapCourse(prev, courseId, course => ({
        ...course,
        breakdowns: course.breakdowns.filter(b => b.id !== breakdownId),
      }))
    );
  }, [setCourses]);

  const updateBreakdown = useCallback(
    (courseId: string, breakdownId: string, updates: Partial<Breakdown>) => {
      setCourses(prev =>
        mapCourse(prev, courseId, course =>
          mapBreakdown(course, breakdownId, breakdown => ({ ...breakdown, ...updates }))
        )
      );
    },
    [setCourses]
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
  }, [setCourses]);

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
    [setCourses]
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
    [setCourses]
  );

  /** Replaces everything — what Reload Progress does. */
  const importData = useCallback((next: GradeData) => {
    setData(normalize(next));
  }, []);

  return {
    courses,
    semesters,
    addSemester,
    deleteSemester,
    addCourse,
    deleteCourse,
    updateCourseName,
    addBreakdown,
    deleteBreakdown,
    updateBreakdown,
    addSubBreakdown,
    deleteSubBreakdown,
    updateSubBreakdown,
    importData,
  };
}

