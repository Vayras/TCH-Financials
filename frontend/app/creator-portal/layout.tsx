'use client';
import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthGuard';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import Icon from '@/components/ui/Icon';

const base = '/creator-portal';
const navigation = [
	{ label: 'Home', href: base, icon: 'home', paths: [base] },
	{ label: 'Campaigns', href: `${base}/campaigns`, icon: 'briefcase', paths: [`${base}/campaigns`] },
	{ label: 'Content library', href: `${base}/portfolio`, icon: 'images', paths: [`${base}/portfolio`] },
	{ label: 'Brand kit', href: `${base}/media-kit`, icon: 'star', paths: [`${base}/media-kit`] },
	{ label: 'Work', href: `${base}/deals`, icon: 'layers', paths: [`${base}/deals`, `${base}/enquiries`] },
	{ label: 'Earnings', href: `${base}/invoices`, icon: 'circle-dollar-sign', paths: [`${base}/invoices`, `${base}/payments`] },
];
const secondary = [
	{ label: 'Active work', href: `${base}/deals`, parent: 'Work' },
	{ label: 'Brand opportunities', href: `${base}/enquiries`, parent: 'Work' },
	{ label: 'Invoices', href: `${base}/invoices`, parent: 'Earnings' },
	{ label: 'Payments & tax', href: `${base}/payments`, parent: 'Earnings' },
];

type CreatorNotification = { id: string; type: string; title: string; detail: string; href: string; occurred_at: string; unread: boolean };
type NotificationPayload = { items: CreatorNotification[]; unread_count: number; as_of: string };
const notificationKey = (identity: string) => ['creator-notifications', identity] as const;

function NotificationInbox({ identity, onNavigate }: { identity: string; onNavigate: () => void }) {
	const [open, setOpen] = React.useState(false);
	const root = React.useRef<HTMLDivElement>(null);
	const client = useQueryClient();
	const key = notificationKey(identity);
	const query = useQuery({
		queryKey: key,
		queryFn: () => api.get<NotificationPayload>('/creator-portal/campaign-briefs/notifications'),
		enabled: Boolean(identity),
		refetchInterval: 60_000,
		refetchIntervalInBackground: false,
	});
	const markRead = useMutation({
		mutationFn: (through: string) => api.post('/creator-portal/campaign-briefs/notifications/read', { through }),
		onSuccess: () => client.invalidateQueries({ queryKey: key }),
	});
	React.useEffect(() => {
		if (!open) return;
		const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
		const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
		document.addEventListener('mousedown', close);
		document.addEventListener('keydown', escape);
		return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
	}, [open]);
	function readThrough() {
		if (query.data?.as_of) markRead.mutate(query.data.as_of);
	}
	return <div className="creator-notification-wrap" ref={root}>
		<button type="button" className="creator-side-link creator-notification-trigger" aria-expanded={open} aria-controls="creator-notifications" onClick={() => { const next = !open; setOpen(next); if (next) void query.refetch(); }}>
			<Icon name="bell" size={18} /><span>Notifications</span>{Boolean(query.data?.unread_count) && <span className="creator-notification-count">{query.data!.unread_count > 99 ? '99+' : query.data!.unread_count}</span>}
		</button>
		{open && <section className="creator-notification-panel" id="creator-notifications" aria-label="Creator notifications">
			<header><div><h2>Notifications</h2><p>{query.isError ? 'Couldn’t check for updates' : query.data?.unread_count ? `${query.data.unread_count} unread` : 'You’re all caught up'}</p></div>
				{Boolean(query.data?.unread_count) && <button type="button" className="creator-notification-mark" disabled={markRead.isPending} onClick={readThrough}>Mark all read</button>}
			</header>
			{query.isLoading ? <p className="creator-notification-empty">Checking for updates…</p> : query.isError ? <div className="creator-notification-empty" role="alert">Couldn’t load notifications. <button type="button" onClick={() => void query.refetch()}>Try again</button></div> : query.data?.items.length ? <ul>
				{query.data.items.map(item => <li key={item.id} data-unread={item.unread || undefined}><Link href={item.href} onClick={() => { setOpen(false); onNavigate(); }}>
					<span className="creator-notification-dot" aria-hidden="true" />
					<span className="creator-notification-copy"><strong>{item.title}</strong><span>{item.detail}</span><time dateTime={item.occurred_at}>{new Date(item.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time></span>
				</Link></li>)}
			</ul> : <p className="creator-notification-empty">Campaign updates, review decisions and messages will show up here.</p>}
		</section>}
	</div>;
}

export default function CreatorPortalLayout({ children }: { children: React.ReactNode }) {
	const pathname = (usePathname() ?? base).replace(/\/$/, '') || base;
	const { email, displayName, creatorId } = useAuth();
	const [passwordOpen, setPasswordOpen] = React.useState(false);
	const [accountOpen, setAccountOpen] = React.useState(false);
	const [mobileOpen, setMobileOpen] = React.useState(false);
	const accountRef = React.useRef<HTMLDivElement>(null);
	const identity = creatorId || email;
	const initials = (displayName || email || 'Creator').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
	const active = navigation.find(item => item.paths.some(path => pathname === path || (path !== base && pathname.startsWith(`${path}/`))))?.label;
	async function signOut() { if (isSupabaseConfigured()) await getSupabase().auth.signOut(); else window.localStorage.removeItem('tch-dev-user'); window.location.assign('/login'); }
	const closeMobile = () => setMobileOpen(false);
	React.useEffect(() => { closeMobile(); setAccountOpen(false); }, [pathname]);
	React.useEffect(() => {
		if (!accountOpen) return;
		const close = (event: MouseEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
		const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAccountOpen(false); };
		document.addEventListener('mousedown', close); document.addEventListener('keydown', escape);
		return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
	}, [accountOpen]);
	return <div className="creator-workspace"><div className="creator-shell">
		<header className="creator-mobile-header"><Link className="creator-wordmark" href={base}><Image className="creator-symbol" src="/creatorledger-mark.svg" alt="" aria-hidden="true" width={34} height={34} priority /> Creator<span className="creator-wordmark-light">Ledger</span></Link><button type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="creator-sidebar" onClick={() => setMobileOpen(value => !value)}><Icon name={mobileOpen ? 'x' : 'menu'} size={20} /></button></header>
		{mobileOpen && <button className="creator-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={closeMobile} />}
		<aside className={`creator-sidebar${mobileOpen ? ' is-open' : ''}`} id="creator-sidebar">
			<Link className="creator-wordmark creator-sidebar-brand" href={base}><Image className="creator-symbol" src="/creatorledger-mark.svg" alt="" aria-hidden="true" width={34} height={34} priority /> Creator<span className="creator-wordmark-light">Ledger</span></Link>
			<div className="creator-sidebar-label">YOUR SPACE</div>
			<nav className="creator-sidebar-nav" aria-label="Creator navigation">
				{navigation.map(item => <React.Fragment key={item.label}><Link className="creator-side-link" href={item.href} aria-current={item.paths.some(path => pathname === path || (path !== base && pathname.startsWith(`${path}/`))) ? 'page' : undefined} onClick={closeMobile}><Icon name={item.icon} size={18} /><span>{item.label}</span></Link>
					{active === item.label && secondary.filter(sub => sub.parent === item.label).map(sub => <Link className="creator-side-subLink" href={sub.href} key={sub.href} aria-current={pathname === sub.href ? 'page' : undefined} onClick={closeMobile}>{sub.label}</Link>)}
				</React.Fragment>)}
			</nav>
			<div className="creator-sidebar-tools"><NotificationInbox identity={identity} onNavigate={closeMobile} />
				<div className="creator-account" ref={accountRef}><button className="creator-side-link creator-account-trigger" type="button" aria-label="Your profile and account" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}><span className="creator-account-avatar">{initials}</span><span className="creator-account-copy"><strong>{displayName || 'Your profile'}</strong><small>{email || 'Creator account'}</small></span><Icon name="chevron-down" size={14} /></button>{accountOpen && <div className="creator-account-menu" role="menu"><p>{displayName || 'Your account'}</p><Link role="menuitem" href={`${base}/profile`} onClick={() => setAccountOpen(false)}>Edit profile</Link><Link role="menuitem" href={`${base}/socials`} onClick={() => setAccountOpen(false)}>Connected accounts</Link><button role="menuitem" onClick={() => { setAccountOpen(false); setPasswordOpen(true); }}>Change password</button><button role="menuitem" onClick={() => { setAccountOpen(false); void signOut(); }}>Sign out</button></div>}</div>
			</div>
		</aside>
		<div className="creator-content"><main className="creator-main">{children}</main><footer className="creator-footer"><span>A little more you. A lot more possibility.</span><Link href={`${base}/media-kit`}>Your next collaboration starts here ↗</Link></footer></div>
	</div><ChangePasswordModal isOpen={passwordOpen} userEmail={email ?? ''} onClose={() => setPasswordOpen(false)} /></div>;
}
