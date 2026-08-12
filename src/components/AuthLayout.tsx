import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

interface AuthLayoutProps {
  /** Under the app name, above the card. */
  subtitle: string;
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * The centred card every signed-out screen sits in.
 *
 * Shared by the sign-in page and the password-reset page so the two can't drift
 * apart — they are the same screen to a student, one of them just arrived by
 * email.
 */
export function AuthLayout({ subtitle, title, description, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 rounded-xl bg-primary p-3 text-primary-foreground">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">UBC Grade Calculator</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <Card className="animate-scale-in">
          <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
