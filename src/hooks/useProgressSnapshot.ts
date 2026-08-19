import { useCallback } from 'react';
import { toast } from 'sonner';
import { Course, GradeData } from '@/types/grades';
import { supabaseProgressStorage } from '@/lib/supabaseProgress';
import { plural } from '@/lib/utils';

/**
 * Drives Save Progress and Reload Progress.
 *
 * Both go straight to the signed-in account's row of `user_progress`, with no
 * prompt. The snapshot lives in the account rather than on the machine, so it
 * follows the student to any computer they sign in on, and two people sharing a
 * computer can't reach each other's — row-level security decides that, not a
 * folder name.
 *
 * `userId` names whose snapshot to touch. Courses and semesters arrive
 * separately rather than as one object, so the callbacks aren't rebuilt on every
 * render by a fresh wrapper.
 */
export function useProgressSnapshot(
  userId: string,
  courses: Course[],
  semesters: string[],
  onLoad: (data: GradeData) => void
) {
  const saveProgress = useCallback(async () => {
    // No early return on an empty list: saving means "make the snapshot match
    // the UI", so deleting every course and saving must leave the snapshot
    // empty rather than quietly keeping the previous one for a reload to find.
    try {
      await supabaseProgressStorage(userId).save({ courses, semesters });

      // Where the snapshot went is the app's business, not the student's — they
      // pressed Save, so the news is how much of their work is saved.
      if (courses.length === 0) {
        toast.success('Progress Saved', {
          description: semesters.length
            ? `No courses — just ${plural(semesters.length, 'empty semester')}.`
            : 'There were no courses to save.',
        });
        return;
      }

      toast.success(`${plural(courses.length, 'Course')} Saved`);
    } catch (error) {
      console.error('Save progress failed:', error);
      toast.error('Could not save your progress', { description: asMessage(error) });
    }
  }, [userId, courses, semesters]);

  const reloadProgress = useCallback(async () => {
    try {
      const snapshot = await supabaseProgressStorage(userId).load();

      if (snapshot === null) {
        toast.error('Nothing saved yet', {
          description: 'Press Save Progress to make a copy you can come back to.',
        });
        return;
      }

      // Semesters alone are worth loading: a snapshot can legitimately hold no
      // courses at all, if every semester in it is still empty. Restoring a
      // snapshot with neither would only wipe the screen, so it stops here.
      if (snapshot.courses.length === 0 && snapshot.semesters.length === 0) {
        toast.error('Your saved progress is empty', {
          description: 'It was saved with no courses and no semesters in it.',
        });
        return;
      }

      onLoad({ courses: snapshot.courses, semesters: snapshot.semesters });
      toast.success(`Reloaded ${plural(snapshot.courses.length, 'course')}`, {
        // Which copy just landed on screen — the one thing about a snapshot the
        // student can't see for themselves.
        description: snapshot.savedAt ? `Saved ${snapshot.savedAt.toLocaleString()}.` : undefined,
      });
    } catch (error) {
      console.error('Reload progress failed:', error);
      toast.error('Could not read your saved progress', { description: asMessage(error) });
    }
  }, [userId, onLoad]);

  return { saveProgress, reloadProgress };
}

const asMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
