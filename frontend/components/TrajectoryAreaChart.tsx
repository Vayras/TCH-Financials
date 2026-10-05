'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/Chart';

const config: ChartConfig = { revenue: { label: 'Cumulative revenue', color: 'var(--chart-emw)' } };
const amount = (value: string | undefined) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const compact = (value: number) =>
	value >= 1e7
		? `₹${(value / 1e7).toFixed(1)}Cr`
		: value >= 1e5
			? `₹${(value / 1e5).toFixed(1)}L`
			: value >= 1e3
				? `₹${Math.round(value / 1e3)}K`
				: `₹${value}`;

export function TrajectoryAreaChart({ cols, totals }: { cols: { key: string; label: string }[]; totals: Record<string, string> }) {
	let running = 0;
	const data = cols.map((col) => ({
		label: col.key.startsWith('Q') ? col.key : col.label.replace(' 20', ' '),
		revenue: (running += amount(totals[col.key]))
	}));

	if (!data.length || !data.some((row) => row.revenue)) {
		return (
			<div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] text-xs text-[var(--app-muted)]">
				No revenue history available yet.
			</div>
		);
	}

	const maxRevenue = Math.max(...data.map((row) => row.revenue));
	const chartMax = maxRevenue * 1.1;

	return (
		<section className="flex flex-col h-[320px] rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5" aria-labelledby="revenue-growth-title">
			<div className="mb-2 flex items-start justify-between shrink-0">
				<div>
					<h3 id="revenue-growth-title" className="text-sm font-medium text-[var(--app-fg)]">
						Total revenue (YTD)
					</h3>
					<p className="mt-0.5 text-xs text-[var(--app-muted)]">Cumulative revenue growth</p>
				</div>
				<strong className="text-base tabular-nums text-[var(--app-fg)]">{compact(data.at(-1)?.revenue ?? 0)}</strong>
			</div>
			<div className="flex-1 min-h-0 w-full">
				<ChartContainer config={config} className="h-full">
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
							<defs>
								<linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="var(--chart-emw)" stopOpacity={0.25} />
									<stop offset="100%" stopColor="var(--chart-emw)" stopOpacity={0.02} />
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} stroke="var(--app-border)" strokeDasharray="4 4" />
							<XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--app-muted)' }} />
							<YAxis domain={[0, chartMax]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--app-muted)' }} tickFormatter={compact} width={44} />
							<Tooltip content={<ChartTooltipContent />} formatter={(value: unknown) => compact(Number(value) || 0)} />
							<Area type="monotone" dataKey="revenue" name="Cumulative revenue" stroke="var(--chart-emw)" fill="url(#revenue-fill)" strokeWidth={2} />
						</AreaChart>
					</ResponsiveContainer>
				</ChartContainer>
			</div>
		</section>
	);
}
