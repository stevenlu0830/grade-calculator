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

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names what's going, e.g. `Delete "CPSC 110"?`. */
  title: string;
  /** What else goes with it, and that it can't be undone. */
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

/**
 * The confirmation every delete in the app goes through.
 *
 * There is no undo anywhere here, and deletes cascade — a semester takes its
 * courses, a course takes its breakdowns, a breakdown takes its marks — so each
 * caller spells out the blast radius in `description` rather than leaving the
 * student to remember what was underneath.
 *
 * Deliberately dumb: it owns no state and knows nothing about the domain. The
 * component holding the delete button owns the open flag, since that's what
 * knows which row was clicked.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
