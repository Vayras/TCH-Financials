'use client';

import * as React from 'react';
import { api, type EntitySummary, type EntityRow } from '@/lib/api';
import { inr } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import { useFiscalYear } from '@/lib/fiscal-year';

function fyLabelFor(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

function profitPct(row: EntityRow): string {
	const billing = Number(row.total_billing);
	const profit = Number(row.total_profit);
	if (!billing) return '—';
	return `${((profit / billing) * 100).toFixed(1)}%`;
}

export default function EntitySummaryPage() {
	const { fyStart } = useFiscalYear();
	const [entityFilter, setEntityFilter] = React.useState('');
	const [searchInput, setSearchInput] = React.useState('');
	const [data, setData] = React.useState<EntitySummary | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [expandedEntity, setExpandedEntity] = React.useState<string | null>(null);
	const [period, setPeriod] = React.useState('FY');

	const load = React.useCallback(
		async (filter: string = entityFilter, per: string = period) => {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams({ fy: String(fyStart) });
				if (filter) params.set('entity', filter);
				if (per.startsWith('Q')) params.set('quarter', per);
				else if (per !== 'FY') params.set('month', per);
				const fresh = await api.get<EntitySummary>(`/entity-summary/?${params}`);
				setData(fresh);
			} catch (e) {
				setError((e as Error).message);
			} finally {
				setLoading(false);
			}
		},
		[fyStart, entityFilter, period]
	);

	React.useEffect(() => {
		load(entityFilter, period);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fyStart, period]);

	function applyFilter() {
		const next = searchInput.trim();
		setEntityFilter(next);
		load(next, period);
	}

	function clearFilter() {
		setSearchInput('');
		setEntityFilter('');
		load('', period);
	}

	function toggleExpand(entity: string) {
		setExpandedEntity((prev) => (prev === entity ? null : entity));
	}

	return (
		<section className="space-y-6">
			<header className="space-y-2">
				<div
					className="text-[12px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
				>
					Workspace · Entity Summary · {fyLabelFor(fyStart)}
				</div>
				<h1
					className="page-title text-[40px] leading-[1.15] font-bold"
					style={{ color: 'var(--n-fg)' }}
				>
					Billing Entity Summary
				</h1>
				<p className="text-[15px] max-w-[640px]" style={{ color: 'var(--n-fg-muted)' }}>
					Total billing and TCH profit grouped by billing entity. Auto-calculated from
					Commercial Tracking. Use the period selector to drill into a quarter or month.
				</p>
			</header>

			<div
				className="flex flex-wrap items-center gap-2 pb-3"
				style={{ borderBottom: '1px solid var(--n-border)' }}
			>
				<div className="relative flex-1 min-w-[260px]">
					<span
						className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
						style={{ color: 'var(--n-fg-subtle)' }}
					>
						<Icon name="search" size={14} />
					</span>
					<input
						type="text"
						placeholder="Filter by entity name…"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						className="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
						onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
					/>
				</div>
				<Button variant="outline" onClick={applyFilter}>
					Filter
				</Button>
				{entityFilter && (
					<Button variant="ghost" onClick={clearFilter}>
						Clear
					</Button>
				)}
				<div className="min-w-[160px]">
					<Select
						value={period}
						onChange={(e) => setPeriod(e.target.value)}
						options={[
							{ value: 'FY', label: 'Full Year' },
							{ value: 'Q1', label: 'Q1 (Apr-Jun)' },
							{ value: 'Q2', label: 'Q2 (Jul-Sep)' },
							{ value: 'Q3', label: 'Q3 (Oct-Dec)' },
							{ value: 'Q4', label: 'Q4 (Jan-Mar)' },
							{ value: '04', label: 'April' },
							{ value: '05', label: 'May' },
							{ value: '06', label: 'June' },
							{ value: '07', label: 'July' },
							{ value: '08', label: 'August' },
							{ value: '09', label: 'September' },
							{ value: '10', label: 'October' },
							{ value: '11', label: 'November' },
							{ value: '12', label: 'December' },
							{ value: '01', label: 'January' },
							{ value: '02', label: 'February' },
							{ value: '03', label: 'March' },
						]}
					/>
				</div>

				<div className="ml-auto flex items-center gap-2">
					<Button variant="ghost" onClick={() => load(entityFilter, period)}>
						<Icon name="refresh" size={14} /> Refresh
					</Button>
				</div>
			</div>

			{!loading && !error && data && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							{entityFilter ? `"${entityFilter}" Billing` : 'Total Billing'}
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{inr(data.grand_total_billing)}
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
							<span className="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]" />
							TCH Profit
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{inr(data.grand_total_profit)}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Entities
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{data.entities.length}
						</div>
					</div>
					{entityFilter && (
						<div
							className="rounded p-3"
							style={{
								border: '1px solid var(--n-accent)',
								background: 'var(--n-accent-soft)'
							}}
						>
							<div
								className="text-[11.5px] font-medium uppercase"
								style={{ color: 'var(--n-accent)', letterSpacing: '0.04em' }}
							>
								Filter Active
							</div>
							<div
								className="text-[15px] font-semibold mt-1"
								style={{ color: 'var(--n-fg)' }}
							>
								{entityFilter}
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
			) : data ? (
				<div className="tbl-card">
					<div className="scroll-x">
						<table className="grid-table">
							<thead>
								<tr>
									<th className="w-6" />
									<th>Billing Entity</th>
									<th className="num">Deals</th>
									<th className="num">Total Billing</th>
									<th className="num">TCH Profit</th>
									<th className="num">Profit %</th>
									<th className="num">Campaigns</th>
									<th className="num">Creators</th>
									<th>Top Brands</th>
								</tr>
							</thead>
							<tbody>
								{data.entities.map((row) => (
									<React.Fragment key={row.entity}>
										<tr
											className="cursor-pointer"
											onClick={() => toggleExpand(row.entity)}
										>
											<td
												className="text-center select-none"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												{expandedEntity === row.entity ? '▾' : '▸'}
											</td>
											<td className="font-medium" style={{ color: 'var(--n-fg)' }}>
												{row.entity}
												{row.deal_count === 1 && (
													<Tag tone="neutral" className="ml-2">low activity</Tag>
												)}
											</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
												{row.deal_count}
											</td>
											<td
												className="num tabular-nums"
												style={{ color: 'var(--n-fg)' }}
											>
												{inr(row.total_billing)}
											</td>
											<td
												className="num font-semibold tabular-nums"
												style={{ color: '#1f6f43' }}
											>
												{inr(row.total_profit)}
											</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
												{profitPct(row)}
											</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
												{row.campaign_count}
											</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>
												{row.creator_count}
											</td>
											<td className="text-[13px]" style={{ color: 'var(--n-fg-muted)' }}>
												{row.top_brands.join(', ')}
											</td>
										</tr>
										{expandedEntity === row.entity && (
											<tr style={{ background: 'var(--n-bg-soft)' }}>
												<td />
												<td colSpan={8} className="py-3 px-4">
													<div
														className="text-[11.5px] font-medium uppercase mb-2"
														style={{
															color: 'var(--n-fg-subtle)',
															letterSpacing: '0.04em'
														}}
													>
														Campaigns billed under this entity
													</div>
													<div className="flex flex-wrap gap-1.5">
														{row.campaigns.map((c) => (
															<Tag key={c} tone="accent">
																{c}
															</Tag>
														))}
														{row.campaigns.length === 0 && (
															<span
																className="text-[13px]"
																style={{ color: 'var(--n-fg-subtle)' }}
															>
																No linked campaigns
															</span>
														)}
													</div>
													<div
														className="text-[11.5px] font-medium uppercase mb-2 mt-3"
														style={{
															color: 'var(--n-fg-subtle)',
															letterSpacing: '0.04em'
														}}
													>
														Creators involved
													</div>
													<div className="flex flex-wrap gap-1.5">
														{row.creators.map((c) => (
															<Tag key={c} tone="neutral">
																{c}
															</Tag>
														))}
														{row.creators.length === 0 && (
															<span
																className="text-[13px]"
																style={{ color: 'var(--n-fg-subtle)' }}
															>
																No linked creators
															</span>
														)}
													</div>
												</td>
											</tr>
										)}
									</React.Fragment>
								))}
								{data.entities.length === 0 ? (
									<tr>
										<td
											colSpan={9}
											className="text-center py-8"
											style={{ color: 'var(--n-fg-subtle)' }}
										>
											No entity data for this FY
											{entityFilter ? ` matching "${entityFilter}"` : ''}.
										</td>
									</tr>
								) : (
									<tr className="row-total">
										<td />
										<td>Grand Total</td>
										<td className="num">
											{data.entities.reduce((a, r) => a + r.deal_count, 0)}
										</td>
										<td className="num">{inr(data.grand_total_billing)}</td>
										<td className="num" style={{ color: '#1f6f43' }}>
											{inr(data.grand_total_profit)}
										</td>
										<td className="num">
											{Number(data.grand_total_billing)
												? `${(
														(Number(data.grand_total_profit) /
															Number(data.grand_total_billing)) *
														100
													).toFixed(1)}%`
												: '—'}
										</td>
										<td colSpan={3} />
									</tr>
								)}
							</tbody>
						</table>
					</div>
					<div className="tbl-caption">
						<span>Tip · click a row to expand campaigns and creators linked to that billing entity.</span>
					</div>
				</div>
			) : null}
		</section>
	);
}
