'use client';

import SignupForm from '@/components/auth/SignupForm';
import { TEAM_SIGN_IN } from '@/lib/auth-routes';

export default function SignupPage() {
  return (
    <SignupForm
      fixedRole="tch_member"
      brandName="TCH Financials"
      tagline="Request access to your workspace"
      signInHref={TEAM_SIGN_IN}
    />
  );
}
