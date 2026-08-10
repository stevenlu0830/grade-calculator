import { cn } from '@/lib/utils';
import {
  formatGrade,
  formatOfficialGrade,
  getGradeBg,
  getGradeColor,
  getLetterGrade,
  toOfficialGrade,
} from '@/lib/gradeFormatting';

interface GradeDisplayProps {
  grade: number | null;
  size?: 'sm' | 'md' | 'lg';
  showBackground?: boolean;
  /**
   * Show the official grade too: the exact percentage, the whole number it
   * rounds to, and the letter that whole number earns.
   */
  showLetterGrade?: boolean;
  className?: string;
}

export function GradeDisplay({
  grade,
  size = 'md',
  showBackground = true,
  showLetterGrade = false,
  className,
}: GradeDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm px-2 py-0.5',
    md: 'text-base px-3 py-1',
    lg: 'text-2xl px-4 py-2',
  };

  // A course is recorded with its rounded grade, so that's the number the
  // letter — and the colour that goes with it — has to follow. 79.6 is a
  // rounded 80, which is an A-, and it should not be coloured as a 79.
  const official = toOfficialGrade(grade);
  const banded = showLetterGrade ? official : grade;

  return (
    <span
      className={cn(
        'grade-display rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors',
        sizeClasses[size],
        getGradeColor(banded),
        showBackground && getGradeBg(banded),
        className
      )}
    >
      {formatGrade(grade)}
      {showLetterGrade && grade !== null && (
        <span className="font-semibold">
          → {formatOfficialGrade(grade)} : {getLetterGrade(official)}
        </span>
      )}
    </span>
  );
}
