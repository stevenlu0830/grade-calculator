import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AdvancedOptions } from '@/components/AdvancedOptions';
import {
  GradingPolicy,
  PolicyDraft,
  describeDraftErrors,
  policyDraftErrors,
  policyFromDraft,
  toPolicyDraft,
} from '@/lib/gradePolicies';
import { AlertTriangle } from 'lucide-react';

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
            Optional rules for this breakdown. Drop Lowest and Downweight are mutually exclusive;
            Equal Weight and Full Credit combine with either — Equal Weight decides what the marks
            add up to, Full Credit scales the result so that percentage earns 100%. Bonus makes the
            whole breakdown extra credit.
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
  const [draft, setDraft] = useState<PolicyDraft>(() => toPolicyDraft(initialPolicy));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (next: PolicyDraft) => {
    setDraft(next);
    // The complaint is about the boxes as they were; typing makes it stale.
    setError(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    // An empty box is fine while editing but never on the way out — applying it
    // would have to invent a number, and guessing at a grading rule is worse
    // than saying no.
    const blank = describeDraftErrors(policyDraftErrors(draft));
    if (blank) {
      setError(blank);
      return;
    }

    onApply(policyFromDraft(draft));
    onCancel();
  };

  return (
    // A form so Return applies.
    <form onSubmit={submit} className="space-y-4">
      <AdvancedOptions draft={draft} onChange={handleChange} />

      {error && (
        <Alert variant="destructive" className="bg-warning/10 border-warning">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm text-foreground">{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Apply</Button>
      </DialogFooter>
    </form>
  );
}
