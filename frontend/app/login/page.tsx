'use client';

import SignInForm, { type SignInContent } from '@/components/auth/SignInForm';
import { CREATOR_SIGN_IN } from '@/lib/auth-routes';

const TEAM: SignInContent = {
  brand: { name: 'TCH Financials' },
  subtitle: 'Sign in to your TCH workspace.',
  signupHref: '/signup',
  altLink: {
    prompt: 'Are you a creator?',
    label: 'Sign in to the creator portal',
    href: CREATOR_SIGN_IN,
  },
  panel: {
    eyebrow: 'The Creative Hook',
    title: 'Campaigns, deals and creator payouts, all in one place.',
    features: [
      { icon: 'briefcase', text: 'Track every brand deal and campaign' },
      { icon: 'pie', text: 'See agency fees and payouts at a glance' },
      { icon: 'users', text: 'Work alongside creators in their portal' },
    ],
  },
};

export default function LoginPage() {
  return <SignInForm content={TEAM} />;
}
