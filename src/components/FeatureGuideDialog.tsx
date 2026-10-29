import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowDownWideNarrow,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Equal,
  Gift,
  GraduationCap,
  Info,
  Layers,
  ListPlus,
  LogOut,
  PencilLine,
  Save,
  Scale,
  Trash2,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react';

interface GuidePage {
  icon: LucideIcon;
  title: string;
  /** Paragraphs. `<strong>` marks a button's name, styled by the dialog. */
  body: ReactNode;
}

// The introduction, then one page per feature, in the order a new student meets
// them. This is the README's "Features" section in brief: when a feature
// changes, update both.
const PAGES: GuidePage[] = [
  {
    icon: GraduationCap,
    title: 'Welcome to UBC Grade Calculator',
    body: (
      <p>
        Track every course the way your syllabus describes it: weighted breakdowns like
        “Assignments 30%”, each holding the items you’re graded on. Enter marks as you get them,
        and your breakdown grades, final percentage and letter grade update as you type.
        Everything saves to your account automatically, so your courses follow you to any device.
      </p>
    ),
  },
  {
    icon: CalendarDays,
    title: 'Semesters',
    body: (
      <p>
        Courses are grouped by semester, so add one first: press <strong>Add Semester</strong> at
        the top of the left panel and pick a year and term. Click any semester to see its courses —
        the number beside it is how many it holds.
      </p>
    ),
  },
  {
    icon: BookOpen,
    title: 'Courses',
    body: (
      <p>
        With a semester selected, press <strong>New Course</strong> in the header and type its
        name, like CPSC 121. Click a course’s name at the top of its card to rename it — edits are
        kept as you type, with no save button needed.
      </p>
    ),
  },
  {
    icon: Layers,
    title: 'Breakdowns',
    body: (
      <p>
        A breakdown is one weighted line of your syllabus, like “Final Exam 45%”. Press{' '}
        <strong>Add Breakdown</strong> on a course card, pick its type and enter its weighting. The
        weights must total 100% before a final grade appears; until then, the card shows what they
        add up to.
      </p>
    ),
  },
  {
    icon: PencilLine,
    title: 'Entering marks',
    body: (
      <p>
        Each row is one graded item: type what you scored on the left and what it was out of on the
        right. Leave a row blank until it’s marked — blanks are skipped, not counted as zero — and
        type 0 only for a real zero. Bonus marks like 22 / 20 are kept as typed.
      </p>
    ),
  },
  {
    icon: ListPlus,
    title: 'Adding items',
    body: (
      <p>
        Press <strong>Add Sub-breakdown</strong> under a breakdown to add another row. New rows are
        numbered for you — Assignment 1, Assignment 2 — and you can click a row’s name to rename it.
      </p>
    ),
  },
  {
    icon: Scale,
    title: 'Changing a full mark',
    body: (
      <p>
        If an item is re-marked out of a different total, press the <strong>scales</strong> button
        (⚖) on its row instead of typing over the “out of” box. Your mark is rescaled so its
        percentage stays the same: 8 / 10 becomes 24 / 30.
      </p>
    ),
  },
  {
    icon: Calculator,
    title: 'Reading your grades',
    body: (
      <p>
        Each breakdown shows its weight, its own grade, and <strong>W:</strong> — what it
        contributes to your final grade. At the top of each course,{' '}
        <strong>78.80 → 79 : B+</strong> is your exact percentage, the whole number it would be
        recorded as, and that grade’s letter.
      </p>
    ),
  },
  {
    icon: TrendingDown,
    title: 'Drop lowest',
    body: (
      <p>
        For rules like “your lowest two quizzes don’t count”: press <strong>Advanced</strong> on
        the breakdown, switch on <strong>Drop Lowest</strong> and enter how many. Your
        worst-scoring items are left out entirely — a dropped 0 / 20 takes its 20 marks out of the
        total too.
      </p>
    ),
  },
  {
    icon: ArrowDownWideNarrow,
    title: 'Downweight',
    body: (
      <p>
        For rules like “your worst lab counts for half”: in <strong>Advanced</strong>, switch on{' '}
        <strong>Downweight</strong> and enter how many items and by how much. Those items count for
        less — a 4 / 10 downweighted by 50% counts as 2 / 5. It’s an alternative to Drop Lowest, so
        only one can be on.
      </p>
    ),
  },
  {
    icon: Equal,
    title: 'Equal weight',
    body: (
      <p>
        Normally a bigger item counts for more, so 18 / 20 outweighs 4 / 5. If your syllabus says
        every item is worth the same, switch on <strong>Equal Weight</strong> in{' '}
        <strong>Advanced</strong>: each item then counts as its own percentage, and the breakdown
        grade is their plain average.
      </p>
    ),
  },
  {
    icon: BadgeCheck,
    title: 'Full credit',
    body: (
      <p>
        For rules like “80% on iClickers earns full marks”: switch on{' '}
        <strong>Full Credit</strong> in <strong>Advanced</strong> and enter the threshold. The
        breakdown is scaled so that threshold reads as 100% — with 80, a raw 60% becomes 75%.
      </p>
    ),
  },
  {
    icon: Gift,
    title: 'Bonus grade',
    body: (
      <p>
        Mark an extra-credit breakdown as <strong>Bonus Grade</strong> in{' '}
        <strong>Advanced</strong>. Its weight is added on top of the course instead of counting
        inside the 100%, so a bonus you ace can push your final grade above 100.
      </p>
    ),
  },
  {
    icon: ChevronDown,
    title: 'Collapsing breakdowns',
    body: (
      <p>
        Press the <strong>chevron</strong> (⌄) beside a breakdown’s name to fold its rows away. Its
        header — weight, grade and contribution — stays visible, so you can tuck away finished
        breakdowns and keep a long course tidy.
      </p>
    ),
  },
  {
    icon: Trash2,
    title: 'Deleting',
    body: (
      <p>
        Every <strong>trash</strong> button asks before it deletes, and says what goes with it — a
        semester takes all of its courses, a course takes its breakdowns. There’s no undo, so read
        the confirmation.
      </p>
    ),
  },
  {
    icon: Save,
    title: 'Save and reload progress',
    body: (
      <p>
        Your grades save automatically as you type. <strong>Save Progress</strong> also keeps a
        separate checkpoint in your account, and <strong>Reload Progress</strong> brings it back —
        handy after trying out “what if I bomb the final”. Reloading replaces what’s on screen
        rather than merging.
      </p>
    ),
  },
  {
    icon: LogOut,
    title: 'Your account',
    body: (
      <p>
        Press the <strong>person</strong> button at the top right to see which account you’re
        signed in as, and to sign out. Your courses stay in your account, ready on any device you
        sign in on.
      </p>
    ),
  },
];

interface FeatureGuideDialogProps {
  /** Positions the trigger. The dialog itself always opens centred. */
  className?: string;
}

/**
 * An info button that opens a paged guide: an introduction, then one page per
 * feature, with Back / Next and a dot per page to jump with.
 *
 * Owns its trigger, like `AboutDialog`, so a page drops it in with nothing but
 * a position. The page number is local UI state and resets on every opening.
 */
export function FeatureGuideDialog({ className }: FeatureGuideDialogProps) {
  const [page, setPage] = useState(0);

  // Every opening starts at the introduction, wherever the last one was left.
  const handleOpenChange = (open: boolean) => {
    if (open) setPage(0);
  };

  const { icon: Icon, title, body } = PAGES[page];
  const isFirst = page === 0;
  const isLast = page === PAGES.length - 1;

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="App guide" className={className}>
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md grid-cols-[minmax(0,1fr)] rounded-lg">
        {/* A minimum height that fits the longest page (the introduction:
            ~287px on a phone, ~241px from `sm` up), so every page is the same
            height and Back / Next stay under the pointer while clicking through.
            Raise it if a page grows. */}
        <DialogHeader className="min-h-[18.5rem] space-y-3 sm:min-h-[15.5rem]">
          <div className="mx-auto w-fit rounded-xl bg-primary p-2.5 text-primary-foreground sm:mx-0">
            <Icon className="h-5 w-5" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription
            asChild
            className="leading-relaxed [&_strong]:font-medium [&_strong]:text-foreground"
          >
            <div>{body}</div>
          </DialogDescription>
        </DialogHeader>

        <nav aria-label="Guide pages" className="flex flex-wrap justify-center">
          {PAGES.map((guidePage, index) => (
            // The padding is the hit area; the dot inside is only 6px.
            <button
              key={guidePage.title}
              type="button"
              onClick={() => setPage(index)}
              aria-label={`Page ${index + 1}: ${guidePage.title}`}
              aria-current={index === page ? 'step' : undefined}
              className="group p-1"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-all',
                  index === page ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30 group-hover:bg-muted-foreground/60'
                )}
              />
            </button>
          ))}
        </nav>

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={() => setPage(page - 1)} disabled={isFirst}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page + 1} / {PAGES.length}
          </span>
          {isLast ? (
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          ) : (
            <Button onClick={() => setPage(page + 1)}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
