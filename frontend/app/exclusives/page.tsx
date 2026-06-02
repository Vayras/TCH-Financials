'use client';

import * as React from 'react';
import { api, type QuarterlyExclusive } from '@/lib/api';
import { inr } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';

function fyLabelFor(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QLABEL: Record<string, string> = {
	Q1: 'Q1 (Apr-Jun)',
	Q2: 'Q2 (Jul-Sep)',
	Q3: 'Q3 (Oct-Dec)',
	Q4: 'Q4 (Jan-Mar)'
};

function rowFor(creatorRows: QuarterlyExclusive[], q: string): QuarterlyExclusive | null {
	return creatorRows.find((r) => r.quarter === q) ?? null;
}

function sumField(
	creatorRows: QuarterlyExclusive[],
	field: keyof QuarterlyExclusive
): number {
	return creatorRows.reduce((a, r) => {
		const v = r[field];
		return a + Number(typeof v === 'number' || typeof v === 'string' ? v || 0 : 0);
	}, 0);
}

export default function ExclusivesPage() {
	const [fyStart, setFyStart] = React.useState(2025);
	const [rows, setRows] = React.useState<QuarterlyExclusive[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [creatorFilter, setCreatorFilter] = React.useState('');

	const load = React.useCallback(async () => {
		setLoading(true);
		try {
			const d = await api.get<{ rows: QuarterlyExclusive[] }>(
				`/exclusives/quarterly/?fy=${fyStart}`
			);
			setRows(d.rows);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, [fyStart]);

	React.useEffect(() => {
		load();
	}, [load]);

	const allCreators = React.useMemo(
		() => [...new Set(rows.map((r) => r.creator_name))].sort(),
		[rows]
	);

	const filteredRows = React.useMemo(
		() => (!creatorFilter ? rows : rows.filter((r) => r.creator_name === creatorFilter)),
		[rows, creatorFilter]
	);

	const grouped = React.useMemo(() => {
		const m = new Map<string, QuarterlyExclusive[]>();
		for (const r of filteredRows) {
			if (!m.has(r.creator_name)) m.set(r.creator_name, []);
			m.get(r.creator_name)!.push(r);
		}
		return Array.from(m.entries());
	}, [filteredRows]);

	const grandTotalBilling = React.useMemo(
		() =>
			filteredRows.reduce(
				(a, r) => a + Number(r.inbound_amount || 0) + Number(r.outbound_amount || 0),
				0
			),
		[filteredRows]
	);
	const grandTotalProfit = React.useMemo(
		() =>
			filteredRows.reduce(
				(a, r) => a + Number(r.inbound_tch_profit || 0) + Number(r.outbound_tch_profit || 0),
				0
			),
		[filteredRows]
	);

	return (
		<section className="space-y-6">
			<header className="space-y-2">
				<div
					className="text-[12px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
				>
					Workspace · Exclusives · {fyLabelFor(fyStart)}
				</div>
				<h1
					className="page-title text-[40px] leading-[1.15] font-bold"
					style={{ color: 'var(--n-fg)' }}
				>
					Exclusives — Quarterly Summary
				</h1>
				<p className="text-[15px] max-w-[640px]" style={{ color: 'var(--n-fg-muted)' }}>
					Derived from Commercial Tracking. One row per exclusive creator, broken out by FY
					quarter.
				</p>
			</header>

			<div
				className="flex flex-wrap items-center gap-2 pb-3"
				style={{ borderBottom: '1px solid var(--n-border)' }}
			>
				<select
					id="creator-filter"
					className="h-7 rounded px-2 pr-7 text-[13px] appearance-none bg-no-repeat bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
					style={{
						backgroundImage:
							"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2337352f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
						backgroundPosition: 'right 6px center',
						backgroundSize: '12px 12px'
					}}
					value={creatorFilter}
					onChange={(e) => setCreatorFilter(e.target.value)}
				>
					<option value="">All creators</option>
					{allCreators.map((name) => (
						<option key={name} value={name}>
							{name}
						</option>
					))}
				</select>

				<div className="ml-auto flex items-center gap-2">
					<select
						id="fy-select-excl"
						className="h-7 rounded px-2 pr-7 text-[13px] appearance-none bg-no-repeat bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
						style={{
							backgroundImage:
								"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2337352f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
							backgroundPosition: 'right 6px center',
							backgroundSize: '12px 12px'
						}}
						value={fyStart}
						onChange={(e) => setFyStart(Number(e.target.value))}
					>
						<option value={2025}>{fyLabelFor(2025)}</option>
						<option value={2026}>{fyLabelFor(2026)}</option>
						<option value={2027}>{fyLabelFor(2027)}</option>
					</select>
					<Button variant="ghost" onClick={load}>
						<Icon name="refresh" size={14} /> Refresh
					</Button>
				</div>
			</div>

			{!loading && !error && rows.length > 0 && (
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{inr(String(grandTotalBilling))}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							<span className="h-1.5 w-1.5 rounded-full bg-[#a371d3]" />
							TCH Profit
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{inr(String(grandTotalProfit))}
						</div>
					</div>
					{creatorFilter && (
						<div
							className="rounded p-3"
							style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
						>
							<div
								className="text-[11.5px] font-medium uppercase"
								style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
							>
								Filtered to
							</div>
							<div
								className="text-[16px] font-semibold mt-1"
								style={{ color: 'var(--n-fg)' }}
							>
								{creatorFilter}
							</div>
						</div>
					)}
				</div>
			)}

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
			) : (
				<div className="tbl-card">
					<div className="scroll-x">
						<table className="grid-table">
							<thead>
								<tr>
									<th>Creator</th>
									<th className="w-[110px] whitespace-nowrap">Quarter</th>
									<th className="num">In Deals</th>
									<th className="num">Inbound Invoiced</th>
									<th className="num">In Creator Fee</th>
									<th className="num">In TCH Profit</th>
									<th className="num">Out Deals</th>
									<th className="num">Outbound Invoiced</th>
									<th className="num">Out Creator Fee</th>
									<th className="num">Out TCH Profit</th>
									<th>Common Deliverable</th>
									<th>Top Brands</th>
									<th>Repeat Brands</th>
								</tr>
							</thead>
							<tbody>
								{grouped.map(([name, creatorRows]) => (
									<React.Fragment key={name}>
										{QUARTERS.map((q, qi) => {
											const r = rowFor(creatorRows, q);
											return (
												<tr key={q}>
													{qi === 0 && (
														<td
															rowSpan={5}
															className="align-top font-medium"
															style={{ color: 'var(--n-fg)' }}
														>
															{name}
														</td>
													)}
													<td
														className="whitespace-nowrap"
														style={{ color: 'var(--n-fg-muted)' }}
													>
														{QLABEL[q]}
													</td>
													<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
														{r?.inbound_count ?? 0}
													</td>
													<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
														{inr(r?.inbound_amount)}
													</td>
													<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
														{inr(r?.inbound_creator_fee)}
													</td>
													<td className="num" style={{ color: '#52298f' }}>
														{inr(r?.inbound_tch_profit)}
													</td>
													<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
														{r?.outbound_count ?? 0}
													</td>
													<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
														{inr(r?.outbound_amount)}
													</td>
													<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
														{inr(r?.outbound_creator_fee)}
													</td>
													<td className="num" style={{ color: '#52298f' }}>
														{inr(r?.outbound_tch_profit)}
													</td>
													<td style={{ color: 'var(--n-fg-muted)' }}>
														{r?.common_deliverable ?? ''}
													</td>
													<td style={{ color: 'var(--n-fg-muted)' }}>
														{r?.top_brands?.join(', ') ?? ''}
													</td>
													<td style={{ color: 'var(--n-fg-muted)' }}>
														{r?.repeat_brands?.join(', ') ?? ''}
													</td>
												</tr>
											);
										})}
										<tr className="row-total">
											<td>Total</td>
											<td className="num">{sumField(creatorRows, 'inbound_count')}</td>
											<td className="num">
												{inr(String(sumField(creatorRows, 'inbound_amount')))}
											</td>
											<td className="num">
												{inr(String(sumField(creatorRows, 'inbound_creator_fee')))}
											</td>
											<td className="num" style={{ color: '#52298f' }}>
												{inr(String(sumField(creatorRows, 'inbound_tch_profit')))}
											</td>
											<td className="num">{sumField(creatorRows, 'outbound_count')}</td>
											<td className="num">
												{inr(String(sumField(creatorRows, 'outbound_amount')))}
											</td>
											<td className="num">
												{inr(String(sumField(creatorRows, 'outbound_creator_fee')))}
											</td>
											<td className="num" style={{ color: '#52298f' }}>
												{inr(String(sumField(creatorRows, 'outbound_tch_profit')))}
											</td>
											<td colSpan={3} />
										</tr>
									</React.Fragment>
								))}
								{grouped.length === 0 && (
									<tr>
										<td
											colSpan={13}
											className="text-center py-8"
											style={{ color: 'var(--n-fg-subtle)' }}
										>
											No exclusive creator deals in this FY.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					<div className="tbl-caption">
						<span>Tip · scroll horizontally to see Out-Deal columns and brand lists.</span>
					</div>
				</div>
			)}
		</section>
	);
}
