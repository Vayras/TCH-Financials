'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { api } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import type { Session } from '@supabase/supabase-js';
import DevAccountSwitcher from '@/components/DevAccountSwitcher';
import { useQueryClient } from '@tanstack/react-query';
import { isPublicAuthRoute, signInPathFor } from '@/lib/auth-routes';

const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : '';

function parseHashType(hash: string): string | null {
  try {
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

// Re-reads /auth/me, bypassing the cache. Pages that change the user's
// profile (password setup, approval) call this so the guard doesn't act on
// a stale copy. Provided on every route, including public ones.
const RefreshAuthContext = React.createContext<() => Promise<void>>(async () => {});

export function useRefreshAuth() {
  return React.useContext(RefreshAuthContext);
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  if (pathname.startsWith('/k/')) return <>{children}</>;
  return <AuthenticatedGuard>{children}</AuthenticatedGuard>;
}

function AuthenticatedGuard({ children }: { children: React.ReactNode }) {
  const rawPathname = usePathname() ?? '/';
  const pathname = rawPathname.replace(/\/+$/, '') || '/';
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const queryClient = useQueryClient();
  const authUserId = React.useRef<string | null>(null);

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
    const nextUserId = session?.user.id ?? null;
    if (authUserId.current !== nextUserId) {
      authUserId.current = nextUserId;
      queryClient.clear();
      setStatus(nextUserId ? 'loading' : 'anon');
    }
    if (!session) {
      setStatus('anon');
      return;
    }

    try {
      const info = await queryClient.fetchQuery({
        queryKey: ['auth', 'me'],
        queryFn: () =>
          api.get<{
            role: AppRole;
            status: string;
            email: string;
            passwordSet?: boolean;
            displayName?: string;
            creatorId?: string | null;
          }>('/auth/me'),
        staleTime: 5 * 60 * 1000,
      });
      if (authUserId.current !== session.user.id) return;
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
      if (authUserId.current !== session.user.id) return;
      console.error('AuthGuard status check failed', err);
      setStatus('anon');
    }
  }, [queryClient]);

  const refreshAuth = React.useCallback(async () => {
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
    if (!configured) return;
    const { data } = await getSupabase().auth.getSession();
    await checkAuthStatus(data.session);
  }, [configured, queryClient, checkAuthStatus]);

  React.useEffect(() => {
    if (!configured) {
      let active = true;
      queryClient
        .fetchQuery({
          queryKey: ['auth', 'me'],
          queryFn: () =>
            api.get<{
              role: AppRole;
              status: string;
              email: string;
              displayName?: string;
              creatorId?: string | null;
            }>('/auth/me'),
          staleTime: 5 * 60 * 1000,
        })
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
      return () => {
        active = false;
      };
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

      if (event === 'USER_UPDATED') {
        // The user's own record changed; never answer from the cached profile.
        queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      }

      if (session) {
        checkAuthStatus(session);
      } else {
        checkAuthStatus(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [configured, checkAuthStatus, router, queryClient]);

  React.useEffect(() => {
    const isPublicRoute = isPublicAuthRoute(pathname);
    const isPendingRoute = pathname === '/pending';
    const isSetPasswordRoute = pathname === '/set-password';

    if (status === 'anon' && !isPublicRoute) {
      router.replace(signInPathFor(pathname));
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
      } else if (
        isUserAccounts &&
        (pathname === '/' ||
          pathname === '/commercial' ||
          pathname === '/users' ||
          pathname === '/employees' ||
          pathname === '/alerts')
      ) {
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

  const isPublicRoute = isPublicAuthRoute(pathname);
  const isPendingRoute = pathname === '/pending';

  let content: React.ReactNode;
  if (isPublicRoute || isPendingRoute) {
    content = children;
  } else if (status === 'loading') {
    content = (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--n-bg)' }}
      >
        <span className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
          Checking session…
        </span>
      </div>
    );
  } else if (status !== 'approved') {
    content = (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--n-bg)' }}
      >
        <span className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
          Redirecting to sign-in…
        </span>
      </div>
    );
  } else {
    content = (
      <AuthContext.Provider value={profile}>
        {pathname.startsWith('/creator-portal') ? children : <Sidebar>{children}</Sidebar>}
        {!configured && <DevAccountSwitcher currentEmail={profile.email} />}
      </AuthContext.Provider>
    );
  }

  return <RefreshAuthContext.Provider value={refreshAuth}>{content}</RefreshAuthContext.Provider>;
}
