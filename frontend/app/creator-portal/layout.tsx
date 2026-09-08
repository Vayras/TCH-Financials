'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';
import ChangePasswordModal from '@/components/ChangePasswordModal';

const CREATOR_NAV = [
	{
		label: 'Creator',
		items: [
			{ href: '/creator-portal', label: 'Overview', icon: 'grid' },
			{ href: '/creator-portal/profile', label: 'My Profile', icon: 'user' },
			{ href: '/creator-portal/socials', label: 'Social Accounts', icon: 'at-sign' },
			{ href: '/creator-portal/portfolio', label: 'Portfolio', icon: 'images' },
		],
	},
	{
		label: 'Business',
		items: [
			{ href: '/creator-portal/media-kit', label: 'Media Kit', icon: 'layout' },
			{ href: '/creator-portal/enquiries', label: 'Brand Enquiries', icon: 'inbox' },
		],
	},
	{
		label: 'Financials',
		items: [
			{ href: '/creator-portal/deals', label: 'My Deals', icon: 'briefcase' },
			{ href: '/creator-portal/invoices', label: 'My Invoices', icon: 'file-text' },
			{ href: '/creator-portal/payments', label: 'Payments & TDS', icon: 'credit-card' },
		],
	},
];

function creatorNavActive(pathname: string, href: string) {
	return href === '/creator-portal' ? pathname === href : pathname.startsWith(href);
}

export default function CreatorPortalLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname() ?? '/creator-portal';
	const { email, displayName } = useAuth();
	const [collapsed, setCollapsed] = React.useState(false);
	const [menuOpen, setMenuOpen] = React.useState(false);
	const [passwordOpen, setPasswordOpen] = React.useState(false);
	const menuRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		setCollapsed(window.localStorage.getItem('tch-creator-sidebar-collapsed') === 'true');
	}, []);

	React.useEffect(() => {
		if (!menuOpen) return;
		function closeOnOutsideClick(event: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
		}
		document.addEventListener('mousedown', closeOnOutsideClick);
		return () => document.removeEventListener('mousedown', closeOnOutsideClick);
	}, [menuOpen]);

	function toggleSidebar() {
		setCollapsed((current) => {
			const next = !current;
			window.localStorage.setItem('tch-creator-sidebar-collapsed', String(next));
			return next;
		});
	}

	async function signOut() {
		if (isSupabaseConfigured()) {
			await getSupabase().auth.signOut();
			window.location.assign('/login');
			return;
		}
		window.localStorage.removeItem('tch-dev-user');
		window.location.assign('/');
	}

	const initials = React.useMemo(() => {
		if (displayName) {
			return displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
		}
		return (email?.[0] ?? '?').toUpperCase();
	}, [displayName, email]);

	return (
		<div className="flex min-h-screen" style={{ background: 'var(--n-bg-soft)' }}>
			{/* Warm minimalist sidebar */}
			<aside
				className="sticky top-0 self-start h-screen flex flex-col shrink-0 transition-[width] duration-200 ease-out z-20"
				style={{
					background: '#fff',
					borderRight: '1px solid #e5e5e0',
					width: collapsed ? '64px' : '240px'
				}}
			>
				<div
					className={cn('flex items-center h-12 shrink-0 gap-2.5 overflow-hidden', collapsed ? 'justify-center px-2' : 'px-4')}
					style={{ borderBottom: '1px solid #e5e5e0' }}
				>
					<div
						className="h-6 w-6 rounded flex items-center justify-center text-[12px] font-bold"
						style={{ background: 'var(--n-accent)', color: '#fff' }}
					>
						C
					</div>
					{!collapsed && <span className="text-[12px] font-bold text-gray-800 whitespace-nowrap">Creator Portal</span>}
				</div>

				<button
					type="button"
					onClick={toggleSidebar}
					className="absolute -right-3.5 top-[78px] h-7 w-7 rounded-full border bg-white shadow-md inline-flex items-center justify-center text-gray-500 hover:text-[var(--n-accent)] hover:border-[var(--n-accent)] transition-colors"
					style={{ borderColor: '#e5e5e0' }}
					aria-label={collapsed ? 'Expand creator sidebar' : 'Collapse creator sidebar'}
					title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					<Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={15} />
				</button>

				<nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
					{CREATOR_NAV.map((group) => (
						<div key={group.label} className="mb-3 last:mb-0">
							{!collapsed && <div className="px-3 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.09em] text-gray-400">{group.label}</div>}
							<div className="space-y-0.5">
								{group.items.map((item) => {
									const active = creatorNavActive(pathname, item.href);
									return (
										<Link key={item.href} href={item.href} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-[11px] font-medium transition-colors duration-100', collapsed && 'justify-center px-2', active ? 'bg-[var(--n-accent-soft)] text-[var(--n-accent)]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900')} title={collapsed ? item.label : undefined}>
											<Icon name={item.icon} size={15} />
											{!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
										</Link>
									);
								})}
							</div>
						</div>
					))}
				</nav>

				{/* Warm profile footer card */}
				<div ref={menuRef} className={cn('relative', collapsed ? 'p-2' : 'p-3')} style={{ borderTop: '1px solid #e5e5e0' }}>
					{menuOpen && (
						<div
							className={cn(
								'absolute bottom-full mb-2 overflow-hidden rounded-xl border bg-white shadow-[0_12px_32px_rgba(15,23,42,0.10)]',
								collapsed ? 'left-2 w-[248px]' : 'left-3 right-3'
							)}
							style={{ borderColor: '#e8e8e3' }}
						>
							<div className="flex items-center gap-2.5 px-3 py-2.5 border-b" style={{ borderColor: '#eeeeea' }}>
								<div className="h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={{ background: 'var(--n-accent)' }}>
									{initials}
								</div>
								<div className="min-w-0">
									<div className="text-[12px] font-semibold text-gray-800 truncate">{displayName || 'Creator'}</div>
									<div className="text-[11px] text-gray-400 truncate">{email}</div>
									<span className="inline-flex mt-1 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--n-accent)]">Creator</span>
								</div>
							</div>
							<div className="p-1.5">
								<Link href="/creator-portal/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
									<Icon name="user" size={15} /><span>Profile Settings</span>
								</Link>
								<button type="button" disabled={!isSupabaseConfigured()} onClick={() => { setMenuOpen(false); setPasswordOpen(true); }} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors" title={!isSupabaseConfigured() ? 'Passwords are disabled in local development' : undefined}>
									<Icon name="key" size={15} /><span>Change Password</span>
								</button>
							</div>
							<div className="border-t p-1.5" style={{ borderColor: '#eeeeea' }}>
								<button type="button" onClick={signOut} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50 transition-colors">
									<Icon name="log-out" size={15} /><span>Sign Out</span>
								</button>
							</div>
						</div>
					)}
					<button
						type="button"
						onClick={() => setMenuOpen((open) => !open)}
						className={cn('w-full flex items-center gap-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left', collapsed ? 'justify-center py-2' : 'p-2')}
						aria-expanded={menuOpen}
						aria-label="Open creator account menu"
					>
						<div
							className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold select-none text-white shrink-0"
							style={{ background: 'var(--n-accent)' }}
						>
							{initials}
						</div>
						{!collapsed && <div className="min-w-0 flex-1">
							<div className="text-[12px] font-semibold text-gray-800 truncate">
								{displayName}
							</div>
							<div className="text-[11px] text-gray-400 truncate">{email}</div>
						</div>}
						{!collapsed && <Icon name="more-horizontal" size={15} className="text-gray-400 shrink-0" />}
					</button>
				</div>
			</aside>

			{/* Main body area */}
			<div className="flex-1 flex flex-col min-w-0">
				<header
					className="creator-portal-header h-12 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10"
					style={{
						background: 'rgba(255, 255, 255, 0.72)',
						backdropFilter: 'blur(16px) saturate(160%)',
						WebkitBackdropFilter: 'blur(16px) saturate(160%)',
						borderBottom: '1px solid rgba(0,0,0,0.06)'
					}}
				>
					<span className="text-[12px] font-medium text-gray-500">
						Welcome back, <span className="text-[var(--n-accent)] font-semibold">{displayName || 'Creator'}</span>
					</span>
					<Link href="/creator-portal/media-kit" className="inline-flex h-7 items-center gap-1.5 rounded border border-[var(--n-border-strong)] px-2.5 text-[10px] font-medium text-[var(--n-fg-muted)] hover:bg-[var(--n-bg-hover)] hover:text-[var(--n-fg)]">
						<Icon name="eye" size={12} />View public kit
					</Link>
				</header>

				<main className="flex-1 overflow-x-hidden">
					<div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
				</main>
			</div>
			<ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} userEmail={email} />
		</div>
	);
}
