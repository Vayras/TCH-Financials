'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/Chart';

const config: ChartConfig = {
	emw: { label: 'EMW', color: 'var(--chart-emw)' },
	external: { label: 'External', color: 'var(--chart-external)' }
};

const compact = (value: number) => value >= 1e7 ? `₹${(value / 1e7).toFixed(1)}Cr` : value >= 1e5 ? `₹${(value / 1e5).toFixed(1)}L` : value >= 1e3 ? `₹${Math.round(value / 1e3)}K` : `₹${value}`;

export function DonutChart({ emw, external }: { emw: number; external: number }) {
	const total = Math.max(0, emw) + Math.max(0, external);
	if (!total) return <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] text-xs text-[var(--app-muted)]">No revenue split available yet.</div>;
	const data = [{ name: 'EMW', value: Math.max(0, emw), color: 'var(--chart-emw)' }, { name: 'External', value: Math.max(0, external), color: 'var(--chart-external)' }];
	return <section className="h-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5" aria-labelledby="revenue-split-title">
		<h3 id="revenue-split-title" className="text-sm font-medium text-[var(--app-fg)]">Revenue split</h3>
		<div className="relative h-[190px] w-full"><ChartContainer config={config}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="78%" paddingAngle={3} strokeWidth={0}>{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip content={<ChartTooltipContent />} formatter={(value: unknown) => compact(Number(value) || 0)} /></PieChart></ResponsiveContainer></ChartContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] uppercase tracking-wide text-[var(--app-muted)]">Total</span><strong className="text-lg tabular-nums text-[var(--app-fg)]">{compact(total)}</strong></div></div>
		<div className="flex justify-center gap-5 text-xs text-[var(--app-muted)]">{data.map((entry) => <span key={entry.name} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: entry.color }} />{entry.name}</span>)}</div>
	</section>;
}
