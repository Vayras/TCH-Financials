'use client';

import SignInForm, { type SignInContent } from '@/components/auth/SignInForm';
import { CREATOR_SIGN_UP } from '@/lib/auth-routes';

const CREATOR: SignInContent = {
  tone: 'creator',
  brand: { name: 'CreatorLedger', logoSrc: '/creatorledger-mark.svg' },
  subtitle: 'Sign in to your creator portal.',
  signupHref: CREATOR_SIGN_UP,
  panel: {
    eyebrow: 'For creators',
    title: 'Your brand kit, campaigns and earnings in one place.',
    features: [
      { icon: 'star', text: 'Build and share your brand kit' },
      { icon: 'briefcase', text: 'Get campaign briefs and share concepts' },
      { icon: 'circle-dollar-sign', text: 'Track invoices and payments' },
    ],
  },
};

export default function CreatorLoginPage() {
  return <SignInForm content={CREATOR} />;
}
