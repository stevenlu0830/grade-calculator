import { cn } from '@/lib/utils';
import { formatGrade, getGradeColor, getGradeBg } from '@/lib/gradeCalculations';

interface GradeDisplayProps {
  grade: number | null;
  size?: 'sm' | 'md' | 'lg';
  showBackground?: boolean;
  className?: string;
}

export function GradeDisplay({
  grade,
  size = 'md',
  showBackground = true,
  className,
}: GradeDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm px-2 py-0.5',
    md: 'text-base px-3 py-1',
    lg: 'text-2xl px-4 py-2',
  };

  return (
    <span
      className={cn(
        'grade-display rounded-md inline-flex items-center justify-center transition-colors',
        sizeClasses[size],
        getGradeColor(grade),
        showBackground && getGradeBg(grade),
        className
      )}
    >
      {formatGrade(grade)}
    </span>
  );
}
