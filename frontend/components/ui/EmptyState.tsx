import * as React from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: React.ReactNode; className?: string }) {
	return <div className={cn('flex flex-col items-center justify-center rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-12 text-center', className)}><strong className="text-sm font-medium text-[var(--app-fg)]">{title}</strong>{description && <p className="mt-1 max-w-md text-sm text-[var(--app-muted)]">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}
