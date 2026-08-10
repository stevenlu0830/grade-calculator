import { useState } from 'react';
import { Breakdown, Course, SubBreakdown } from '@/types/grades';
import { BreakdownCard } from './BreakdownCard';
import { GradeDisplay } from './GradeDisplay';
import { AddBreakdownDialog } from './AddBreakdownDialog';
import {
  areWeightsValid,
  calculateCourseGrade,
  getBonusWeight,
  getTotalWeight,
} from '@/lib/gradeCalculations';
import { formatWeight } from '@/lib/gradeFormatting';
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
  const totalWeight = getTotalWeight(course.breakdowns);
  const bonusWeight = getBonusWeight(course.breakdowns);
  const weightsAreValid = areWeightsValid(course.breakdowns);
  const courseGrade = weightsAreValid ? calculateCourseGrade(course.breakdowns) : null;
  const showWeightWarning = course.breakdowns.length > 0 && !weightsAreValid;

  return (
    <Card className="border-border shadow-md overflow-hidden animate-fade-in">
      <AddBreakdownDialog open={addOpen} onOpenChange={setAddOpen} onAdd={onAddBreakdown} />

      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <Input
              value={course.name}
              onChange={e => onUpdateName(e.target.value)}
              className="flex-1 h-10 text-lg font-semibold border-transparent hover:border-border focus:border-border bg-transparent"
              placeholder="Course name"
            />
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Final Grade
              </div>
              {weightsAreValid ? (
                <GradeDisplay grade={courseGrade} size="lg" showLetterGrade />
              ) : (
                <span className="text-2xl text-muted-foreground">—</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {showWeightWarning && (
          <Alert variant="destructive" className="bg-warning/10 border-warning">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm text-foreground">
              Breakdown weights total {formatWeight(totalWeight)}%. They should sum to 100%.
            </AlertDescription>
          </Alert>
        )}

        {/* Says where the missing weight went, so a course that adds up to 100
            without its bonus breakdowns doesn't look like it's short. */}
        {bonusWeight > 0 && (
          <p className="text-xs text-muted-foreground">
            Bonus breakdowns add up to {formatWeight(bonusWeight)}% on top of the 100%.
          </p>
        )}

        {course.breakdowns.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p className="mb-4">No breakdowns yet. Add one to get started.</p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Breakdown
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
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
              onClick={() => setAddOpen(true)}
              className="w-full border-dashed"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Breakdown
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
