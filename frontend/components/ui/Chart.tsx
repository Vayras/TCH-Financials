'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip as RechartsTooltip } from 'recharts';

export type ChartConfig = Record<string, { label: string; color: string }>;

export function ChartContainer({ config, className, children }: { config: ChartConfig; className?: string; children: React.ReactNode }) {
	const vars = Object.fromEntries(Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]));
	return <div className={cn('h-full w-full min-w-0', className)} style={vars as React.CSSProperties}>{children}</div>;
}

export function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string }) {
	if (!active || !payload?.length) return null;
	return <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs shadow-lg">
		{label && <div className="mb-1 font-medium text-[var(--app-muted)]">{label}</div>}
		{payload.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
			<span className="flex items-center gap-1.5 text-[var(--app-muted)]"><i className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</span>
			<strong className="tabular-nums text-[var(--app-fg)]">{item.value}</strong>
		</div>)}
	</div>;
}

export const ChartTooltip = RechartsTooltip;
