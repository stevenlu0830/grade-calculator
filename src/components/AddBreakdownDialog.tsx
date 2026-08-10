import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/NumberInput';
import { AdvancedOptions } from '@/components/AdvancedOptions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BREAKDOWN_PRESETS, OTHER_BREAKDOWN, presetFor } from '@/lib/breakdownPresets';
import {
  NO_POLICY_DRAFT,
  PolicyDraft,
  describeDraftErrors,
  describePolicy,
  policyDraftErrors,
  policyFromDraft,
} from '@/lib/gradePolicies';
import { AlertTriangle, ChevronDown, Settings2 } from 'lucide-react';
import type { NewBreakdown } from '@/hooks/useGradeStore';

interface AddBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (breakdown: NewBreakdown) => void;
}

/** Picks a breakdown type, weight and optional grading policy before creation. */
export function AddBreakdownDialog({ open, onOpenChange, onAdd }: AddBreakdownDialogProps) {
  const [choice, setChoice] = useState('');
  const [customName, setCustomName] = useState('');
  const [weight, setWeight] = useState('');
  const [draft, setDraft] = useState<PolicyDraft>(NO_POLICY_DRAFT);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOther = choice === OTHER_BREAKDOWN;
  const name = isOther ? customName.trim() : choice;
  const parsedWeight = weight === '' ? null : parseFloat(weight);
  const canAdd = name !== '' && parsedWeight !== null && !Number.isNaN(parsedWeight);
  const activePolicy = describePolicy(policyFromDraft(draft));

  const handlePolicyChange = (next: PolicyDraft) => {
    setDraft(next);
    setError(null);
  };

  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setChoice('');
      setCustomName('');
      setWeight('');
      setDraft(NO_POLICY_DRAFT);
      setAdvancedOpen(false);
      setError(null);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAdd) return;

    // Same rule as the advanced options dialog: an option that's switched on
    // must have a number in its box before it can be committed.
    const blank = describeDraftErrors(policyDraftErrors(draft));
    if (blank) {
      setAdvancedOpen(true); // Nothing to fix if the section it's in is collapsed.
      setError(blank);
      return;
    }

    // A custom name is its own singular; presets carry an explicit one.
    onAdd({
      name,
      weight: parsedWeight,
      subBreakdownLabel: presetFor(name).singular,
      ...policyFromDraft(draft),
    });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add breakdown</DialogTitle>
          <DialogDescription>
            Choose what this part of the course is, and how much it's worth. Everything stays
            editable afterwards.
          </DialogDescription>
        </DialogHeader>

        {/* A form so Return submits from any field. */}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="breakdown-type">Breakdown</Label>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger id="breakdown-type">
                <SelectValue placeholder="Select a breakdown" />
              </SelectTrigger>
              {/* Kept short so the list scrolls internally instead of running off screen. */}
              <SelectContent className="max-h-56">
                {BREAKDOWN_PRESETS.map(preset => (
                  <SelectItem key={preset.label} value={preset.label}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_BREAKDOWN}>Others (Specify)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isOther && (
            <div className="space-y-2 animate-fade-in">
              <Label htmlFor="breakdown-custom-name">Name</Label>
              <Input
                id="breakdown-custom-name"
                value={customName}
                onChange={event => setCustomName(event.target.value)}
                placeholder="e.g. Reading Responses"
                autoFocus
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="breakdown-weight">Weighting (%)</Label>
            <NumberInput
              id="breakdown-weight"
              min={0}
              value={weight}
              onChange={event => setWeight(event.target.value)}
              placeholder="e.g. 30"
            />
          </div>

          {/* Collapsed by default — most breakdowns need no policy at all. */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-0 text-muted-foreground hover:bg-transparent"
                >
                  <Settings2 className="h-4 w-4 mr-1.5" />
                  Advanced options
                  <ChevronDown
                    className={`h-4 w-4 ml-1.5 transition-transform ${
                      advancedOpen ? '' : '-rotate-90'
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              {!advancedOpen && activePolicy && (
                <span className="text-xs text-muted-foreground">{activePolicy}</span>
              )}
            </div>
            <CollapsibleContent className="pt-3">
              <AdvancedOptions draft={draft} onChange={handlePolicyChange} />
            </CollapsibleContent>
          </Collapsible>

          {error && (
            <Alert variant="destructive" className="bg-warning/10 border-warning">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm text-foreground">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canAdd}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
