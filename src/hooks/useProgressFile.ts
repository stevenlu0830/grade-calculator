import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Course, GradeData } from '@/types/grades';
import { plural } from '@/lib/utils';
import {
  PROGRESS_DIRECTORY_NAME,
  ProgressApiUnavailableError,
  isManifestFile,
  loadProgressFromServer,
  parseProgressFiles,
  saveProgressAsSingleFile,
  saveProgressToServer,
} from '@/lib/progressFile';

/**
 * Drives Save Progress and Reload Progress.
 *
 * Both go straight to `progresses/` with no prompt, via the dev server. If no
 * server is answering — a static build — they degrade to a download and a
 * manual file picker rather than failing.
 *
 * Courses and semesters arrive separately rather than as one object, so the
 * callbacks aren't rebuilt on every render by a fresh wrapper.
 */
export function useProgressFile(
  courses: Course[],
  semesters: string[],
  onLoad: (data: GradeData) => void
) {
  const inputRef = useRef<HTMLInputElement>(null);

  const saveProgress = useCallback(async () => {
    // No early return on an empty list: saving means "make the folder match the
    // UI", so deleting every course and saving must leave the folder empty
    // rather than quietly keeping the previous files.
    try {
      const { directory, written, removed } = await saveProgressToServer({ courses, semesters });
      // The manifest is always written; it isn't a course, so it isn't news.
      const savedCourses = written.filter(name => !isManifestFile(name));

      if (savedCourses.length === 0) {
        toast.success(
          removed.length ? `Cleared ${directory}/` : `Nothing to save — ${directory}/ is empty`,
          { description: removed.length ? `Removed ${plural(removed.length, 'file')}.` : undefined }
        );
        return;
      }

      toast.success(`Saved ${plural(savedCourses.length, 'course')} to ${directory}/`, {
        description: removed.length
          ? `${savedCourses.join(', ')} · removed ${plural(removed.length, 'file')} for deleted courses.`
          : savedCourses.join(', '),
      });
    } catch (error) {
      if (error instanceof ProgressApiUnavailableError) {
        saveProgressAsSingleFile({ courses, semesters });
        toast.success('Progress saved', {
          description: 'No local server, so everything went to one downloaded file.',
        });
        return;
      }
      console.error('Save progress failed:', error);
      toast.error(`Could not write to ${PROGRESS_DIRECTORY_NAME}/.`);
    }
  }, [courses, semesters]);

  const reloadProgress = useCallback(async () => {
    try {
      reportLoad(await loadProgressFromServer(), onLoad);
    } catch (error) {
      if (error instanceof ProgressApiUnavailableError) {
        inputRef.current?.click(); // Fall back to picking the files by hand.
        return;
      }
      console.error('Reload progress failed:', error);
      toast.error(`Could not read ${PROGRESS_DIRECTORY_NAME}/.`);
    }
  }, [onLoad]);

  /** Fallback path: the student selected one or more JSON files themselves. */
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = [...(event.target.files ?? [])];
      event.target.value = ''; // Re-picking the same files must still fire a change.
      if (selected.length === 0) return;

      const files = await Promise.all(
        selected.map(async file => ({ name: file.name, contents: await file.text() }))
      );
      reportLoad(parseProgressFiles(files), onLoad);
    },
    [onLoad]
  );

  return { inputRef, saveProgress, reloadProgress, handleFileChange };
}

interface LoadReport extends GradeData {
  skipped: string[];
}

function reportLoad(
  { courses, semesters, skipped }: LoadReport,
  onLoad: (data: GradeData) => void
) {
  // Semesters alone are worth loading: a saved folder can legitimately hold
  // nothing but a manifest, if every semester in it is still empty.
  if (courses.length === 0 && semesters.length === 0) {
    toast.error(
      skipped.length
        ? 'None of those files were saved progress.'
        : `No saved courses found in ${PROGRESS_DIRECTORY_NAME}/.`
    );
    return;
  }

  onLoad({ courses, semesters });
  toast.success(`Reloaded ${plural(courses.length, 'course')}`, {
    description: skipped.length ? `Skipped ${skipped.join(', ')}` : undefined,
  });
}
