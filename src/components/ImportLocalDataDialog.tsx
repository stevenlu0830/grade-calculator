import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { plural } from '@/lib/utils';

interface ImportLocalDataDialogProps {
  open: boolean;
  courseCount: number;
  onImport: () => void;
  onDecline: () => void;
}

/**
 * Offers data saved in this browser before the app had accounts.
 *
 * Only ever shown for an empty account, so importing can't overwrite anything.
 * Both buttons are a final answer — the offer isn't made again either way, which
 * is why declining says what it costs.
 */
export function ImportLocalDataDialog({
  open,
  courseCount,
  onImport,
  onDecline,
}: ImportLocalDataDialogProps) {
  return (
    <Dialog open={open} onOpenChange={isOpen => !isOpen && onDecline()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bring your saved courses over?</DialogTitle>
          <DialogDescription>
            {plural(courseCount, 'course')} from before you had an account{' '}
            {courseCount === 1 ? 'is' : 'are'} still saved in this browser. Import{' '}
            {courseCount === 1 ? 'it' : 'them'} into your account and they’ll follow you to any
            device you sign in on.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onDecline}>
            Start fresh
          </Button>
          <Button onClick={onImport}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
