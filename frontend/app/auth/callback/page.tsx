'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

// This page is the dedicated landing target for all Supabase auth emails:
//   - Invite links       → type=invite  → redirect to /set-password
//   - Password recovery  → type=recovery → redirect to /set-password
//   - Email confirmation → type=signup   → redirect to / (AuthGuard routes from there)
//
// The Supabase SDK fires onAuthStateChange here after parsing the URL hash,
// which is more reliable than capturing the hash at module scope in AuthGuard.

export default function AuthCallbackPage() {
	const router = useRouter();

	React.useEffect(() => {
		// Capture the hash NOW — before the SDK clears it
		const hash = window.location.hash;
		const params = new URLSearchParams(hash.replace(/^#/, ''));
		const type = params.get('type'); // 'invite' | 'recovery' | 'signup' | null

		const supabase = getSupabase();

		// onAuthStateChange fires as soon as the SDK processes the hash tokens
		const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'PASSWORD_RECOVERY') {
				// Explicit recovery event — always go to set-password
				router.replace('/set-password');
				return;
			}

			if (session) {
				if (type === 'invite' || type === 'recovery') {
					router.replace('/set-password');
				} else {
					// signup confirmation or unknown — let AuthGuard decide routing
					router.replace('/');
				}
			} else {
				router.replace('/login');
			}
		});

		// Fallback: if the session is already established before the listener fires
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session) {
				if (type === 'invite' || type === 'recovery') {
					router.replace('/set-password');
				} else {
					router.replace('/');
				}
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [router]);

	return (
		<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--n-bg)' }}>
			<span className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
				Completing sign in…
			</span>
		</div>
	);
}
