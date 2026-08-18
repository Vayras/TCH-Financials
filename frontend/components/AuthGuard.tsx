'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { api } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import type { Session } from '@supabase/supabase-js';
import DevAccountSwitcher from '@/components/DevAccountSwitcher';

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

type AppRole = 'super_admin' | 'accounts' | 'tch_member' | 'creator';

interface AuthContextType {
	role: AppRole;
	status: string;
	email: string;
	displayName: string;
	creatorId: string | null;
}

export const AuthContext = React.createContext<AuthContextType>({
	role: 'tch_member',
	status: 'unknown',
	email: '',
	displayName: '',
	creatorId: null,
});

export function useAuth() {
	return React.useContext(AuthContext);
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
	const rawPathname = usePathname() ?? '/';
	const pathname = rawPathname.replace(/\/+$/, '') || '/';
	const router = useRouter();
	const configured = isSupabaseConfigured();

	const [status, setStatus] = React.useState<AuthStatus>('loading');
	const [profile, setProfile] = React.useState<AuthContextType>({
		role: configured ? 'tch_member' : 'super_admin',
		status: configured ? 'unknown' : 'approved',
		email: configured ? '' : 'dev@theculturehub.co.in',
		displayName: configured ? '' : 'Dev Admin',
		creatorId: null,
	});

	const [passwordSet, setPasswordSet] = React.useState<boolean>(true);

	const checkAuthStatus = React.useCallback(async (session: Session | null) => {
		if (!session) {
			setStatus('anon');
			return;
		}

		try {
			const info = await api.get<{ role: AppRole; status: string; email: string; passwordSet?: boolean; displayName?: string; creatorId?: string | null }>('/auth/me');
			setProfile({
				role: info.role || 'tch_member',
				status: info.status || 'unknown',
				email: session.user.email || info.email || '',
				displayName: info.displayName || '',
				creatorId: info.creatorId ?? null,
			});
			setPasswordSet(info.passwordSet ?? true);
			setStatus(info.status as AuthStatus);
		} catch (err) {
			console.error('AuthGuard status check failed', err);
			setStatus('anon');
		}
	}, []);

	React.useEffect(() => {
		if (!configured) {
			let active = true;
			api.get<{ role: AppRole; status: string; email: string; displayName?: string; creatorId?: string | null }>('/auth/me')
				.then((info) => {
					if (!active) return;
					setProfile({
						role: info.role,
						status: info.status,
						email: info.email,
						displayName: info.displayName || '',
						creatorId: info.creatorId ?? null,
					});
					setStatus(info.status as AuthStatus);
				})
				.catch(() => setStatus('anon'));
			return () => { active = false; };
		}
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
		} else if (status === 'approved' && passwordSet) {
			const isCreatorRoute = pathname.startsWith('/creator-portal');
			const isUserCreator = profile.role === 'creator';
			const isUserAccounts = profile.role === 'accounts';

			if (isUserCreator && !isCreatorRoute) {
				router.replace('/creator-portal');
			} else if (!isUserCreator && isCreatorRoute) {
				router.replace('/');
			} else if (isUserAccounts && (pathname === '/' || pathname === '/commercial' || pathname === '/users' || pathname === '/employees' || pathname === '/alerts')) {
				router.replace('/accounts-dashboard');
			} else if (isPublicRoute || isPendingRoute) {
				if (isUserCreator) {
					router.replace('/creator-portal');
				} else if (isUserAccounts) {
					router.replace('/accounts-dashboard');
				} else {
					router.replace('/');
				}
			}
		}
	}, [status, passwordSet, pathname, router, profile.role]);

	const isPublicRoute =
		pathname === '/login' ||
		pathname === '/signup' ||
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
			{pathname.startsWith('/creator-portal') ? children : <Sidebar>{children}</Sidebar>}
			{!configured && <DevAccountSwitcher currentEmail={profile.email} />}
		</AuthContext.Provider>
	);
}
