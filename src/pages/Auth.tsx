import { AboutDialog } from '@/components/AboutDialog';
import { AuthForm } from '@/components/AuthForm';
import { AuthLayout } from '@/components/AuthLayout';

/** The signed-out screen. The gate in `App` renders nothing else until there's a session. */
const Auth = () => (
  <>
    <AuthLayout
      subtitle="Sign in to keep your courses in your own account."
      title="Welcome"
      description="Your grades are saved to your account and visible only to you."
    >
      <AuthForm />
    </AuthLayout>
    {/* Here rather than in AuthLayout: the password-reset screen shares that
        layout, and someone mid-reset doesn't need an about box. */}
    <AboutDialog className="fixed bottom-4 left-4 rounded-full" />
  </>
);

export default Auth;
