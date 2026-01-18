import { useState, useCallback, useEffect } from 'react';
import { Course, Component, SubComponent } from '@/types/grades';

const STORAGE_KEY = 'ubc-grade-calculator-data';

const generateId = () => Math.random().toString(36).substr(2, 9);

const createDefaultSubComponent = (componentId: string): SubComponent => ({
  id: generateId(),
  componentId,
  name: '',
  grade: null,
});

const createDefaultComponent = (courseId: string): Component => {
  const componentId = generateId();
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

const createDefaultCourse = (): Course => {
  const courseId = generateId();
  return {
    id: courseId,
    name: '',
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

  // Auto-save on every change
  useEffect(() => {
    saveToStorage(courses);
  }, [courses]);

  const addCourse = useCallback(() => {
    setCourses(prev => [...prev, createDefaultCourse()]);
  }, []);

  const deleteCourse = useCallback((courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
  }, []);

  const updateCourseName = useCallback((courseId: string, name: string) => {
    setCourses(prev =>
      prev.map(c => (c.id === courseId ? { ...c, name } : c))
    );
  }, []);

  const addComponent = useCallback((courseId: string) => {
    setCourses(prev =>
      prev.map(c =>
        c.id === courseId
          ? { ...c, components: [...c.components, createDefaultComponent(courseId)] }
          : c
      )
    );
  }, []);

  const deleteComponent = useCallback((courseId: string, componentId: string) => {
    setCourses(prev =>
      prev.map(c =>
        c.id === courseId
          ? { ...c, components: c.components.filter(comp => comp.id !== componentId) }
          : c
      )
    );
  }, []);

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
    },
    []
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
                        createDefaultSubComponent(componentId),
                      ],
                    }
                  : comp
              ),
            }
          : c
      )
    );
  }, []);

  const importCourses = useCallback((newCourses: Course[]) => {
    setCourses(newCourses);
  }, []);

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
    },
    []
  );

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
