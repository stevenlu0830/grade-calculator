import { Button } from '@/components/ui/button';
import { Plus, RotateCcw, Save } from 'lucide-react';

interface CourseToolbarProps {
  onReloadClick: () => void;
  onSaveClick: () => void;
  onAddCourse: () => void;
}

/** Header actions: reload saved progress, save progress, and add a course. */
export function CourseToolbar({ onReloadClick, onSaveClick, onAddCourse }: CourseToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onReloadClick}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Reload Progress
      </Button>

      <Button variant="outline" onClick={onSaveClick}>
        <Save className="h-4 w-4 mr-2" />
        Save Progress
      </Button>

      <Button onClick={onAddCourse}>
        <Plus className="h-4 w-4 mr-2" />
        New Course
      </Button>
    </div>
  );
}
