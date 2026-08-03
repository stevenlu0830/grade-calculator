import { Course } from '@/types/grades';

/**
 * Where saved courses live.
 *
 * The store depends on this interface rather than on `localStorage` directly,
 * so it can be exercised without a browser and swapped for a server-backed
 * implementation without touching state logic.
 */
export interface CourseStorage {
  load(): Course[];
  save(courses: Course[]): void;
}

export const STORAGE_KEY = 'ubc-grade-calculator-data';

/**
 * Browser-backed storage. Both operations degrade to a console error rather
 * than throwing — private browsing and quota limits are expected conditions,
 * and losing persistence should not take the app down with it.
 */
export const localCourseStorage: CourseStorage = {
  load(): Course[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.error('Failed to load saved data:', error);
    }
    return [];
  },

  save(courses: Course[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  },
};
