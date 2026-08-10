import { AuthForm } from '@/components/AuthForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

/** The signed-out screen. The gate in `App` renders nothing else until there's a session. */
const Auth = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
    <div className="w-full max-w-sm animate-fade-in">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 rounded-xl bg-primary p-3 text-primary-foreground">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">UBC Grade Calculator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to keep your courses in your own account.
        </p>
      </div>

      <Card className="animate-scale-in">
        <CardHeader>
          <CardTitle className="text-lg">Welcome</CardTitle>
          <CardDescription>
            Your grades are saved to your account and visible only to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm />
        </CardContent>
      </Card>
    </div>
  </div>
);

export default Auth;
