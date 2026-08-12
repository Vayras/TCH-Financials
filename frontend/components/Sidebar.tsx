'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
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

function UserFooter({ collapsed }: { collapsed: boolean }) {
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

	if (!isSupabaseConfigured()) return null;

	async function signOut() {
		await getSupabase().auth.signOut();
		window.location.assign('/login');
	}

	return (
		<>
			<div
				ref={menuRef}
				className="relative shrink-0"
				style={{ borderTop: '1px solid var(--n-border)' }}
			>
				{/* Profile trigger div */}
				<div
					onClick={() => setMenuOpen((o) => !o)}
					className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 transition-colors duration-100 active:scale-[0.985] cursor-pointer"
					style={{ color: 'var(--n-fg)' }}
					onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--n-bg-hover)')}
					onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
					title={collapsed ? label : undefined}
				>
					<div className="flex items-center gap-2.5 min-w-0">
						{/* Avatar */}
						<div
							className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none"
							style={{ background: roleStyle.bg, color: roleStyle.color }}
						>
							{initials}
						</div>

						{!collapsed && (
							<div className="flex flex-col gap-0 min-w-0">
								<div className="text-[12px] font-medium truncate" style={{ color: 'var(--n-fg)' }}>
									{label}
								</div>
								<div
									className="text-[8px] font-semibold 
									inline-block"
									style={{ color: roleStyle.bg }}
								>
									{ROLE_LABELS[role] ?? role}
								</div>
							</div>
						)}
					</div>

					{!collapsed && (
						<Icon name="more-horizontal" size={13} style={{ color: 'var(--n-fg-subtle)', flexShrink: 0 }} />
					)}
				</div>

				{/* Popover menu — anchored above the footer */}
				{menuOpen && (
					<div
						className="absolute bottom-full left-2 right-2 mb-1 rounded-lg shadow-lg border py-1 text-[13px] z-50"
						style={{
							background: 'var(--n-bg-soft)',
							borderColor: 'var(--n-border)',
							boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
						}}
					>
						{/* Profile header inside menu */}
						<div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--n-border)' }}>
							<div className="flex items-center gap-2.5">
								<div
									className="h-9 w-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
									style={{ background: roleStyle.bg, color: roleStyle.color }}
								>
									{initials}
								</div>
								<div className="min-w-0">
									{displayName && (
										<div className="text-[13px] font-semibold truncate" style={{ color: 'var(--n-fg)' }}>
											{displayName}
										</div>
									)}
									<div className="text-[11.5px] truncate" style={{ color: 'var(--n-fg-subtle)' }}>
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
								onClick={() => setMenuOpen(false)}
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
	// fyStart is null until the client useEffect runs — render a disabled skeleton to avoid layout shift.
	if (fyStart === null) {
		return (
			<label className="ml-auto flex items-center gap-1.5">
				<span
					className="text-[11.5px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
				>
					Fiscal Year
				</span>
				<select disabled className="h-7 rounded px-2 pr-7 text-[13px] opacity-40 bg-[var(--n-bg-soft)] border border-[var(--n-border)]" />
			</label>
		);
	}
	return (
		<label className="ml-auto flex items-center gap-1.5">
			<span
				className="text-[11.5px] font-medium uppercase"
				style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
			>
				Fiscal Year
			</span>
			<select
				className="h-7 rounded px-2 pr-7 text-[13px] appearance-none bg-no-repeat bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
				style={{
					backgroundImage:
						"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2337352f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
					backgroundPosition: 'right 6px center',
					backgroundSize: '12px 12px'
				}}
				value={fyStart}
				onChange={(e) => setFyStart(Number(e.target.value))}
			>
				{fyOptions.map((y) => (
					<option key={y} value={y}>
						{fyLabel(y)}
					</option>
				))}
			</select>
		</label>
	);
}

const NAV = [
	{ href: '/', label: 'Overview', icon: 'home' },
	{ href: '/commercial', label: 'Campaigns', icon: 'briefcase' },
	{ href: '/payments', label: 'Payments', icon: 'credit-card' },
	{ href: '/creators', label: 'Creators', icon: 'users' },
	{ href: '/alerts', label: 'Alerts', icon: 'bell' },
	{ href: '/employees', label: 'Employees', icon: 'user-cog' },
	{ href: '/entity-summary', label: 'Entity Summary', icon: 'layers' }
];

function isActiveHref(pathname: string, href: string) {
	if (href === '/') return pathname === '/';
	return pathname.startsWith(href);
}

export function Sidebar({ children }: { children: React.ReactNode }) {
	const pathname = usePathname() ?? '/';
	const [collapsed, setCollapsed] = React.useState(false);
	const { role } = useAuth();

	const filteredNav = React.useMemo(() => {
		if (role === 'accounts') {
			return [
				{ href: '/accounts-dashboard', label: 'Overview', icon: 'home' },
				{ href: '/payments', label: 'Payments', icon: 'credit-card' },
				{ href: '/entity-summary', label: 'Entity Summary', icon: 'layers' }
			];
		}
		if (role === 'super_admin') {
			return [
				...NAV,
				{ href: '/users', label: 'Users', icon: 'settings' }
			];
		}
		return NAV;
	}, [role]);

	const current = filteredNav.find((n) => isActiveHref(pathname, n.href));
	const currentLabel = current?.label ?? 'TCH';

	return (
		<FiscalYearProvider>
			<div className="flex min-h-screen" style={{ background: 'var(--n-bg)' }}>
				<aside
					className="sticky top-0 self-start h-screen flex flex-col shrink-0 overflow-hidden transition-[width] duration-150 ease-out z-30"
					style={{
						background: 'var(--n-bg-sidebar)',
						borderRight: '1px solid var(--n-border)',
						width: collapsed ? '52px' : '240px'
					}}
				>
					<div
						className="flex items-center justify-between px-3 h-11 shrink-0"
						style={{ borderBottom: '1px solid var(--n-border)' }}
					>
						{!collapsed ? (
							<div className="flex items-center gap-2 min-w-0">
								<div
									className="h-6 w-6 rounded flex items-center justify-center text-[12px] font-semibold shadow-sm"
									style={{ background: 'var(--n-fg)', color: 'var(--n-bg)', boxShadow: '0 2px 4px rgba(0,0,0,0.12)' }}
								>
									T
								</div>
								<div className="flex flex-col min-w-0 leading-none">
									<span className="text-[13.5px] font-bold truncate" style={{ color: 'var(--n-fg)' }}>
										{role === 'super_admin' ? 'TCH MIS' : role === 'accounts' ? 'TCH Financials' : 'TCH Commercial'}
									</span>
									<span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'var(--n-fg-subtle)' }}>
										{role === 'super_admin' ? 'Super Admin' : role === 'accounts' ? 'Accounts & Ledger' : 'Operations'}
									</span>
								</div>
							</div>
						) : (
							<div
								className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-[12px] font-semibold leading-none shadow-sm"
								style={{ background: 'var(--n-fg)', color: 'var(--n-bg)', boxShadow: '0 2px 4px rgba(0,0,0,0.12)' }}
							>
								T
							</div>
						)}
						<button
							type="button"
							className="h-6 w-6 inline-flex items-center justify-center rounded transition-colors"
							style={{ color: 'var(--n-fg-subtle)' }}
							aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
							onClick={() => setCollapsed((c) => !c)}
							onMouseEnter={(e) =>
								(e.currentTarget.style.background = 'var(--n-bg-hover)')
							}
							onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
						>
							<Icon name={collapsed ? 'chevron-right' : 'chevrons-left'} size={14} />
						</button>
					</div>

					<nav className="flex-1 overflow-y-auto py-2">
						<div className="px-2 pb-1">
							{!collapsed && (
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
										className={cn(
											'nav-item',
											active && 'active',
											collapsed && 'justify-center'
										)}
										title={collapsed ? item.label : undefined}
									>
										<span className="nav-icon">
											<Icon name={item.icon} />
										</span>
										{!collapsed && <span className="truncate">{item.label}</span>}
									</Link>
								);
							})}
						</div>
					</nav>

					<UserFooter collapsed={collapsed} />
				</aside>

				<div className="flex-1 min-w-0 flex flex-col">
					<header
						className="h-11 flex items-center px-5 gap-2 shrink-0 sticky top-0 z-20"
						style={{
							background: 'var(--n-bg)',
							borderBottom: '1px solid var(--n-border)'
						}}
					>
						<span className="inline-flex items-center" style={{ color: 'var(--n-fg-subtle)' }}>
							<Icon name="home" size={14} />
						</span>
						<span className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
							/
						</span>
						<span className="text-[13px] font-medium" style={{ color: 'var(--n-fg)' }}>
							{currentLabel}
						</span>
						<GlobalFySelect />
					</header>

					<main className="flex-1 overflow-x-hidden">
						<div className="mx-auto w-full max-w-[1280px] px-12 py-12">{children}</div>
					</main>
				</div>
			</div>
		</FiscalYearProvider>
	);
}

export default Sidebar;
