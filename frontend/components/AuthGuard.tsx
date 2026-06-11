'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

type AuthStatus = 'loading' | 'authed' | 'anon';

/** Gates the whole app behind a Supabase session. The /login route renders
 * bare (no sidebar chrome); everything else waits for the session check and
 * bounces to /login when there is none. With Supabase unconfigured the app
 * runs open, matching the backend's behaviour. */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
	// trailingSlash: true (next.config.ts) means routes arrive as '/login/' —
	// normalize before comparing or the login page treats itself as protected
	// and loops on the redirect screen.
	const rawPathname = usePathname() ?? '/';
	const pathname = rawPathname.replace(/\/+$/, '') || '/';
	const router = useRouter();
	const configured = isSupabaseConfigured();
	const [status, setStatus] = React.useState<AuthStatus>(configured ? 'loading' : 'authed');

	React.useEffect(() => {
		if (!configured) return;
		const supabase = getSupabase();
		let active = true;
		supabase.auth.getSession().then(({ data }) => {
			if (active) setStatus(data.session ? 'authed' : 'anon');
		});
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			setStatus(session ? 'authed' : 'anon');
		});
		return () => {
			active = false;
			sub.subscription.unsubscribe();
		};
	}, [configured]);

	React.useEffect(() => {
		if (status === 'anon' && pathname !== '/login') router.replace('/login');
		if (status === 'authed' && pathname === '/login' && configured) router.replace('/');
	}, [status, pathname, router, configured]);

	if (pathname === '/login') return <>{children}</>;

	if (status !== 'authed') {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--n-bg)' }}>
				<span className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
					{status === 'loading' ? 'Checking session…' : 'Redirecting to sign-in…'}
				</span>
			</div>
		);
	}

	return <Sidebar>{children}</Sidebar>;
}
