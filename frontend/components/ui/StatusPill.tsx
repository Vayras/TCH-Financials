import * as React from 'react';
import { cn } from '@/lib/utils';

const styles = {
	pending: 'bg-[var(--app-warning-soft)] text-[var(--app-warning)]',
	success: 'bg-[var(--app-success-soft)] text-[var(--app-success)]',
	error: 'bg-[var(--app-danger-soft)] text-[var(--app-danger)]',
	neutral: 'bg-[var(--app-surface-muted)] text-[var(--app-muted)]'
} as const;

export function StatusPill({ tone = 'neutral', children, className }: { tone?: keyof typeof styles; children: React.ReactNode; className?: string }) {
	return <span className={cn('inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium', styles[tone], className)}>{children}</span>;
}

export default StatusPill;
