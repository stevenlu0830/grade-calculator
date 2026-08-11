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
 * Both go straight to the signed-in account's own folder under `progresses/`
 * with no prompt, via the dev server. If no server is answering — a static
 * build — they degrade to a download and a manual file picker rather than
 * failing; there, the file lands in whoever's Downloads folder, so it is
 * already per-person without the server's help.
 *
 * `owner` is the account id, and it is what keeps two students on one dev
 * server out of each other's files.
 *
 * Courses and semesters arrive separately rather than as one object, so the
 * callbacks aren't rebuilt on every render by a fresh wrapper.
 */
export function useProgressFile(
  owner: string,
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
      const { written, removed } = await saveProgressToServer(owner, {
        courses,
        semesters,
      });
      // The manifest is always written; it isn't a course, so it isn't news.
      const savedCourses = written.filter(name => !isManifestFile(name));

      // Where the files went is the app's business, not the student's — they
      // pressed Save, so the news is how much of their work is saved.
      if (savedCourses.length === 0) {
        toast.success(removed.length ? '0 Courses Saved' : 'Nothing to save', {
          description: removed.length ? `Removed ${plural(removed.length, 'file')}.` : undefined,
        });
        return;
      }

      toast.success(`${plural(savedCourses.length, 'Course')} Saved`, {
        description: removed.length
          ? `Removed ${plural(removed.length, 'file')} for deleted courses.`
          : undefined,
      });
    } catch (error) {
      if (error instanceof ProgressApiUnavailableError) {
        saveProgressAsSingleFile({ courses, semesters });
        // The one place the destination is still worth saying: the file landed
        // in Downloads rather than in the folder Reload reads.
        toast.success(`${plural(courses.length, 'Course')} Saved`, {
          description: 'No local server, so everything went to one downloaded file.',
        });
        return;
      }
      console.error('Save progress failed:', error);
      toast.error(`Could not write to ${PROGRESS_DIRECTORY_NAME}/.`);
    }
  }, [owner, courses, semesters]);

  const reloadProgress = useCallback(async () => {
    try {
      reportLoad(await loadProgressFromServer(owner), onLoad);
    } catch (error) {
      if (error instanceof ProgressApiUnavailableError) {
        inputRef.current?.click(); // Fall back to picking the files by hand.
        return;
      }
      console.error('Reload progress failed:', error);
      toast.error(`Could not read ${PROGRESS_DIRECTORY_NAME}/.`);
    }
  }, [owner, onLoad]);

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
