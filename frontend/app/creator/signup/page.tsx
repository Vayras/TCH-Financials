'use client';

import SignupForm from '@/components/auth/SignupForm';
import { CREATOR_SIGN_IN, TEAM_SIGN_UP } from '@/lib/auth-routes';

export default function CreatorSignupPage() {
  return (
    <SignupForm
      fixedRole="creator"
      brandName="CreatorLedger"
      tagline="Request access to the creator portal"
      signInHref={CREATOR_SIGN_IN}
      altLink={{
        prompt: 'Joining the TCH team?',
        label: 'Request team access',
        href: TEAM_SIGN_UP,
      }}
    />
  );
}
