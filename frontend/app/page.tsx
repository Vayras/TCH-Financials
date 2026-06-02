'use client';

import * as React from 'react';
import { api, type Overview } from '@/lib/api';
import { inr, pct } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';

const BUCKET_DOT: Record<string, string> = {
	Exclusive: 'bg-[#a371d3]',
	Dropping: 'bg-[#d9730d]',
	Friend: 'bg-[#0f7b6c]',
	NonTCH: 'bg-[#9b9a97]'
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

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const fresh = await api.get<Overview>(`/overview/?fy=${fyStart}`);
			setData(fresh);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, [fyStart]);

	React.useEffect(() => {
		load();
	}, [load]);

	const cols = data ? (view === 'month' ? data.months : data.quarters) : [];
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
					Total billing by bucket, derived live from Commercial Tracking. Each deal lands in the
						fiscal year and month of its E-Invoice No (e.g. TCH/2526/Dec01 → Dec, FY 25-26). Add a deal there and the
					numbers below recompute on the next load.
				</p>
			</header>

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
										<th className="w-[220px]">{data.fy} Billing</th>
										{cols.map((c) => (
											<th key={c.key} className="num">
												{c.label}
											</th>
										))}
										<th className="num">FY Total</th>
									</tr>
								</thead>
								<tbody>
									{data.bucket_order.map((b) => {
										const row = data.rows[b];
										const bySel = view === 'month' ? row.by_month : row.by_quarter;
										return (
											<tr key={b}>
												<td>
													<span className="inline-flex items-center gap-2">
														<span
															className={cn(
																'h-1.5 w-1.5 rounded-full',
																BUCKET_DOT[b] ?? ''
															)}
														/>
														<span className="font-medium" style={{ color: 'var(--n-fg)' }}>
															{row.label}
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
						Buckets are derived from each creator&apos;s relationship (Exclusive / Friend / Dropping
						/ Non-TCH). A deal&apos;s month and fiscal year come from its E-Invoice No. EMW billing
						is the subset of deals where the billing entity contains &quot;EMW&quot;.
					</div>
				</>
			) : null}
		</section>
	);
}
