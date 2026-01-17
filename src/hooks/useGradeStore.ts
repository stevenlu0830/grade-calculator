import { useState, useCallback, useEffect } from 'react';
import { Course, Component, SubComponent } from '@/types/grades';

const STORAGE_KEY = 'grade-calculator-data';

const generateId = () => Math.random().toString(36).substr(2, 9);

const createDefaultSubComponent = (componentId: string): SubComponent => ({
  id: generateId(),
  componentId,
  name: 'Assignment 1',
  grade: null,
});

const createDefaultComponent = (courseId: string): Component => {
  const componentId = generateId();
  return {
    id: componentId,
    courseId,
    name: '',
    weight: 0,
    dropLowestCount: null,
    downweightLowestCount: null,
    downweightPercent: null,
    subComponents: [createDefaultSubComponent(componentId)],
  };
};

const createDefaultCourse = (): Course => {
  const courseId = generateId();
  return {
    id: courseId,
    name: 'New Course',
    components: [],
  };
};

const loadFromStorage = (): Course[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load saved data:', error);
  }
  return [];
};

const saveToStorage = (courses: Course[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch (error) {
    console.error('Failed to save data:', error);
  }
};

export function useGradeStore() {
  const [courses, setCourses] = useState<Course[]>(() => loadFromStorage());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveChanges = useCallback(() => {
    saveToStorage(courses);
    setHasUnsavedChanges(false);
  }, [courses]);

  const markUnsaved = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const addCourse = useCallback(() => {
    setCourses(prev => [...prev, createDefaultCourse()]);
    markUnsaved();
  }, [markUnsaved]);

  const deleteCourse = useCallback((courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
    markUnsaved();
  }, [markUnsaved]);

  const updateCourseName = useCallback((courseId: string, name: string) => {
    setCourses(prev =>
      prev.map(c => (c.id === courseId ? { ...c, name } : c))
    );
    markUnsaved();
  }, [markUnsaved]);

  const addComponent = useCallback((courseId: string) => {
    setCourses(prev =>
      prev.map(c =>
        c.id === courseId
          ? { ...c, components: [...c.components, createDefaultComponent(courseId)] }
          : c
      )
    );
    markUnsaved();
  }, [markUnsaved]);

  const deleteComponent = useCallback((courseId: string, componentId: string) => {
    setCourses(prev =>
      prev.map(c =>
        c.id === courseId
          ? { ...c, components: c.components.filter(comp => comp.id !== componentId) }
          : c
      )
    );
    markUnsaved();
  }, [markUnsaved]);

  const updateComponent = useCallback(
    (courseId: string, componentId: string, updates: Partial<Component>) => {
      setCourses(prev =>
        prev.map(c =>
          c.id === courseId
            ? {
                ...c,
                components: c.components.map(comp =>
                  comp.id === componentId ? { ...comp, ...updates } : comp
                ),
              }
            : c
        )
      );
      markUnsaved();
    },
    [markUnsaved]
  );

  const addSubComponent = useCallback((courseId: string, componentId: string) => {
    setCourses(prev =>
      prev.map(c =>
        c.id === courseId
          ? {
              ...c,
              components: c.components.map(comp =>
                comp.id === componentId
                  ? {
                      ...comp,
                      subComponents: [
                        ...comp.subComponents,
                        {
                          ...createDefaultSubComponent(componentId),
                          name: `Assignment ${comp.subComponents.length + 1}`,
                        },
                      ],
                    }
                  : comp
              ),
            }
          : c
      )
    );
    markUnsaved();
  }, [markUnsaved]);

  const deleteSubComponent = useCallback(
    (courseId: string, componentId: string, subComponentId: string) => {
      setCourses(prev =>
        prev.map(c =>
          c.id === courseId
            ? {
                ...c,
                components: c.components.map(comp => {
                  if (comp.id !== componentId) return comp;
                  // Keep at least one sub-component
                  if (comp.subComponents.length <= 1) return comp;
                  return {
                    ...comp,
                    subComponents: comp.subComponents.filter(sc => sc.id !== subComponentId),
                  };
                }),
              }
            : c
        )
      );
      markUnsaved();
    },
    [markUnsaved]
  );

  const updateSubComponent = useCallback(
    (
      courseId: string,
      componentId: string,
      subComponentId: string,
      updates: Partial<SubComponent>
    ) => {
      setCourses(prev =>
        prev.map(c =>
          c.id === courseId
            ? {
                ...c,
                components: c.components.map(comp =>
                  comp.id === componentId
                    ? {
                        ...comp,
                        subComponents: comp.subComponents.map(sc =>
                          sc.id === subComponentId
                            ? {
                                ...sc,
                                ...updates,
                                grade:
                                  updates.grade !== undefined
                                    ? updates.grade === null
                                      ? null
                                      : Math.min(100, Math.max(0, updates.grade))
                                    : sc.grade,
                              }
                            : sc
                        ),
                      }
                    : comp
                ),
              }
            : c
        )
      );
      markUnsaved();
    },
    [markUnsaved]
  );

  return {
    courses,
    hasUnsavedChanges,
    saveChanges,
    addCourse,
    deleteCourse,
    updateCourseName,
    addComponent,
    deleteComponent,
    updateComponent,
    addSubComponent,
    deleteSubComponent,
    updateSubComponent,
  };
}
