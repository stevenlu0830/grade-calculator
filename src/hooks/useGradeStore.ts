import { useState, useCallback, useEffect } from 'react';
import { Course, Component, SubComponent } from '@/types/grades';
import { CourseStorage, localCourseStorage } from '@/lib/courseStorage';
import { clampGrade } from '@/lib/gradeCalculations';
import { createId } from '@/lib/id';

const createDefaultSubComponent = (componentId: string): SubComponent => ({
  id: createId(),
  componentId,
  name: '',
  grade: null,
});

const createDefaultComponent = (courseId: string): Component => {
  const componentId = createId();
  return {
    id: componentId,
    courseId,
    name: '',
    weight: null,
    dropLowestCount: null,
    downweightLowestCount: null,
    downweightPercent: null,
    subComponents: [createDefaultSubComponent(componentId)],
  };
};

const createDefaultCourse = (): Course => ({
  id: createId(),
  name: '',
  components: [],
});

/** Applies `update` to the matching course, leaving the others untouched. */
const mapCourse = (courses: Course[], courseId: string, update: (course: Course) => Course) =>
  courses.map(course => (course.id === courseId ? update(course) : course));

/** Applies `update` to the matching component within a course. */
const mapComponent = (
  course: Course,
  componentId: string,
  update: (component: Component) => Component
): Course => ({
  ...course,
  components: course.components.map(c => (c.id === componentId ? update(c) : c)),
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

  const addCourse = useCallback(() => {
    setCourses(prev => [...prev, createDefaultCourse()]);
  }, []);

  const deleteCourse = useCallback((courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
  }, []);

  const updateCourseName = useCallback((courseId: string, name: string) => {
    setCourses(prev => mapCourse(prev, courseId, course => ({ ...course, name })));
  }, []);

  const addComponent = useCallback((courseId: string) => {
    setCourses(prev =>
      mapCourse(prev, courseId, course => ({
        ...course,
        components: [...course.components, createDefaultComponent(courseId)],
      }))
    );
  }, []);

  const deleteComponent = useCallback((courseId: string, componentId: string) => {
    setCourses(prev =>
      mapCourse(prev, courseId, course => ({
        ...course,
        components: course.components.filter(c => c.id !== componentId),
      }))
    );
  }, []);

  const updateComponent = useCallback(
    (courseId: string, componentId: string, updates: Partial<Component>) => {
      setCourses(prev =>
        mapCourse(prev, courseId, course =>
          mapComponent(course, componentId, component => ({ ...component, ...updates }))
        )
      );
    },
    []
  );

  const addSubComponent = useCallback((courseId: string, componentId: string) => {
    setCourses(prev =>
      mapCourse(prev, courseId, course =>
        mapComponent(course, componentId, component => ({
          ...component,
          subComponents: [...component.subComponents, createDefaultSubComponent(componentId)],
        }))
      )
    );
  }, []);

  const deleteSubComponent = useCallback(
    (courseId: string, componentId: string, subComponentId: string) => {
      setCourses(prev =>
        mapCourse(prev, courseId, course =>
          mapComponent(course, componentId, component =>
            // A component always keeps at least one sub-component.
            component.subComponents.length <= 1
              ? component
              : {
                  ...component,
                  subComponents: component.subComponents.filter(sc => sc.id !== subComponentId),
                }
          )
        )
      );
    },
    []
  );

  const updateSubComponent = useCallback(
    (
      courseId: string,
      componentId: string,
      subComponentId: string,
      updates: Partial<SubComponent>
    ) => {
      setCourses(prev =>
        mapCourse(prev, courseId, course =>
          mapComponent(course, componentId, component => ({
            ...component,
            subComponents: component.subComponents.map(sc =>
              sc.id === subComponentId ? applySubComponentUpdate(sc, updates) : sc
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
    addComponent,
    deleteComponent,
    updateComponent,
    addSubComponent,
    deleteSubComponent,
    updateSubComponent,
    importCourses,
  };
}

/** Grades are clamped on write so no out-of-range value can enter the store. */
function applySubComponentUpdate(
  subComponent: SubComponent,
  updates: Partial<SubComponent>
): SubComponent {
  const grade =
    updates.grade === undefined
      ? subComponent.grade
      : updates.grade === null
        ? null
        : clampGrade(updates.grade);

  return { ...subComponent, ...updates, grade };
}
