import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

/**
 * Shown instead of the app when the Supabase environment variables are missing.
 *
 * Without a client there is no sign-in and no storage, so the honest thing is to
 * say which step was skipped rather than render a login form that can only fail.
 */
export function SupabaseSetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg animate-fade-in">
        <CardHeader>
          <div className="mb-2 w-fit rounded-xl bg-muted p-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg">Supabase isn’t configured yet</CardTitle>
          <CardDescription>
            Accounts and saved grades both live in Supabase, so the app needs a project to point at.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Create a project at <span className="font-medium text-foreground">supabase.com</span>.
            </li>
            <li>
              Run <span className="font-mono text-foreground">supabase/migrations/0001_user_data.sql</span>{' '}
              in the dashboard’s SQL Editor.
            </li>
            <li>
              Copy <span className="font-mono text-foreground">.env.example</span> to{' '}
              <span className="font-mono text-foreground">.env.local</span> and fill in the project
              URL and anon key from Project Settings → API.
            </li>
            <li>Restart the dev server — Vite only reads env files at startup.</li>
          </ol>
          <p className="rounded-lg bg-muted p-3 text-xs">
            The anon key is meant to be public. Row-level security on the{' '}
            <span className="font-mono">user_data</span> table is what keeps one account’s grades
            away from another’s.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
