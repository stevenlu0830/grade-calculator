import { useState } from 'react';
import { Breakdown, Course, SubBreakdown } from '@/types/grades';
import { BreakdownCard } from './BreakdownCard';
import { GradeDisplay } from './GradeDisplay';
import { AddBreakdownDialog } from './AddBreakdownDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import {
  areWeightsValid,
  calculateCourseGrade,
  getBonusWeight,
  getTotalWeight,
} from '@/lib/gradeCalculations';
import { formatWeight } from '@/lib/gradeFormatting';
import { plural } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, AlertTriangle, GraduationCap } from 'lucide-react';
import type { NewBreakdown } from '@/hooks/useGradeStore';

interface CourseSectionProps {
  course: Course;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onAddBreakdown: (breakdown: NewBreakdown) => void;
  onDeleteBreakdown: (breakdownId: string) => void;
  onUpdateBreakdown: (breakdownId: string, updates: Partial<Breakdown>) => void;
  onAddSubBreakdown: (breakdownId: string) => void;
  onDeleteSubBreakdown: (breakdownId: string, subBreakdownId: string) => void;
  onUpdateSubBreakdown: (
    breakdownId: string,
    subBreakdownId: string,
    updates: Partial<SubBreakdown>
  ) => void;
}

export function CourseSection({
  course,
  onUpdateName,
  onDelete,
  onAddBreakdown,
  onDeleteBreakdown,
  onUpdateBreakdown,
  onAddSubBreakdown,
  onDeleteSubBreakdown,
  onUpdateSubBreakdown,
}: CourseSectionProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const totalWeight = getTotalWeight(course.breakdowns);
  const bonusWeight = getBonusWeight(course.breakdowns);
  const weightsAreValid = areWeightsValid(course.breakdowns);
  const courseGrade = weightsAreValid ? calculateCourseGrade(course.breakdowns) : null;
  const showWeightWarning = course.breakdowns.length > 0 && !weightsAreValid;

  return (
    // No `overflow-hidden`: it would make this card the sticky header's scroll
    // container, and the header has to stick to the top of the panel instead.
    <Card className="border-border shadow-md animate-fade-in">
      <AddBreakdownDialog open={addOpen} onOpenChange={setAddOpen} onAdd={onAddBreakdown} />

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete ${course.name.trim() || 'this course'}?`}
        description={
          course.breakdowns.length === 0
            ? 'This course has no breakdowns in it. Deleting it cannot be undone.'
            : `Deleting a course also deletes everything under it — ${plural(
                course.breakdowns.length,
                'breakdown'
              )} and every mark entered on them. This cannot be undone.`
        }
        confirmLabel="Delete course"
        onConfirm={onDelete}
      />

      {/* Sticky, because the name and the final grade are what the student is
          watching while they type marks further down the card. The panel is what
          scrolls, and `-top-3` cancels its 12px top padding: at plain `top-0`
          the header pins *below* that padding, and rows scroll through the strip
          above it. `bg-card` under the gradient keeps those rows from showing
          through the header itself. */}
      <CardHeader className="sticky -top-3 z-20 rounded-t-lg border-b border-border bg-card bg-gradient-to-r from-primary/5 to-primary/10 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="p-1 rounded-md bg-primary/10 shrink-0">
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
            </div>
            <Input
              value={course.name}
              onChange={e => onUpdateName(e.target.value)}
              className="flex-1 min-w-0 h-7 px-1.5 text-sm font-semibold border-transparent hover:border-border focus:border-border bg-transparent"
              placeholder="Course name"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="text-right">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                Final Grade
              </div>
              {weightsAreValid ? (
                <GradeDisplay grade={courseGrade} size="lg" showLetterGrade />
              ) : (
                <span className="text-base text-muted-foreground">—</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              aria-label="Delete course"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-2 space-y-2">
        {showWeightWarning && (
          <Alert variant="destructive" className="bg-warning/10 border-warning p-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <AlertDescription className="text-xs text-foreground">
              Breakdown weights total {formatWeight(totalWeight)}%. They should sum to 100%.
            </AlertDescription>
          </Alert>
        )}

        {/* Says where the missing weight went, so a course that adds up to 100
            without its bonus breakdowns doesn't look like it's short. */}
        {bonusWeight > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Bonus breakdowns add up to {formatWeight(bonusWeight)}% on top of the 100%.
          </p>
        )}

        {course.breakdowns.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <p className="mb-3 text-xs">No breakdowns yet. Add one to get started.</p>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Breakdown
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {course.breakdowns.map(breakdown => (
                <BreakdownCard
                  key={breakdown.id}
                  breakdown={breakdown}
                  onUpdate={updates => onUpdateBreakdown(breakdown.id, updates)}
                  onDelete={() => onDeleteBreakdown(breakdown.id)}
                  onAddSubBreakdown={() => onAddSubBreakdown(breakdown.id)}
                  onUpdateSubBreakdown={(subId, updates) =>
                    onUpdateSubBreakdown(breakdown.id, subId, updates)
                  }
                  onDeleteSubBreakdown={subId => onDeleteSubBreakdown(breakdown.id, subId)}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(true)}
              className="w-full border-dashed text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Breakdown
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
