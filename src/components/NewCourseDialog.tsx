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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface NewCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => void;
}

/** Prompts for a course name before the course is created. */
export function NewCourseDialog({ open, onOpenChange, onAdd }: NewCourseDialogProps) {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setName('');
  };

  const submit = () => {
    if (!trimmed) return;
    onAdd(trimmed);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
          <DialogDescription>
            Give the course a name. You can rename it later.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={event => {
            event.preventDefault();
            submit();
          }}
          className="space-y-2"
        >
          <Label htmlFor="course-name">Course name</Label>
          <Input
            id="course-name"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="e.g. CPSC 121"
            autoFocus
          />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!trimmed}>
            Add course
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
