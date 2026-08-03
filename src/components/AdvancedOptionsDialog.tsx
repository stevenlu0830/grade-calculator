import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AdvancedOptions } from '@/components/AdvancedOptions';
import { GradingPolicy } from '@/lib/gradePolicies';

interface AdvancedOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The committed policy; edits are held in a draft until Apply. */
  policy: GradingPolicy;
  onApply: (policy: GradingPolicy) => void;
}

/**
 * Edits a breakdown's grading policy in a modal.
 *
 * Changes land in a local draft so Cancel genuinely discards them — the
 * breakdown's grade doesn't move around while the student is still deciding.
 */
export function AdvancedOptionsDialog({
  open,
  onOpenChange,
  policy,
  onApply,
}: AdvancedOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Advanced options</DialogTitle>
          <DialogDescription>
            Optional rules for how this breakdown's marks are totalled. The two are mutually
            exclusive.
          </DialogDescription>
        </DialogHeader>

        {/*
          The draft lives in a child, seeded from props at mount, and `key` forces
          a remount whenever the dialog opens or closes. Two subtler approaches
          both failed:
            - an effect depending on `policy` reset an in-progress draft whenever
              anything else in the breakdown changed, since `policy` is a new
              object on every store update;
            - relying on Radix to unmount the content on close, which it defers
              until the exit animation fires `animationend` — that can never
              arrive (reduced-motion, background tabs), leaving a stale draft.
          Keying the remount is independent of both.
        */}
        <AdvancedOptionsForm
          key={String(open)}
          initialPolicy={policy}
          onApply={onApply}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AdvancedOptionsFormProps {
  initialPolicy: GradingPolicy;
  onApply: (policy: GradingPolicy) => void;
  onCancel: () => void;
}

function AdvancedOptionsForm({ initialPolicy, onApply, onCancel }: AdvancedOptionsFormProps) {
  const [draft, setDraft] = useState<GradingPolicy>(initialPolicy);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onApply(draft);
    onCancel();
  };

  return (
    // A form so Return applies.
    <form onSubmit={submit} className="space-y-4">
      <AdvancedOptions policy={draft} onChange={setDraft} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Apply</Button>
      </DialogFooter>
    </form>
  );
}
