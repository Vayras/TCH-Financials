import * as React from 'react';
import { cn } from '@/lib/utils';

export default function Alert({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'success' | 'warning' | 'error'; children: React.ReactNode; className?: string }) {
	const tones = { neutral: 'border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-muted)]', success: 'border-[var(--app-success)]/20 bg-[var(--app-success-soft)] text-[var(--app-success)]', warning: 'border-[var(--app-warning)]/20 bg-[var(--app-warning-soft)] text-[var(--app-warning)]', error: 'border-[var(--app-danger)]/20 bg-[var(--app-danger-soft)] text-[var(--app-danger)]' };
	return <div role="status" className={cn('rounded-[var(--app-radius-sm)] border px-3 py-2 text-sm', tones[tone], className)}>{children}</div>;
}
