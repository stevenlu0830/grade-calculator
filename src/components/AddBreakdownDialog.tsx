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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/NumberInput';
import { BREAKDOWN_PRESETS, OTHER_BREAKDOWN, presetFor } from '@/lib/breakdownPresets';
import type { NewBreakdown } from '@/hooks/useGradeStore';

interface AddBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (breakdown: NewBreakdown) => void;
}

/** Picks a breakdown type and weight before the breakdown is created. */
export function AddBreakdownDialog({ open, onOpenChange, onAdd }: AddBreakdownDialogProps) {
  const [choice, setChoice] = useState('');
  const [customName, setCustomName] = useState('');
  const [weight, setWeight] = useState('');

  const isOther = choice === OTHER_BREAKDOWN;
  const name = isOther ? customName.trim() : choice;
  const parsedWeight = weight === '' ? null : parseFloat(weight);
  const canAdd = name !== '' && parsedWeight !== null && !Number.isNaN(parsedWeight);

  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setChoice('');
      setCustomName('');
      setWeight('');
    }
  };

  const submit = () => {
    if (!canAdd) return;
    // A custom name is its own singular; presets carry an explicit one.
    onAdd({ name, weight: parsedWeight, subBreakdownLabel: presetFor(name).singular });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add breakdown</DialogTitle>
          <DialogDescription>
            Choose what this part of the course is, and how much it's worth. Both stay editable
            afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="breakdown-type">Breakdown</Label>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger id="breakdown-type">
                <SelectValue placeholder="Select a breakdown" />
              </SelectTrigger>
              <SelectContent>
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
              max={100}
              value={weight}
              onChange={event => setWeight(event.target.value)}
              placeholder="e.g. 30"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canAdd}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
