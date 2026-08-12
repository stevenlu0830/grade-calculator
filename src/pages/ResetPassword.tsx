import { AuthLayout } from '@/components/AuthLayout';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

interface ResetPasswordProps {
  onDone: () => void;
}

/** Where a click on a password-reset email lands. */
const ResetPassword = ({ onDone }: ResetPasswordProps) => (
  <AuthLayout
    subtitle="Choose a new password for your account."
    title="Set a new password"
    description="You’ll be signed in as soon as it’s saved."
  >
    <ResetPasswordForm onDone={onDone} />
  </AuthLayout>
);

export default ResetPassword;
