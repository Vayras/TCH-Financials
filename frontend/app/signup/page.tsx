'use client';

import SignupForm from '@/components/auth/SignupForm';
import { CREATOR_SIGN_UP, TEAM_SIGN_IN } from '@/lib/auth-routes';

export default function SignupPage() {
  return (
    <SignupForm
      fixedRole="tch_member"
      brandName="TCH Financials"
      tagline="Request access to your workspace"
      signInHref={TEAM_SIGN_IN}
      altLink={{
        prompt: 'Are you a creator?',
        label: 'Request creator access',
        href: CREATOR_SIGN_UP,
      }}
    />
  );
}
