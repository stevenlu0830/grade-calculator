import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Github, Globe, Info, Linkedin, Mail, type LucideIcon } from 'lucide-react';

interface Contact {
  label: string;
  icon: LucideIcon;
  text: string;
  /** `null` renders `text` without a link, so an unfilled entry is never a dead one. */
  href: string | null;
}

// Fill these in: set `text` to what should be shown and `href` to where it goes
// (a `mailto:` address for the email).
const CONTACTS: Contact[] = [
  { label: 'GitHub', icon: Github, text: 'https://github.com/stevenlu0830', href: 'https://github.com/stevenlu0830' },
  { label: 'LinkedIn', icon: Linkedin, text: 'https://www.linkedin.com/in/stevenlu0830/', href: 'https://www.linkedin.com/in/stevenlu0830/' },
  { label: 'Email', icon: Mail, text: 'mailto:stevenlu0830@gmail.com', href: 'mailto:stevenlu0830@gmail.com' },
  { label: 'Personal Profile', icon: Globe, text: 'https://stevenlu0830.github.io/', href: 'https://stevenlu0830.github.io/' },
];

// No version numbers: they'd go stale with every upgrade, and package.json has them.
const TECH_STACK = [
  'React',
  'TypeScript',
  'Vite',
  'Tailwind CSS',
  'shadcn/ui',
  'Supabase',
  'Vitest',
  'Vercel',
];

interface AboutDialogProps {
  /** Positions the trigger. The dialog itself always opens centred. */
  className?: string;
  /** Defaults to `CONTACTS`. A prop so a test can cover both a linked and an unlinked entry. */
  contacts?: Contact[];
}

/**
 * An info button that opens a short "about": what the app is, what it's built
 * with, and how to reach its author.
 *
 * Owns its trigger so a page can drop it in with nothing but a position — Radix
 * holds the open state, so there's none to lift.
 */
export function AboutDialog({ className, contacts = CONTACTS }: AboutDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="About this app"
          className={className}
        >
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      {/* Inset from the edges on a phone too, so it reads as a small window
          rather than a sheet. */}
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-lg">
        <DialogHeader>
          <DialogTitle>About UBC Grade Calculator</DialogTitle>
          <DialogDescription>
            Work out your course grades as you enter each mark — weighted breakdowns, grading
            policies like drop-lowest, and a final letter grade on UBC’s scale. Your courses are
            saved to your own account, so they follow you to any device.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Tech stack</h3>
          <ul className="flex flex-wrap gap-1.5">
            {TECH_STACK.map(tech => (
              <li key={tech}>
                <Badge variant="secondary" className="font-normal">
                  {tech}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Contact</h3>
          <ul className="space-y-2 text-sm">
            {contacts.map(({ label, icon: Icon, text, href }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
                {href === null ? (
                  <span className="truncate text-foreground">{text}</span>
                ) : (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-primary underline-offset-2 hover:underline"
                  >
                    {text}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
