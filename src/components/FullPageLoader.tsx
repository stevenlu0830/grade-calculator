import { Loader2 } from 'lucide-react';

interface FullPageLoaderProps {
  label: string;
}

/** Whole-screen spinner, for the two waits that block the app: session, then data. */
export function FullPageLoader({ label }: FullPageLoaderProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
