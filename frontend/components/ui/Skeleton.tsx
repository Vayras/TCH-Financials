import * as React from 'react';
import { cn } from '@/lib/utils';

export default function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div aria-hidden="true" className={cn('animate-pulse rounded-[var(--app-radius-sm)] bg-[var(--app-surface-muted)]', className)} {...props} />;
}
