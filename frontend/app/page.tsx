'use client';

import * as React from 'react';
import { api, type Overview, type Creator } from '@/lib/api';
import { inr, pct } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Select from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';

// FY order Apr..Mar; values match the backend's ?month= calendar months.
const MONTH_OPTIONS = [
	{ value: '4', label: 'April' },
	{ value: '5', label: 'May' },
	{ value: '6', label: 'June' },
	{ value: '7', label: 'July' },
	{ value: '8', label: 'August' },
	{ value: '9', label: 'September' },
	{ value: '10', label: 'October' },
	{ value: '11', label: 'November' },
	{ value: '12', label: 'December' },
	{ value: '1', label: 'January' },
	{ value: '2', label: 'February' },
	{ value: '3', label: 'March' }
];

const STATUS_DOT: Record<string, string> = {
	Active: 'bg-[#0f7b6c]',
	Over: 'bg-[#9b9a97]'
};

function fyLabelFor(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

export default function OverviewPage() {
	const { fyStart } = useFiscalYear();
	const [data, setData] = React.useState<Overview | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [view, setView] = React.useState<'month' | 'quarter'>('month');
	const [month, setMonth] = React.useState('');
	const [creator, setCreator] = React.useState('');
	const [creators, setCreators] = React.useState<Creator[]>([]);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({ fy: String(fyStart) });
			if (month) params.set('month', month);
			if (creator) params.set('creator', creator);
			// Cached payload renders instantly; the fresh one replaces it when
			// the network answers.
			await api.getSWR<Overview>(`/overview/?${params}`, (d) => {
				setData(d);
				setLoading(false);
			});
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, [fyStart, month, creator]);

	React.useEffect(() => {
		load();
	}, [load]);

	React.useEffect(() => {
		api.getSWR<Creator[]>('/creators/', setCreators).catch(() => {});
	}, []);

	const allCols = data ? (view === 'month' ? data.months : data.quarters) : [];
	// With a month picked the other columns are all zero — show just that one.
	const cols =
		month && view === 'month'
			? allCols.filter((c) => Number(c.key.split('-')[1]) === Number(month))
			: allCols;
	const src = data
		? view === 'month'
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
		<section className="space-y-8">
			<header className="space-y-2">
				<div
					className="text-[12px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
				>
					Dashboard · {fyLabelFor(fyStart)}
				</div>
				<h1
					className="page-title text-[40px] leading-[1.15] font-bold"
					style={{ color: 'var(--n-fg)' }}
				>
					Current Overview
				</h1>
				<p className="text-[15px] max-w-[640px]" style={{ color: 'var(--n-fg-muted)' }}>
					Total billing by campaign, derived live from Campaign Tracking. Each deal lands in the
						fiscal year and month of its E-Invoice No (e.g. TCH/2526/Dec01 → Dec, FY 25-26). Add a deal there and the
					numbers below recompute on the next load.
				</p>
			</header>

			{data && (
				<>
					{/* Campaign Status Cards */}
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
						<div
							className="rounded p-3"
							style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
						>
							<div
								className="text-[11.5px] font-medium uppercase"
								style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
							>
								Campaigns This FY
							</div>
							<div
								className="text-[28px] font-bold tabular-nums mt-1"
								style={{ color: 'var(--n-fg)' }}
							>
								{data.total_campaigns}
							</div>
						</div>
						{(['Active', 'Over'] as const).map((s) => (
							<div
								key={s}
								className="rounded p-3"
								style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
							>
								<div className="text-[11.5px] font-medium uppercase flex items-center gap-1.5" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
									<span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[s] ?? '')} />
									{s === 'Active' ? 'Active Campaigns' : 'Campaigns Over'}
								</div>
								<div
									className="text-[22px] font-semibold tabular-nums mt-1"
									style={{ color: 'var(--n-fg)' }}
								>
									{data.campaign_counts[s] ?? 0}
								</div>
							</div>
						))}
					</div>

					{/* Billing Summary Cards */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
						<div
							className="rounded p-3"
							style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
						>
							<div
								className="text-[11.5px] font-medium uppercase"
								style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
							>
								Total Billing
							</div>
							<div
								className="text-[26px] font-bold tabular-nums mt-1"
								style={{ color: 'var(--n-fg)' }}
							>
								{inr(data.totals.total)}
							</div>
						</div>
						<div
							className="rounded p-3"
							style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
						>
							<div className="text-[11.5px] font-medium uppercase flex items-center gap-1.5" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
								<span className="h-1.5 w-1.5 rounded-full bg-[#19567c]" />
								Elements (EMW)
							</div>
							<div
								className="text-[22px] font-semibold tabular-nums mt-1"
								style={{ color: 'var(--n-fg)' }}
							>
								{inr(data.emw_billing.total)}
							</div>
							<div className="text-[12px] tabular-nums mt-0.5" style={{ color: 'var(--n-fg-subtle)' }}>
								{pct(data.emw_pct.total)} of billing
							</div>
						</div>
						<div
							className="rounded p-3"
							style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
						>
							<div className="text-[11.5px] font-medium uppercase flex items-center gap-1.5" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
								<span className="h-1.5 w-1.5 rounded-full bg-[#9b9a97]" />
								External
							</div>
							<div
								className="text-[22px] font-semibold tabular-nums mt-1"
								style={{ color: 'var(--n-fg)' }}
							>
								{inr(Number(data.totals.total) - Number(data.emw_billing.total))}
							</div>
							<div className="text-[12px] tabular-nums mt-0.5" style={{ color: 'var(--n-fg-subtle)' }}>
								{pct(String(1 - Number(data.emw_pct.total)))} of billing
							</div>
						</div>
						<div
							className="rounded p-3"
							style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
						>
							<div className="text-[11.5px] font-medium uppercase flex items-center gap-1.5" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
								<span className="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]" />
								Profit (TCH Fee)
							</div>
							<div
								className="text-[22px] font-semibold tabular-nums mt-1"
								style={{ color: '#0f7b6c' }}
							>
								{inr(data.profits.total)}
							</div>
							<div className="text-[12px] tabular-nums mt-0.5" style={{ color: 'var(--n-fg-subtle)' }}>
								{pct(data.profit_pct.total)} margin
							</div>
						</div>
					</div>
				</>
			)}

			<div
				className="flex items-center gap-3 flex-wrap pb-3"
				style={{ borderBottom: '1px solid var(--n-border)' }}
			>
				<div className="seg-toggle">
					<button
						type="button"
						className={cn(view === 'month' && 'active')}
						onClick={() => setView('month')}
					>
						Month
					</button>
					<button
						type="button"
						className={cn(view === 'quarter' && 'active')}
						onClick={() => setView('quarter')}
					>
						Quarter
					</button>
				</div>

				<div className="w-[150px]">
					<Select
						value={month}
						onChange={(e) => setMonth(e.target.value)}
						options={MONTH_OPTIONS}
						placeholder="All months"
					/>
				</div>
				<div className="w-[200px]">
					<Select
						value={creator}
						onChange={(e) => setCreator(e.target.value)}
						options={creators.map((c) => ({ value: String(c.id), label: c.name }))}
						placeholder="All creators"
					/>
				</div>
				{(month || creator) && (
					<Button
						variant="ghost"
						onClick={() => {
							setMonth('');
							setCreator('');
						}}
					>
						Clear
					</Button>
				)}

				<div className="ml-auto flex items-center gap-2">
					<Button variant="ghost" onClick={load}>
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
				<>
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
										const bySel = view === 'month' ? row.by_month : row.by_quarter;
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
									<tr>
										<td>
											<span className="inline-flex items-center gap-2">
												<span className="h-1.5 w-1.5 rounded-full bg-[#19567c]" />
												<span style={{ color: 'var(--n-fg)' }}>EMW Billing</span>
											</span>
										</td>
										{cols.map((c) => (
											<td key={c.key} className="num" style={{ color: 'var(--n-fg-muted)' }}>
												{inr(src.emw[c.key]) || '—'}
											</td>
										))}
										<td className="num font-semibold" style={{ color: 'var(--n-fg)' }}>
											{inr(data.emw_billing.total)}
										</td>
									</tr>
									<tr>
										<td style={{ color: 'var(--n-fg-muted)' }}>EMW Billing %</td>
										{cols.map((c) => (
											<td key={c.key} className="num" style={{ color: 'var(--n-fg-subtle)' }}>
												{pct(src.emwPct[c.key]) || '—'}
											</td>
										))}
										<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
											{pct(data.emw_pct.total)}
										</td>
									</tr>
									<tr>
										<td>
											<span className="inline-flex items-center gap-2">
												<span className="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]" />
												<span style={{ color: 'var(--n-fg)' }}>Profits (TCH Fee)</span>
											</span>
										</td>
										{cols.map((c) => (
											<td key={c.key} className="num" style={{ color: 'var(--n-fg-muted)' }}>
												{inr(src.profits[c.key]) || '—'}
											</td>
										))}
										<td className="num font-semibold" style={{ color: 'var(--n-fg)' }}>
											{inr(data.profits.total)}
										</td>
									</tr>
									<tr>
										<td style={{ color: 'var(--n-fg-muted)' }}>Profit Ratio</td>
										{cols.map((c) => (
											<td key={c.key} className="num" style={{ color: 'var(--n-fg-subtle)' }}>
												{pct(src.profitPct[c.key]) || '—'}
											</td>
										))}
										<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
											{pct(data.profit_pct.total)}
										</td>
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
							className="flex items-center gap-3 rounded p-3 text-[13px]"
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
				</>
			) : null}
		</section>
	);
}
