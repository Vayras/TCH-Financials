'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
import { FiscalYearProvider, useFiscalYear, fyLabel } from '@/lib/fiscal-year';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

function UserFooter({ collapsed }: { collapsed: boolean }) {
	const [email, setEmail] = React.useState<string>('');

	React.useEffect(() => {
		if (!isSupabaseConfigured()) return;
		const supabase = getSupabase();
		supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''));
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			setEmail(session?.user.email ?? '');
		});
		return () => sub.subscription.unsubscribe();
	}, []);

	if (!isSupabaseConfigured()) return null;

	async function signOut() {
		await getSupabase().auth.signOut();
		window.location.assign('/login');
	}

	return (
		<div
			className="shrink-0 px-3 py-2.5 flex items-center gap-2"
			style={{ borderTop: '1px solid var(--n-border)' }}
		>
			{!collapsed && (
				<span
					className="text-[12px] truncate flex-1"
					style={{ color: 'var(--n-fg-subtle)' }}
					title={email}
				>
					{email}
				</span>
			)}
			<button
				type="button"
				onClick={signOut}
				aria-label="Sign out"
				title="Sign out"
				className="h-6 w-6 inline-flex items-center justify-center rounded transition-colors shrink-0"
				style={{ color: 'var(--n-fg-subtle)' }}
				onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--n-bg-hover)')}
				onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
			>
				<Icon name="log-out" size={14} />
			</button>
		</div>
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
	{ href: '/commercial', label: 'Campaign', icon: 'briefcase' },
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

	const current = NAV.find((n) => isActiveHref(pathname, n.href));
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
								className="h-6 w-6 rounded flex items-center justify-center text-[12px] font-semibold"
								style={{ background: 'var(--n-fg)', color: 'var(--n-bg)' }}
							>
								T
							</div>
							<span className="text-[13.5px] font-semibold truncate">TCH Financials</span>
						</div>
					) : (
						<div
							className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-[12px] font-semibold leading-none"
							style={{ background: 'var(--n-fg)', color: 'var(--n-bg)' }}
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
						{NAV.map((item) => {
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
