import { useState } from 'react';
import { Course } from '@/types/grades';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, plural } from '@/lib/utils';
import {
  UNASSIGNED_SEMESTER,
  countCoursesIn,
  semesterLabel,
  shortSemesterLabel,
} from '@/lib/semesters';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';

interface SemesterPanelProps {
  semesters: string[];
  selected: string | null;
  courses: Course[];
  onSelect: (semester: string) => void;
  onAddSemester: () => void;
  /** Called once the student has confirmed; the panel does the asking. */
  onDeleteSemester: (semester: string) => void;
}

/** Left panel: add a semester, then pick which one's courses to show. */
export function SemesterPanel({
  semesters,
  selected,
  courses,
  onSelect,
  onAddSemester,
  onDeleteSemester,
}: SemesterPanelProps) {
  /** The semester awaiting confirmation, or `null` when nothing is. */
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const pendingCourseCount = pendingDelete === null ? 0 : countCoursesIn(courses, pendingDelete);

  const confirmDelete = () => {
    if (pendingDelete !== null) onDeleteSemester(pendingDelete);
    setPendingDelete(null);
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card/40">
      <div className="sticky top-[105px] p-4 space-y-4">
        <Button onClick={onAddSemester} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Semester
        </Button>

        {semesters.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">
            No semesters yet. Add one to start adding courses.
          </p>
        ) : (
          <nav className="space-y-1">
            {semesters.map(semester => {
              const isSelected = semester === selected;
              const count = countCoursesIn(courses, semester);

              return (
                // The row is a container rather than one button, because the
                // delete control is a button and buttons cannot nest.
                <div
                  key={semester || UNASSIGNED_SEMESTER}
                  className={cn(
                    'group flex items-center rounded-md pr-1 transition-colors',
                    isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                  )}
                >
                  {/* Abbreviated to fit; hovering gives back the full label,
                      which is what's stored and what every other surface uses. */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onSelect(semester)}
                        aria-current={isSelected ? 'true' : undefined}
                        aria-label={semesterLabel(semester)}
                        className="flex flex-1 min-w-0 items-center gap-2 px-3 py-2 text-left text-sm"
                      >
                        <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="flex-1 truncate">{shortSemesterLabel(semester)}</span>
                        <span
                          className={cn(
                            'text-xs tabular-nums',
                            isSelected ? 'opacity-80' : 'text-muted-foreground'
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {semesterLabel(semester)} · {plural(count, 'course')}
                    </TooltipContent>
                  </Tooltip>

                  {/* Kept out of the way until the row is hovered or the button
                      is tabbed to — deleting a semester takes its courses. */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
                      isSelected
                        ? 'text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground'
                        : 'text-muted-foreground hover:text-destructive'
                    )}
                    onClick={() => setPendingDelete(semester)}
                    aria-label={`Delete ${semesterLabel(semester)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </nav>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={open => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete === null ? 'this semester' : semesterLabel(pendingDelete)}?`}
        description={
          pendingCourseCount === 0
            ? 'This semester has no courses in it. Deleting it cannot be undone.'
            : `Deleting a semester also deletes all courses under it — ${plural(
                pendingCourseCount,
                'course'
              )}, along with their breakdowns and marks. This cannot be undone.`
        }
        confirmLabel="Delete semester"
        onConfirm={confirmDelete}
      />
    </aside>
  );
}
