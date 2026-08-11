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
  // Padding is separate from text size because the horizontal padding belongs to
  // whichever element carries the coloured background, and that isn't always
  // this one — see below.
  const sizes = {
    sm: { text: 'text-[11px]', px: 'px-1.5', py: 'py-0.5' },
    md: { text: 'text-xs', px: 'px-2', py: 'py-0.5' },
    lg: { text: 'text-base', px: 'px-2.5', py: 'py-1' },
  }[size];

  // A course is recorded with its rounded grade, so that's the number the
  // letter — and the colour that goes with it — has to follow. 79.6 is a
  // rounded 80, which is an A-, and it should not be coloured as a 79.
  const official = toOfficialGrade(grade);
  const banded = showLetterGrade ? official : grade;

  // With the official grade on show, the colour belongs to it and its letter
  // alone — text *and* tint. The exact percentage and the arrow are working
  // figures that explain where it came from; a wash behind them made the whole
  // pill read as one graded number.
  const showsOfficial = showLetterGrade && grade !== null;

  return (
    <span
      className={cn(
        'grade-display rounded-md inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors',
        sizes.text,
        sizes.py,
        showsOfficial ? 'text-foreground' : cn(sizes.px, getGradeColor(banded)),
        showBackground && !showsOfficial && getGradeBg(banded),
        className
      )}
    >
      {formatGrade(grade)}
      {showsOfficial && (
        <>
          <span className="text-muted-foreground">→</span>
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 font-semibold',
              getGradeColor(official),
              showBackground && getGradeBg(official)
            )}
          >
            {formatOfficialGrade(grade)} : {getLetterGrade(official)}
          </span>
        </>
      )}
    </span>
  );
}
