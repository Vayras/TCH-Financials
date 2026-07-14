'use client';

import * as React from 'react';
import { inr, pct } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Select from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';
import BillingBarChart from '@/components/BillingBarChart';
import MetricCard from '@/components/MetricCard';
import { useOverviewQuery, useOverviewCreatorsQuery } from './queries';

const STATUS_DOT: Record<string, string> = {
	Active: 'bg-[#0f7b6c]',
	Over: 'bg-[#9b9a97]'
};

function fyLabelFor(start: number | null): string {
	if (start === null) return '…';
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

export default function OverviewPage() {
	const { fyStart } = useFiscalYear();
	const [creatorFilter, setCreatorFilter] = React.useState('All');

	const { data, isLoading: overviewLoading, error: overviewError, refetch } = useOverviewQuery(fyStart, creatorFilter);
	const { data: creators = [], isLoading: creatorsLoading } = useOverviewCreatorsQuery();

	const loading = overviewLoading || creatorsLoading;
	const error = overviewError ? overviewError.message : null;

	const [view, setView] = React.useState<'month' | 'quarter'>('month');
	const [monthFilter, setMonthFilter] = React.useState('All');

	const monthActive = monthFilter !== 'All';
	const effView: 'month' | 'quarter' = monthActive ? 'month' : view;
	const allCols = data ? (effView === 'month' ? data.months : data.quarters) : [];
	const cols = monthActive ? allCols.filter((c) => c.key === monthFilter) : allCols;
	const src = data
		? effView === 'month'
			? {
				totals: data.totals.by_month,
				emw: data.emw_billing.by_month,
				profits: data.profits.by_month,
				emwPct: data.emw_pct.by_month,
				profitPct: data.profit_pct.by_month
			}
			: {
				totals: data.totals.by_quarter,
				emw: data.emw_billing.by_quarter,
				profits: data.profits.by_quarter,
				emwPct: data.emw_pct.by_quarter,
				profitPct: data.profit_pct.by_quarter
			}
		: null;

	return (
		<section className="space-y-6">
			<header className="space-y-2">
				<div
					className="text-[12px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
				>
					Dashboard · {fyLabelFor(fyStart)}
				</div>
				<h1
					className="page-title text-[28px] leading-[1.2] font-bold"
					style={{ color: 'var(--n-fg)' }}
				>
					Current Overview
				</h1>
				<p className="text-[15px] max-w-[640px]" style={{ color: 'var(--n-fg-muted)' }}>
					Total billing by campaign, derived live from Campaign Tracking. Each deal lands in the
					fiscal year and month of its E-Invoice No (e.g. TCH/2526/Dec01 → Dec, FY 25-26).
				</p>
			</header>

			{data && (
				<div className="space-y-6">
					{/* Key Metrics Section */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						{/* Financial Summary */}
						<div className="md:col-span-2 grid grid-cols-2 gap-2">
							<div className="col-span-full">
								<HeroMetricCard
									label="Total Billing"
									value={inr(data.totals.total)}
								/>
							</div>
							<MetricCard
								label="Elements (EMW)"
								dotColor="#1a63a3"
								value={
									<div className="flex flex-col">
										<span>{inr(data.emw_billing.total)}</span>
										<span className="text-[12px] font-normal mt-1" style={{ color: 'var(--n-fg-subtle)' }}>
											{pct(data.emw_pct.total)} of billing
										</span>
									</div>
								}
							/>
							<MetricCard
								label="External Billing"
								dotColor="#9b9a97"
								value={
									<div className="flex flex-col">
										<span>{inr(Number(data.totals.total) - Number(data.emw_billing.total))}</span>
										<span className="text-[12px] font-normal mt-1" style={{ color: 'var(--n-fg-subtle)' }}>
											{pct(String(1 - Number(data.emw_pct.total)))} of billing
										</span>
									</div>
								}
							/>
						</div>

						{/* Operational Metrics & Net Margin */}
						<div className="flex flex-col gap-2">
							<MetricCard
								label="Net Margin (TCH Fee)"
								dotColor="#0d9070"
								valueColor="#0d9070"
								value={
									<div className="flex flex-col">
										<span>{inr(data.profits.total)}</span>
										<span className="text-[12px] font-normal mt-1" style={{ color: 'var(--n-fg-subtle)' }}>
											{pct(data.profit_pct.total)} profit margin
										</span>
									</div>
								}
							/>
							<div className="grid grid-cols-3 gap-2 flex-1">
								<MiniMetricCard
									label="Total"
									value={data.total_campaigns}
								/>
								<MiniMetricCard
									label="Active"
									value={data.campaign_counts.Active ?? 0}
									dotColor="#0f7b6c"
								/>
								<MiniMetricCard
									label="Over"
									value={data.campaign_counts.Over ?? 0}
									dotColor="#9b9a97"
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Filters Toolbar */}
			<div
				className="flex items-center gap-3 flex-wrap pb-3"
				style={{ borderBottom: '1px solid var(--n-border)' }}
			>
				<div className="seg-toggle" title={monthActive ? 'Clear the month filter to switch to quarter view' : undefined}>
					<button
						type="button"
						className={cn(view === 'month' && 'active')}
						onClick={() => setView('month')}
						disabled={monthActive}
					>
						Month
					</button>
					<button
						type="button"
						className={cn(view === 'quarter' && 'active')}
						onClick={() => setView('quarter')}
						disabled={monthActive}
					>
						Quarter
					</button>
				</div>

				<div className="flex items-center gap-2 min-w-[150px]">
					<span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--n-fg-muted)' }}>Month</span>
					<Select
						value={monthFilter}
						onChange={(e) => setMonthFilter(e.target.value)}
						options={[
							{ value: 'All', label: 'All months' },
							...(data?.months ?? []).map((m) => ({ value: m.key, label: m.label }))
						]}
					/>
				</div>

				<div className="flex items-center gap-2 min-w-[180px]">
					<span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--n-fg-muted)' }}>Creator</span>
					<Select
						value={creatorFilter}
						onChange={(e) => setCreatorFilter(e.target.value)}
						options={[
							{ value: 'All', label: 'All creators' },
							...creators.map((c) => ({ value: c.name, label: c.name }))
						]}
					/>
				</div>

				<div className="ml-auto flex items-center gap-2">
					{(monthActive || creatorFilter !== 'All') && (
						<Button
							variant="ghost"
							onClick={() => {
								setMonthFilter('All');
								setCreatorFilter('All');
							}}
						>
							Clear filters
						</Button>
					)}
					<Button variant="ghost" onClick={() => refetch()}>
						<Icon name="refresh" size={14} /> Refresh
					</Button>
				</div>
			</div>

			{loading ? (
				<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
					Loading…
				</div>
			) : error ? (
				<div
					className="text-[14px] rounded p-3"
					style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
				>
					Error: {error}
				</div>
			) : data && src ? (
				<div className="space-y-6">
					{/* Billing Chart */}
					<div
						className="rounded-lg p-4"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<BillingBarChart
							cols={cols}
							totals={src.totals}
							emw={src.emw}
							profits={src.profits}
							emwPct={src.emwPct}
							profitPct={src.profitPct}
						/>
					</div>

					{/* Campaign Details Table */}
					<div className="tbl-card">
						<div className="scroll-x">
							<table className="grid-table with-sticky-first">
								<thead>
									<tr>
										<th className="w-[220px]">{data.fy} · Campaign</th>
										{cols.map((c) => (
											<th key={c.key} className="num">
												{c.label}
											</th>
										))}
										<th className="num">FY Total</th>
									</tr>
								</thead>
								<tbody>
									{data.rows.map((row) => {
										const bySel = effView === 'month' ? row.by_month : row.by_quarter;
										return (
											<tr key={row.campaign_id ?? 'none'}>
												<td>
													<span className="inline-flex items-center gap-2">
														<span
															className={cn(
																'h-1.5 w-1.5 rounded-full shrink-0',
																STATUS_DOT[row.status] ?? 'bg-[#d9730d]'
															)}
															title={row.status || 'No campaign'}
														/>
														<span className="min-w-0">
															<span className="font-medium block truncate max-w-[200px]" style={{ color: 'var(--n-fg)' }} title={row.name}>
																{row.name}
															</span>
															<span className="text-[12px] block truncate max-w-[200px]" style={{ color: 'var(--n-fg-subtle)' }}>
																{[row.brand, row.creators.join(', ')].filter(Boolean).join(' · ')}
															</span>
														</span>
													</span>
												</td>
												{cols.map((c) => (
													<td
														key={c.key}
														className="num"
														style={{ color: 'var(--n-fg-muted)' }}
													>
														{inr(bySel[c.key]) || '—'}
													</td>
												))}
												<td className="num font-semibold" style={{ color: 'var(--n-fg)' }}>
													{inr(row.total)}
												</td>
											</tr>
										);
									})}

									<tr className="row-total">
										<td>Total Billing</td>
										{cols.map((c) => (
											<td key={c.key} className="num">
												{inr(src.totals[c.key]) || '—'}
											</td>
										))}
										<td className="num">{inr(data.totals.total)}</td>
									</tr>
								</tbody>
							</table>
						</div>
						<div className="tbl-caption">
							<span>Tip · scroll horizontally to see more months when the table overflows.</span>
						</div>
					</div>

					{data.not_invoiced.count > 0 && (
						<div
							className="flex items-center gap-3 rounded-lg p-3 text-[13px]"
							style={{
								background: 'var(--n-bg-soft)',
								border: '1px solid var(--n-border)',
								color: 'var(--n-fg-muted)'
							}}
						>
							<span className="h-1.5 w-1.5 rounded-full bg-[#9b9a97]" />
							<span>
								<span className="font-medium" style={{ color: 'var(--n-fg)' }}>
									Not yet invoiced — {data.not_invoiced.count} deal
									{data.not_invoiced.count === 1 ? '' : 's'}
								</span>{' '}
								· {inr(data.not_invoiced.total_fee)} billing, {inr(data.not_invoiced.profit)}{' '}
								profit. No E-Invoice No yet, so these are not assigned to any fiscal year above.
							</span>
						</div>
					)}

					<div className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
						Each row is a campaign; its status dot is green while active and grey once over
						(derived from the campaign&apos;s deals). Creators appear under the campaign name as a
						supporting dimension. A deal&apos;s month and fiscal year come from its E-Invoice No.
						EMW billing is the subset of deals where the billing entity contains &quot;EMW&quot;.
					</div>
				</div>
			) : null}
		</section>
	);
}

// ── Design System Sub-components ───────────────────────────────────────────

function HeroMetricCard({ label, value }: { label: string; value: string }) {
	return (
		<div
			className="rounded-lg p-4 flex flex-col justify-between"
			style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
		>
			<div
				className="text-[11.5px] font-semibold uppercase"
				style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
			>
				{label}
			</div>
			<div
				className="text-[30px] font-bold tabular-nums tracking-tight mt-2 leading-none"
				style={{ color: 'var(--n-fg)' }}
			>
				{value}
			</div>
		</div>
	);
}

function MiniMetricCard({ label, value, dotColor }: { label: string; value: number; dotColor?: string }) {
	return (
		<div
			className="rounded p-2 flex flex-col justify-between items-center text-center"
			style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg-soft)' }}
		>
			<div className="flex items-center gap-1">
				{dotColor && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />}
				<div
					className="text-[10px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
				>
					{label}
				</div>
			</div>
			<div
				className="text-[18px] font-bold tabular-nums mt-1 leading-none"
				style={{ color: 'var(--n-fg)' }}
			>
				{value}
			</div>
		</div>
	);
}
