import * as React from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

export function CreatorPageHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
	return (
		<header className="flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--n-fg)]">{title}</h1>
				<p className="mt-1 text-[12px] leading-5 text-[var(--n-fg-muted)]">{description}</p>
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</header>
	);
}

export function PortalCard({ children, className }: { children: React.ReactNode; className?: string }) {
	return <section className={cn('rounded-xl border border-[var(--n-border)] bg-white shadow-[0_1px_2px_rgba(15,15,15,0.02)]', className)}>{children}</section>;
}

export function PortalStat({ label, value, detail, icon }: { label: string; value: React.ReactNode; detail: string; icon: string }) {
	return (
		<PortalCard className="p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--n-fg-subtle)]">{label}</p>
					<div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-[var(--n-fg)] tabular-nums">{value}</div>
					<p className="mt-1 text-[10px] text-[var(--n-fg-subtle)]">{detail}</p>
				</div>
				<div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--n-accent-soft)] text-[var(--n-accent)]">
					<Icon name={icon} size={15} />
				</div>
			</div>
		</PortalCard>
	);
}

export function PortalEmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: React.ReactNode }) {
	return (
		<div className="flex flex-col items-center px-6 py-14 text-center">
			<div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--n-bg-soft)] text-[var(--n-fg-subtle)]"><Icon name={icon} size={17} /></div>
			<h2 className="mt-4 text-[13px] font-semibold text-[var(--n-fg)]">{title}</h2>
			<p className="mt-1 max-w-[360px] text-[11px] leading-5 text-[var(--n-fg-subtle)]">{description}</p>
			{action && <div className="mt-4">{action}</div>}
		</div>
	);
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
	return <span className="mb-1.5 block text-[10px] font-medium text-[var(--n-fg-muted)]">{children}</span>;
}
