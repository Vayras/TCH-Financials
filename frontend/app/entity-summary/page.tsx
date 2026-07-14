'use client';

import * as React from 'react';
import { type EntityRow } from '@/lib/api';
import { inr } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import { useFiscalYear } from '@/lib/fiscal-year';
import { useEntitySummaryQuery } from './queries';

function fyLabelFor(start: number | null): string {
	if (start === null) return '…';
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

function profitPct(billing: string | number, profit: string | number): string {
	const b = Number(billing);
	const p = Number(profit);
	if (!b) return '—';
	return `${((p / b) * 100).toFixed(1)}%`;
}

const PERIOD_OPTIONS = [
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
];

export default function EntitySummaryPage() {
	const { fyStart, fyOptions } = useFiscalYear();

	// Local FY override — syncs with the global selector but can be pointed
	// at any past year independently without changing the site-wide context.
	const [fy, setFy] = React.useState<number | null>(fyStart);
	React.useEffect(() => {
		if (fyStart !== null) setFy(fyStart);
	}, [fyStart]);

	const [period, setPeriod] = React.useState('FY');
	const [searchInput, setSearchInput] = React.useState('');
	// The committed filter — only updates on Filter/Enter, driving the query key.
	const [entityFilter, setEntityFilter] = React.useState('');
	const [expandedEntity, setExpandedEntity] = React.useState<string | null>(null);

	const { data, isLoading, error, refetch } = useEntitySummaryQuery(fy, entityFilter, period);

	function applyFilter() {
		const next = searchInput.trim();
		setEntityFilter(next);
	}

	function clearFilter() {
		setSearchInput('');
		setEntityFilter('');
	}

	function toggleExpand(entity: string) {
		setExpandedEntity((prev) => (prev === entity ? null : entity));
	}

	// Widen picker to include past years not in the global selector
	const fyPickerOptions = React.useMemo(() => {
		const pastYears = [2023, 2024].filter((y) => !fyOptions.includes(y));
		return [...pastYears, ...fyOptions].sort((a, b) => a - b);
	}, [fyOptions]);

	return (
		<section className="space-y-6">
			<header className="space-y-2">
				<div
					className="text-[12px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
				>
					Workspace · Entity Summary · {fyLabelFor(fy)}
				</div>
				<h1
					className="page-title text-[28px] leading-[1.2] font-bold"
					style={{ color: 'var(--n-fg)' }}
				>
					Billing Entity Summary
				</h1>
				<p className="text-[15px] max-w-[640px]" style={{ color: 'var(--n-fg-muted)' }}>
					Total billing and TCH profit grouped by billing entity. Auto-calculated from
					Commercial Tracking. Use the period selector to drill into a quarter or month.
				</p>
			</header>

			{/* Toolbar */}
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
						onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
						className="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
					/>
				</div>
				<Button variant="outline" onClick={applyFilter}>Filter</Button>
				{entityFilter && (
					<Button variant="ghost" onClick={clearFilter}>Clear</Button>
				)}

				{/* Local FY picker — wider range than the global sidebar selector */}
				<div className="min-w-[130px]">
					<Select
						value={String(fy ?? '')}
						onChange={(e) => setFy(Number(e.target.value))}
						options={fyPickerOptions.map((y) => ({ value: String(y), label: fyLabelFor(y) }))}
					/>
				</div>

				<div className="min-w-[160px]">
					<Select
						value={period}
						onChange={(e) => setPeriod(e.target.value)}
						options={PERIOD_OPTIONS}
					/>
				</div>

				<div className="ml-auto">
					<Button variant="ghost" onClick={() => refetch()}>
						<Icon name="refresh" size={14} /> Refresh
					</Button>
				</div>
			</div>

			{/* Summary cards */}
			{!isLoading && !error && data && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					<SummaryCard
						label={entityFilter ? `"${entityFilter}" Billing` : 'Total Billing'}
						value={inr(data.grand_total_billing)}
					/>
					<SummaryCard
						label="TCH Profit"
						value={inr(data.grand_total_profit)}
						dot="#0f7b6c"
					/>
					<SummaryCard label="Entities" value={String(data.entities.length)} />
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
							<div className="text-[15px] font-semibold mt-1" style={{ color: 'var(--n-fg)' }}>
								{entityFilter}
							</div>
						</div>
					)}
				</div>
			)}

			{/* Table / states */}
			{isLoading ? (
				<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
					Loading…
				</div>
			) : error ? (
				<div
					className="text-[14px] rounded p-3"
					style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
				>
					Error: {error.message}
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
										<tr className="cursor-pointer" onClick={() => toggleExpand(row.entity)}>
											<td className="text-center select-none" style={{ color: 'var(--n-fg-subtle)' }}>
												{expandedEntity === row.entity ? '▾' : '▸'}
											</td>
											<td className="font-medium" style={{ color: 'var(--n-fg)' }}>
												{row.entity}
												{row.deal_count === 1 && (
													<Tag tone="neutral" className="ml-2">low activity</Tag>
												)}
											</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>{row.deal_count}</td>
											<td className="num tabular-nums" style={{ color: 'var(--n-fg)' }}>{inr(row.total_billing)}</td>
											<td className="num font-semibold tabular-nums" style={{ color: '#1f6f43' }}>{inr(row.total_profit)}</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>{profitPct(row.total_billing, row.total_profit)}</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>{row.campaign_count}</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>{row.creator_count}</td>
											<td className="text-[13px]" style={{ color: 'var(--n-fg-muted)' }}>{row.top_brands.join(', ')}</td>
										</tr>
										{expandedEntity === row.entity && (
											<ExpandedRow row={row} />
										)}
									</React.Fragment>
								))}
								{data.entities.length === 0 ? (
									<tr>
										<td colSpan={9} className="text-center py-8" style={{ color: 'var(--n-fg-subtle)' }}>
											No entity data for this FY{entityFilter ? ` matching "${entityFilter}"` : ''}.
										</td>
									</tr>
								) : (
									<tr className="row-total">
										<td />
										<td>Grand Total</td>
										<td className="num">{data.entities.reduce((a, r) => a + r.deal_count, 0)}</td>
										<td className="num">{inr(data.grand_total_billing)}</td>
										<td className="num" style={{ color: '#1f6f43' }}>{inr(data.grand_total_profit)}</td>
										<td className="num">{profitPct(data.grand_total_billing, data.grand_total_profit)}</td>
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

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, dot }: { label: string; value: string; dot?: string }) {
	return (
		<div className="rounded p-3" style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}>
			<div
				className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
				style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
			>
				{dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
				{label}
			</div>
			<div className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: 'var(--n-fg)' }}>
				{value}
			</div>
		</div>
	);
}

function ExpandedRow({ row }: { row: EntityRow }) {
	return (
		<tr style={{ background: 'var(--n-bg-soft)' }}>
			<td />
			<td colSpan={8} className="py-3 px-4">
				<TagGroup label="Campaigns billed under this entity" items={row.campaigns} tone="accent" />
				<TagGroup label="Creators involved" items={row.creators} tone="neutral" className="mt-3" />
			</td>
		</tr>
	);
}

function TagGroup({
	label,
	items,
	tone,
	className,
}: {
	label: string;
	items: string[];
	tone: 'accent' | 'neutral';
	className?: string;
}) {
	return (
		<div className={className}>
			<div
				className="text-[11.5px] font-medium uppercase mb-2"
				style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
			>
				{label}
			</div>
			<div className="flex flex-wrap gap-1.5">
				{items.length > 0 ? (
					items.map((c) => <Tag key={c} tone={tone}>{c}</Tag>)
				) : (
					<span className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
						No linked {tone === 'accent' ? 'campaigns' : 'creators'}
					</span>
				)}
			</div>
		</div>
	);
}
