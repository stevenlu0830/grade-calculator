import { Course } from '@/types/grades';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UNASSIGNED_SEMESTER, countCoursesIn, semesterLabel } from '@/lib/semesters';
import { CalendarDays, Plus } from 'lucide-react';

interface SemesterPanelProps {
  semesters: string[];
  selected: string | null;
  courses: Course[];
  onSelect: (semester: string) => void;
  onAddSemester: () => void;
}

/** Left panel: add a semester, then pick which one's courses to show. */
export function SemesterPanel({
  semesters,
  selected,
  courses,
  onSelect,
  onAddSemester,
}: SemesterPanelProps) {
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
                <button
                  key={semester || UNASSIGNED_SEMESTER}
                  onClick={() => onSelect(semester)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-secondary'
                  )}
                >
                  <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="flex-1 truncate">{semesterLabel(semester)}</span>
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      isSelected ? 'opacity-80' : 'text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
}
