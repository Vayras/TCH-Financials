'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';

const NAV = [
	{ href: '/', label: 'Overview', icon: 'home' },
	{ href: '/commercial', label: 'Commercial', icon: 'briefcase' },
	{ href: '/creators', label: 'Creators', icon: 'users' },
	{ href: '/insights', label: 'Creator Insights', icon: 'sparkle' },
	{ href: '/alerts', label: 'Alerts', icon: 'bell' },
	{ href: '/contracting', label: 'Contracting', icon: 'file-signature' },
	{ href: '/exclusives', label: 'Exclusives', icon: 'star' },
	{ href: '/employees', label: 'Employees', icon: 'user-cog' },
	{ href: '/dropoffs', label: 'Drop-offs', icon: 'log-out' },
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

				<div
					className="px-3 py-2 text-[11px]"
					style={{ color: 'var(--n-fg-subtle)', borderTop: '1px solid var(--n-border)' }}
				>
					{!collapsed ? 'MIS · derived live' : '·'}
				</div>
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
				</header>

				<main className="flex-1 overflow-x-hidden">
					<div className="mx-auto w-full max-w-[1280px] px-12 py-12">{children}</div>
				</main>
			</div>
		</div>
	);
}

export default Sidebar;
