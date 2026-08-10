import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { semesterLabel } from '@/lib/semesters';

interface DeleteSemesterDialogProps {
  /** The semester awaiting confirmation, or `null` when nothing is. */
  semester: string | null;
  /** How many courses go with it — the whole reason to ask first. */
  courseCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms deleting a semester.
 *
 * Deleting one takes its courses — and their breakdowns and marks — with it,
 * and there's no undo, so the count is spelled out rather than left to the
 * student to remember.
 */
export function DeleteSemesterDialog({
  semester,
  courseCount,
  onCancel,
  onConfirm,
}: DeleteSemesterDialogProps) {
  const courses = `${courseCount} course${courseCount === 1 ? '' : 's'}`;

  return (
    <AlertDialog open={semester !== null} onOpenChange={open => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {semester === null ? 'this semester' : semesterLabel(semester)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {courseCount === 0
              ? 'This semester has no courses in it. Deleting it cannot be undone.'
              : `Deleting a semester also deletes all courses under it — ${courses}, along with
                 their breakdowns and marks. This cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete semester
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
