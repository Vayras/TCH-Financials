'use client';
import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthGuard';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import Icon from '@/components/ui/Icon';

const base = '/creator-portal';
const navigation = [{ label: 'Home', href: base, paths: [base] }, { label: 'Content library', href: `${base}/portfolio`, paths: [`${base}/portfolio`] }, { label: 'Brand kit', href: `${base}/media-kit`, paths: [`${base}/media-kit`] }, { label: 'Campaigns', href: `${base}/campaigns`, paths: [`${base}/campaigns`] }, { label: 'Work', href: `${base}/deals`, paths: [`${base}/deals`, `${base}/enquiries`] }, { label: 'Earnings', href: `${base}/invoices`, paths: [`${base}/invoices`, `${base}/payments`] }];
export default function CreatorPortalLayout({ children }: { children: React.ReactNode }) {
	const pathname = (usePathname() ?? base).replace(/\/$/, '');
	const { email, displayName } = useAuth();
	const [passwordOpen, setPasswordOpen] = React.useState(false);
	const [accountOpen, setAccountOpen] = React.useState(false);
	const accountRef = React.useRef<HTMLDivElement>(null);
	const initials = (displayName || email || 'Creator').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
	const secondary = pathname.includes('/deals') || pathname.includes('/enquiries') ? [['Active work', 'deals'], ['Brand opportunities', 'enquiries']] : pathname.includes('/invoices') || pathname.includes('/payments') ? [['Invoices', 'invoices'], ['Payments & tax', 'payments']] : pathname.includes('/profile') || pathname.includes('/socials') ? [['Your profile', 'profile'], ['Connected accounts', 'socials']] : [];
	async function signOut() { if (isSupabaseConfigured()) await getSupabase().auth.signOut(); else window.localStorage.removeItem('tch-dev-user'); window.location.assign('/login'); }
	React.useEffect(() => {
		if (!accountOpen) return;
		const close = (event: MouseEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
		const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAccountOpen(false); };
		document.addEventListener('mousedown', close); document.addEventListener('keydown', escape);
		return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
	}, [accountOpen]);
	return <div className="creator-workspace"><div className="creator-shell">
		<header className="creator-header"><Link className="creator-wordmark" href={base}><Image className="creator-symbol" src="/creatorledger-mark.svg" alt="" aria-hidden="true" width={34} height={34} priority /> Creator<span className="creator-wordmark-light">Ledger</span></Link>
			<nav className="creator-nav" aria-label="Creator navigation">{navigation.map(item => <Link key={item.label} href={item.href} aria-current={item.paths.includes(pathname) ? 'page' : undefined}>{item.label}</Link>)}</nav>
			<div className="creator-account" ref={accountRef}><button className="creator-account-trigger" type="button" aria-label="Your account" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}><span className="creator-account-avatar">{initials}</span><Icon name="chevron-down" size={14} /></button>{accountOpen && <div className="creator-account-menu" role="menu"><p>{displayName || 'Your account'}</p><Link role="menuitem" href={`${base}/profile`} onClick={() => setAccountOpen(false)}>Edit profile</Link><Link role="menuitem" href={`${base}/socials`} onClick={() => setAccountOpen(false)}>Connected accounts</Link><button role="menuitem" onClick={() => { setAccountOpen(false); setPasswordOpen(true); }}>Change password</button><button role="menuitem" onClick={() => { setAccountOpen(false); void signOut(); }}>Sign out</button></div>}</div>
		</header>
		<main className="creator-main">{secondary.length > 0 && <nav className="creator-subnav" aria-label="Section navigation">{secondary.map(([label, path]) => <Link key={path} href={`${base}/${path}`} aria-current={pathname === `${base}/${path}` ? 'page' : undefined}>{label}</Link>)}</nav>}{children}</main>
		<footer className="creator-footer"><span>A little more you. A lot more possibility.</span><Link href={`${base}/media-kit`}>Your next collaboration starts here ↗</Link></footer>
	</div><ChangePasswordModal isOpen={passwordOpen} userEmail={email ?? ''} onClose={() => setPasswordOpen(false)} /></div>;
}
