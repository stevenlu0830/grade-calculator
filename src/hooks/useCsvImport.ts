import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Course } from '@/types/grades';
import { parseCSV } from '@/lib/csvImport';

/**
 * Drives CSV import: owns the hidden file input, reads the chosen file, and
 * reports the outcome.
 *
 * Returned as a hook rather than baked into a button so the header and the
 * empty state can both trigger the same picker.
 */
export function useCsvImport(onImport: (courses: Course[]) => void) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset immediately so re-picking the same file still fires a change.
      event.target.value = '';

      if (!file) return;

      if (!file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
        try {
          const courses = parseCSV(e.target?.result as string);

          if (courses.length === 0) {
            toast.error('No valid data found in CSV');
            return;
          }

          onImport(courses);
          toast.success(`Imported ${courses.length} course(s)`);
        } catch (error) {
          console.error('Import error:', error);
          toast.error('Failed to parse CSV file');
        }
      };
      reader.readAsText(file);
    },
    [onImport]
  );

  return { inputRef, openFilePicker, handleFileChange };
}
