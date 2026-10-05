'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/Chart';

export interface BillingBarChartProps {
	cols: { key: string; label: string }[];
	totals: Record<string, string>;
	emw: Record<string, string>;
	profits: Record<string, string>;
	emwPct: Record<string, string>;
	profitPct: Record<string, string>;
}

const config: ChartConfig = {
	emw: { label: 'EMW retained', color: 'var(--chart-emw)' },
	external: { label: 'Third-party payouts', color: 'var(--chart-external)' },
	profit: { label: 'Agency margin', color: 'var(--chart-profit)' }
};

const amount = (value: string | undefined) => Number.isFinite(Number(value)) ? Number(value) : 0;
const compact = (value: number) => value >= 1e7 ? `₹${(value / 1e7).toFixed(1)}Cr` : value >= 1e5 ? `₹${(value / 1e5).toFixed(1)}L` : value >= 1e3 ? `₹${Math.round(value / 1e3)}K` : `₹${value}`;

export default function BillingBarChart({ cols, totals, emw, profits }: BillingBarChartProps) {
	const data = cols.map((col) => {
		const total = amount(totals[col.key]);
		const retained = Math.min(amount(emw[col.key]), total);
		return { label: col.key.startsWith('Q') ? col.key : col.label.replace(' 20', ' '), emw: retained, external: Math.max(0, total - retained), profit: amount(profits[col.key]) };
	});
	if (!data.some((row) => row.emw || row.external || row.profit)) return <div className="rounded-lg border border-dashed border-[var(--app-border)] p-8 text-center text-xs text-[var(--app-muted)]">No invoiced billing in this period yet.</div>;
	return <ChartContainer config={config} className="h-[300px]">
		<ResponsiveContainer width="100%" height="100%">
			<BarChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 8 }}>
				<CartesianGrid vertical={false} stroke="var(--app-border)" strokeDasharray="4 4" />
				<XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--app-muted)' }} />
				<YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--app-muted)' }} tickFormatter={compact} width={48} />
				<Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--app-surface-muted)' }} formatter={(value: unknown) => compact(Number(value) || 0)} />
				<Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--app-muted)' }} />
				<Bar dataKey="emw" name="EMW retained" stackId="billing" fill="var(--chart-emw)" radius={[0, 0, 3, 3]} />
				<Bar dataKey="external" name="Third-party payouts" stackId="billing" fill="var(--chart-external)" radius={[3, 3, 0, 0]} />
				<Bar dataKey="profit" name="Agency margin" fill="var(--chart-profit)" radius={[3, 3, 0, 0]} />
			</BarChart>
		</ResponsiveContainer>
	</ChartContainer>;
}
