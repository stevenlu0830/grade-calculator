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
import { Label } from '@/components/ui/label';
import { Term } from '@/types/grades';
import { TERMS, formatSemester, semesterYearOptions } from '@/lib/semesters';

interface AddSemesterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (semester: string) => void;
  /** Injected so the year list is deterministic in tests. */
  referenceYear?: number;
}

/** Picks a year and term, producing a label like "2026 Summer Term 2". */
export function AddSemesterDialog({
  open,
  onOpenChange,
  onAdd,
  referenceYear = new Date().getFullYear(),
}: AddSemesterDialogProps) {
  const [year, setYear] = useState('');
  const [term, setTerm] = useState('');

  const years = semesterYearOptions(referenceYear);
  const canAdd = year !== '' && term !== '';

  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setYear('');
      setTerm('');
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAdd) return;
    onAdd(formatSemester(Number(year), term as Term));
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add semester</DialogTitle>
          <DialogDescription>
            Courses are grouped by semester. Pick one, then add courses to it.
          </DialogDescription>
        </DialogHeader>

        {/* A form so Return submits from either dropdown. */}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="semester-year">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger id="semester-year">
                <SelectValue placeholder="Select a year" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {years.map(option => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="semester-term">Term</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger id="semester-term">
                <SelectValue placeholder="Select a term" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {TERMS.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
