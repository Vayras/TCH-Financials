'use client';

import SignupForm from '@/components/auth/SignupForm';
import { CREATOR_SIGN_IN } from '@/lib/auth-routes';

export default function CreatorSignupPage() {
  return (
    <SignupForm
      fixedRole="creator"
      brandName="CreatorLedger"
      tagline="Request access to the creator portal"
      signInHref={CREATOR_SIGN_IN}
    />
  );
}
