import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Course } from '@/types/grades';
import {
  PROGRESS_DIRECTORY_NAME,
  ProgressApiUnavailableError,
  loadProgressFromServer,
  parseProgressFiles,
  saveProgressAsSingleFile,
  saveProgressToServer,
} from '@/lib/progressFile';

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * Drives Save Progress and Reload Progress.
 *
 * Both go straight to `progresses/` with no prompt, via the dev server. If no
 * server is answering — a static build — they degrade to a download and a
 * manual file picker rather than failing.
 */
export function useProgressFile(courses: Course[], onLoad: (courses: Course[]) => void) {
  const inputRef = useRef<HTMLInputElement>(null);

  const saveProgress = useCallback(async () => {
    // No early return on an empty list: saving means "make the folder match the
    // UI", so deleting every course and saving must leave the folder empty
    // rather than quietly keeping the previous files.
    try {
      const { directory, written, removed } = await saveProgressToServer(courses);

      if (written.length === 0) {
        toast.success(
          removed.length ? `Cleared ${directory}/` : `Nothing to save — ${directory}/ is empty`,
          { description: removed.length ? `Removed ${plural(removed.length, 'file')}.` : undefined }
        );
        return;
      }

      toast.success(`Saved ${plural(written.length, 'course')} to ${directory}/`, {
        description: removed.length
          ? `${written.join(', ')} · removed ${plural(removed.length, 'file')} for deleted courses.`
          : written.join(', '),
      });
    } catch (error) {
      if (error instanceof ProgressApiUnavailableError) {
        saveProgressAsSingleFile(courses);
        toast.success('Progress saved', {
          description: 'No local server, so everything went to one downloaded file.',
        });
        return;
      }
      console.error('Save progress failed:', error);
      toast.error(`Could not write to ${PROGRESS_DIRECTORY_NAME}/.`);
    }
  }, [courses]);

  const reloadProgress = useCallback(async () => {
    try {
      const { courses: loaded, skipped } = await loadProgressFromServer();
      reportLoad(loaded, skipped, onLoad);
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
      const { courses: loaded, skipped } = parseProgressFiles(files);
      reportLoad(loaded, skipped, onLoad);
    },
    [onLoad]
  );

  return { inputRef, saveProgress, reloadProgress, handleFileChange };
}

function reportLoad(loaded: Course[], skipped: string[], onLoad: (courses: Course[]) => void) {
  if (loaded.length === 0) {
    toast.error(
      skipped.length
        ? 'None of those files were saved progress.'
        : `No saved courses found in ${PROGRESS_DIRECTORY_NAME}/.`
    );
    return;
  }

  onLoad(loaded);
  toast.success(`Reloaded ${plural(loaded.length, 'course')}`, {
    description: skipped.length ? `Skipped ${skipped.join(', ')}` : undefined,
  });
}
