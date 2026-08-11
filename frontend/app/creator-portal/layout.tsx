'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthGuard';

const CREATOR_NAV = [
	{ href: '/creator-portal', label: 'My Deals', icon: 'briefcase' },
	{ href: '/creator-portal/invoices', label: 'My Invoices', icon: 'file-text' },
	{ href: '/creator-portal/payments', label: 'Payments & TDS', icon: 'credit-card' }
];

export default function CreatorPortalLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname() ?? '/creator-portal';
	const { email, displayName } = useAuth();

	async function signOut() {
		await getSupabase().auth.signOut();
		window.location.assign('/login');
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
				className="sticky top-0 self-start h-screen flex flex-col shrink-0 overflow-hidden"
				style={{
					background: '#fff',
					borderRight: '1px solid #e5e5e0',
					width: '240px'
				}}
			>
				<div
					className="flex items-center px-4 h-12 shrink-0 gap-2.5"
					style={{ borderBottom: '1px solid #e5e5e0' }}
				>
					<div
						className="h-6 w-6 rounded flex items-center justify-center text-[12px] font-bold"
						style={{ background: 'var(--n-accent)', color: '#fff' }}
					>
						C
					</div>
					<span className="text-[13.5px] font-bold text-gray-800">Creator Portal</span>
				</div>

				<nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
					{CREATOR_NAV.map((item) => {
						const active = pathname === item.href;
						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors duration-100',
									active
										? 'bg-[var(--n-accent-soft)] text-[var(--n-accent)] font-semibold'
										: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
								)}
							>
								<Icon name={item.icon} size={15} />
								<span>{item.label}</span>
							</Link>
						);
					})}
				</nav>

				{/* Warm profile footer card */}
				<div className="p-3" style={{ borderTop: '1px solid #e5e5e0' }}>
					<div className="flex items-center gap-2.5 p-2 rounded-lg">
						<div
							className="h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-bold select-none text-white shrink-0"
							style={{ background: 'var(--n-accent)' }}
						>
							{initials}
						</div>
						<div className="min-w-0 flex-1">
							<div className="text-[12.5px] font-semibold text-gray-800 truncate">
								{displayName}
							</div>
							<div className="text-[10px] text-gray-400 truncate">{email}</div>
						</div>
						<button
							onClick={signOut}
							className="group/logout h-7 px-1.5 inline-flex items-center justify-center gap-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors duration-100 shrink-0"
							title="Sign out"
							aria-label="Sign out"
						>
							<Icon name="log-out" size={14} />
							<span className="text-[10px] font-medium opacity-0 group-hover/logout:opacity-100 transition-opacity duration-100 hidden group-hover/logout:inline">Out</span>
						</button>
					</div>
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
					<span className="text-[13px] font-medium text-gray-500">
						Welcome back, <span className="text-[var(--n-accent)] font-semibold">{displayName || 'Creator'}</span>
					</span>
				</header>

				<main className="flex-1 overflow-x-hidden">
					<div className="mx-auto w-full max-w-[1200px] px-8 py-8">{children}</div>
				</main>
			</div>
		</div>
	);
}
