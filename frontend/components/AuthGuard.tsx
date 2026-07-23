'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { api } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

// ─── Capture URL hash at module scope ─────────────────────────────────────────
// The Supabase JS SDK automatically parses and CLEARS the URL hash fragment
// (#access_token=...&type=invite) during its own initialization — before any
// React useEffect can read it. We capture it here, once, at module-load time,
// so we can inspect it later inside the auth state listener.
const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : '';

function parseHashType(hash: string): string | null {
	try {
		// Hash looks like: #access_token=...&type=invite&...
		const params = new URLSearchParams(hash.replace(/^#/, ''));
		return params.get('type');
	} catch {
		return null;
	}
}

type AuthStatus = 'loading' | 'approved' | 'pending' | 'rejected' | 'anon';

interface AuthContextType {
	role: 'admin' | 'member';
	status: string;
	email: string;
}

export const AuthContext = React.createContext<AuthContextType>({
	role: 'member',
	status: 'unknown',
	email: '',
});

export function useAuth() {
	return React.useContext(AuthContext);
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
	const rawPathname = usePathname() ?? '/';
	const pathname = rawPathname.replace(/\/+$/, '') || '/';
	const router = useRouter();
	const configured = isSupabaseConfigured();

	const [status, setStatus] = React.useState<AuthStatus>(configured ? 'loading' : 'approved');
	const [profile, setProfile] = React.useState<AuthContextType>({
		role: configured ? 'member' : 'admin',
		status: configured ? 'unknown' : 'approved',
		email: configured ? '' : 'dev@theculturehub.co.in',
	});

	const [passwordSet, setPasswordSet] = React.useState<boolean>(true);

	const checkAuthStatus = React.useCallback(async (session: any) => {
		if (!session) {
			setStatus('anon');
			return;
		}

		try {
			const info = await api.get<{ role: 'admin' | 'member'; status: string; email: string; passwordSet?: boolean }>('/auth/me');
			setProfile({
				role: info.role || 'member',
				status: info.status || 'unknown',
				email: session.user.email || info.email || '',
			});
			setPasswordSet(info.passwordSet ?? true);
			setStatus(info.status as AuthStatus);
		} catch (err) {
			console.error('AuthGuard status check failed', err);
			setStatus('anon');
		}
	}, []);

	React.useEffect(() => {
		if (!configured) return;
		const supabase = getSupabase();
		let active = true;

		supabase.auth.getSession().then(({ data }) => {
			if (active) {
				if (data.session) {
					const hashType = parseHashType(INITIAL_HASH);
					if (hashType === 'invite' || hashType === 'recovery') {
						router.replace('/set-password');
						return;
					}
					checkAuthStatus(data.session);
				} else {
					setStatus('anon');
				}
			}
		});

		const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
			if (!active) return;

			if (event === 'PASSWORD_RECOVERY') {
				router.replace('/set-password');
				return;
			}

			if (event === 'SIGNED_IN') {
				const hashType = parseHashType(INITIAL_HASH);
				if (hashType === 'invite' || hashType === 'recovery') {
					router.replace('/set-password');
					return;
				}
			}

			if (session) {
				checkAuthStatus(session);
			} else {
				setStatus('anon');
			}
		});

		return () => {
			active = false;
			sub.subscription.unsubscribe();
		};
	}, [configured, checkAuthStatus, router]);

	React.useEffect(() => {
		const isPublicRoute =
			pathname === '/login' ||
			pathname === '/signup' ||
			pathname === '/set-password' ||
			pathname === '/auth/callback';
		const isPendingRoute = pathname === '/pending';
		const isSetPasswordRoute = pathname === '/set-password';

		if (status === 'anon' && !isPublicRoute) {
			router.replace('/login');
		} else if ((status === 'pending' || status === 'rejected') && !isPendingRoute) {
			router.replace('/pending');
		} else if (status === 'approved' && !passwordSet && !isSetPasswordRoute) {
			router.replace('/set-password');
		} else if (status === 'approved' && passwordSet && (isPublicRoute || isPendingRoute)) {
			router.replace('/');
		}
	}, [status, passwordSet, pathname, router]);

	const isPublicRoute =
		pathname === '/login' ||
		pathname === '/set-password' ||
		pathname === '/auth/callback';
	const isPendingRoute = pathname === '/pending';

	if (isPublicRoute) {
		return <>{children}</>;
	}

	if (isPendingRoute) {
		return <>{children}</>;
	}

	if (status === 'loading') {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--n-bg)' }}>
				<span className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
					Checking session…
				</span>
			</div>
		);
	}

	if (status !== 'approved') {
		return (
			<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--n-bg)' }}>
				<span className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
					Redirecting to sign-in…
				</span>
			</div>
		);
	}

	return (
		<AuthContext.Provider value={profile}>
			<Sidebar>{children}</Sidebar>
		</AuthContext.Provider>
	);
}
