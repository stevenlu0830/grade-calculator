import { cn } from '@/lib/utils';

interface AppCreditsProps {
  className?: string;
}

/**
 * The independence disclaimer and the icon credit.
 *
 * The credit is a licence condition, not a courtesy: Flaticon's free icons
 * require a visible attribution, so it has to be somewhere a student can read
 * it — the sign-in screen for everyone, and the account menu for anyone whose
 * session skips that screen. One component so the two can't drift apart.
 */
export function AppCredits({ className }: AppCreditsProps) {
  return (
    <div className={cn('space-y-1 text-xs text-muted-foreground', className)}>
      <p>Not affiliated with or endorsed by the University of British Columbia.</p>
      <p>
        App icon:{' '}
        <a
          href="https://www.flaticon.com/free-icons/exam"
          title="exam icons"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Exam icons created by Awicon - Flaticon
        </a>
      </p>
    </div>
  );
}
