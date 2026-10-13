'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
import Dialog from '@/components/ui/Dialog';
import { FiscalYearProvider, useFiscalYear, fyLabel } from '@/lib/fiscal-year';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from './AuthGuard';

import ChangePasswordModal from '@/components/ChangePasswordModal';

const ROLE_LABELS: Record<string, string> = {
	super_admin: 'Super Admin',
	accounts: 'Accounts',
	tch_member: 'TCH Member',
	creator: 'Creator',
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
	super_admin: { bg: '#1e1b4b', color: '#e0e7ff' },
	accounts: { bg: '#0c4a6e', color: '#e0f2fe' },
	tch_member: { bg: '#e2e8f0', color: '#334155' },
	creator: { bg: '#581c87', color: '#f3e8ff' },
};

function UserFooter({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
	const { email, role, displayName } = useAuth();
	const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
	const [menuOpen, setMenuOpen] = React.useState(false);
	const menuRef = React.useRef<HTMLDivElement>(null);

	const initials = React.useMemo(() => {
		if (displayName) {
			return displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
		}
		return (email?.[0] ?? '?').toUpperCase();
	}, [displayName, email]);

	const label = displayName || email;
	const roleStyle = ROLE_COLORS[role] ?? ROLE_COLORS.tch_member;

	// Close menu on outside click
	React.useEffect(() => {
		if (!menuOpen) return;
		function handle(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		}
		document.addEventListener('mousedown', handle);
		return () => document.removeEventListener('mousedown', handle);
	}, [menuOpen]);

	const accountActionsAvailable = isSupabaseConfigured();

	async function signOut() {
		await getSupabase().auth.signOut();
		window.location.assign('/login');
	}

	return (
		<>
			<div
				ref={menuRef}
				className="sidebar-profile relative shrink-0"
				style={{ borderTop: '1px solid var(--n-border)' }}
			>
				{/* Account summary remains visible in local development too. */}
				<button
					type="button"
					disabled={!accountActionsAvailable}
					aria-expanded={accountActionsAvailable ? menuOpen : undefined}
					aria-label={`Account: ${label}, ${ROLE_LABELS[role] ?? role}`}
					onClick={() => setMenuOpen((o) => !o)}
					className="sidebar-profile-trigger w-full flex items-center justify-between gap-2.5 px-3 py-3 text-left transition-colors duration-100 active:scale-[0.985] cursor-pointer disabled:cursor-default"
					style={{ color: 'var(--n-fg)' }}
					onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--n-bg-hover)')}
					onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
					title={collapsed ? label : undefined}
				>
					<div className="flex items-center gap-2.5 min-w-0">
						{/* Avatar */}
						<div
							className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none"
							style={{ background: roleStyle.bg, color: roleStyle.color }}
						>
							{initials}
						</div>

						{!collapsed && (
							<div className="sidebar-profile-copy flex flex-col gap-0.5 min-w-0">
								<div className="text-[12px] font-semibold truncate" style={{ color: 'var(--n-fg)' }}>
									{label}
								</div>
								<div
									className="text-[10px] font-semibold
									inline-block"
									style={{ color: 'var(--n-accent)' }}
								>
									{ROLE_LABELS[role] ?? role}
								</div>
							</div>
						)}
					</div>

					{!collapsed && accountActionsAvailable && (
						<Icon name="more-horizontal" size={13} style={{ color: 'var(--n-fg-subtle)', flexShrink: 0 }} />
					)}
				</button>

				{/* Popover menu — anchored above the footer */}
				{menuOpen && (
					<div
						className="absolute bottom-full left-2 right-2 mb-1 rounded-lg shadow-lg border py-1 text-[10px] z-50"
						style={{
							background: 'var(--n-bg-soft)',
							borderColor: 'var(--n-border)',
						}}
					>
						{/* Profile header inside menu */}
						<div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--n-border)' }}>
							<div className="flex items-center gap-2.5">
								<div
									className="h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
									style={{ background: roleStyle.bg, color: roleStyle.color }}
								>
									{initials}
								</div>
								<div className="min-w-0">
									{displayName && (
										<div className="text-[10px] font-semibold truncate" style={{ color: 'var(--n-fg)' }}>
											{displayName}
										</div>
									)}
									<div className="text-[10px] truncate" style={{ color: 'var(--n-fg-subtle)' }}>
										{email}
									</div>
									<span
										className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mt-1"
										style={{ background: roleStyle.bg, color: roleStyle.color }}
									>
										{ROLE_LABELS[role] ?? role}
									</span>
								</div>
							</div>
						</div>

						{/* Menu actions */}
						<div className="pt-1">
							<Link
								href="/profile"
								onClick={() => { setMenuOpen(false); onNavigate?.(); }}
								className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
								style={{ color: 'var(--n-fg-subtle)' }}
								onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--n-bg-hover)')}
								onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
							>
								<Icon name="user" size={14} />
								<span>Profile Settings</span>
							</Link>

							<button
								type="button"
								onClick={() => { setMenuOpen(false); setIsChangePasswordOpen(true); }}
								className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
								style={{ color: 'var(--n-fg-subtle)' }}
								onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--n-bg-hover)')}
								onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
							>
								<Icon name="key" size={14} />
								<span>Change Password</span>
							</button>

							<div className="my-1 border-t" style={{ borderColor: 'var(--n-border)' }} />

							<button
								type="button"
								onClick={signOut}
								className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
								style={{ color: '#dc2626' }}
								onMouseEnter={(e) => (e.currentTarget.style.background = '#fff1f2')}
								onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
							>
								<Icon name="log-out" size={14} />
								<span>Sign Out</span>
							</button>
						</div>
					</div>
				)}
			</div>
			<ChangePasswordModal
				isOpen={isChangePasswordOpen}
				onClose={() => setIsChangePasswordOpen(false)}
				userEmail={email}
			/>
		</>
	);
}


function GlobalFySelect() {
	const { fyStart, setFyStart, fyOptions } = useFiscalYear();
	return <select aria-label="Fiscal year" className="header-year" disabled={fyStart === null} value={fyStart ?? ''} onChange={e => setFyStart(Number(e.target.value))}>
		{fyStart === null && <option value="">Fiscal year</option>}
		{fyOptions.map(year => <option key={year} value={year}>{fyLabel(year)}</option>)}
	</select>;
}

const NAV = [
	{ href: '/', label: 'Overview', icon: 'home' },
	{ href: '/commercial', label: 'Campaigns', icon: 'briefcase' },
	{ href: '/payments', label: 'Payments', icon: 'credit-card' },
	{ href: '/creators', label: 'Creators', icon: 'users' },
	{ href: '/alerts', label: 'Alerts', icon: 'bell' },
	{ href: '/employees', label: 'Team reports', icon: 'user-cog' },
	{ href: '/entity-summary', label: 'Entity Summary', icon: 'layers' }
];

function isActiveHref(pathname: string, href: string) {
	if (href === '/') return pathname === '/';
	return pathname.startsWith(href);
}

export function Sidebar({ children }: { children: React.ReactNode }) {
	const pathname = usePathname() ?? '/';
	const [collapsed, setCollapsed] = React.useState(false);
	const [mobileOpen, setMobileOpen] = React.useState(false);
	const mobileTrigger = React.useRef<HTMLButtonElement>(null);
	const { role } = useAuth();

	const filteredNav = React.useMemo(() => {
		if (role === 'accounts') {
			return [
				{ href: '/accounts-dashboard', label: 'Overview', icon: 'home' },
				{ href: '/payments', label: 'Payments', icon: 'credit-card' },
				{ href: '/creators', label: 'Creators', icon: 'users' },
				{ href: '/entity-summary', label: 'Entity Summary', icon: 'layers' }
			];
		}
		if (role === 'super_admin') {
			return [
				...NAV,
				{ href: '/users', label: 'Users', icon: 'settings' }
			];
		}
		return NAV.filter((item) => item.href !== '/payments');
	}, [role]);

	const current = filteredNav.find((n) => isActiveHref(pathname, n.href));
	const currentLabel = pathname.startsWith('/campaigns/') ? 'Campaigns' : current?.label ?? 'TCH';

	const renderNavigation = (expanded: boolean) => (
					<nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-4">
						<div className="px-2 pb-1">
							{expanded && (
								<div
									className="text-[11px] font-medium uppercase tracking-wider px-2 pb-1.5 pt-1"
									style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
								>
									Workspace
								</div>
							)}
							{filteredNav.map((item) => {
								const active = isActiveHref(pathname, item.href);
								return (
									<Link
										key={item.href}
										href={item.href}
										onClick={() => setMobileOpen(false)}
										className={cn(
											'nav-item',
											active && 'active',
											!expanded && 'justify-center'
										)}
										aria-label={item.label}
										aria-current={active ? 'page' : undefined}
										title={item.label}
									>
										<span className="nav-icon">
											<Icon name={item.icon} />
										</span>
										{expanded && <span className="truncate">{item.label}</span>}
									</Link>
								);
							})}
						</div>
					</nav>
	);

	return (
		<FiscalYearProvider>
			<div className="flex min-h-screen" style={{ background: 'var(--n-bg)' }}>
				<aside
					className="app-sidebar sticky top-0 self-start h-screen flex flex-col shrink-0 overflow-visible transition-[width] duration-150 ease-out z-30"
					style={{
						background: 'var(--n-bg-sidebar)',
						borderRight: '1px solid var(--n-border)',
						width: collapsed ? '64px' : '240px'
					}}
				>
					<div
						className={cn("sidebar-brand-row flex items-center justify-between h-11 shrink-0", collapsed ? "px-1 justify-center" : "px-3")}
						style={{ borderBottom: '1px solid var(--n-border)' }}
					>
						{!collapsed ? (
							<div className="flex items-center gap-2 min-w-0">
								<div
									className="sidebar-mark h-6 w-6 rounded flex items-center justify-center text-[12px] font-semibold"
									style={{ background: '#6554c0', color: '#ffffff' }}
								>
									T
								</div>
								<div className="flex flex-col min-w-0 leading-none">
									<span className="text-[12px] font-bold truncate" style={{ color: 'var(--n-fg)' }}>
										TCH Financials
									</span>

								</div>
							</div>
						) : (
							<div
								className="sidebar-mark h-6 w-6 shrink-0 rounded flex items-center justify-center text-[12px] font-semibold leading-none"
								style={{ background: '#6554c0', color: '#ffffff' }}
							>
								T
							</div>
						)}
						<button
							type="button"
							className="sidebar-collapse inline-flex items-center justify-center transition-colors"
							style={{ color: 'var(--n-fg-subtle)' }}
							aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
							onClick={() => setCollapsed((c) => !c)}
						>
							<Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={14} />
						</button>
					</div>

					{renderNavigation(!collapsed)}

					<UserFooter collapsed={collapsed} />
				</aside>

				<div className="flex-1 min-w-0 flex flex-col">
					<header
						className="app-topbar h-11 flex items-center px-5 gap-2 shrink-0 sticky top-0 z-20"
						style={{
							background: 'var(--n-bg)',
							borderBottom: '1px solid var(--n-border)'
						}}
					>
						<button ref={mobileTrigger} className="mobile-menu-trigger" type="button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Icon name="menu" size={20} /></button>
						<span className="header-page-name">{currentLabel}</span>
						<GlobalFySelect />
					</header>

					<main className="flex-1 overflow-x-hidden">
						<div className="app-content mx-auto w-full max-w-[1280px] px-12 py-12">{children}</div>
					</main>
				</div>
			</div>
			<Dialog open={mobileOpen} onOpenChange={setMobileOpen} title="TCH Financials" className="mobile-navigation-dialog app-sidebar" onCloseAutoFocus={event => { event.preventDefault(); mobileTrigger.current?.focus(); }}>
				{renderNavigation(true)}
				<UserFooter collapsed={false} onNavigate={() => setMobileOpen(false)} />
			</Dialog>
		</FiscalYearProvider>
	);
}

export default Sidebar;
