'use client';

import * as React from 'react';
import styles from './summary.module.css';
import QueryErrorState from '@/components/QueryErrorState';
import { type EntityRow } from '@/lib/api';
import { inr } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Link from 'next/link';
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
	const { fyStart: fy } = useFiscalYear();

	const [period, setPeriod] = React.useState('FY');
	const [searchInput, setSearchInput] = React.useState('');
    const [expandedEntity, setExpandedEntity] = React.useState<string | null>(null);
    const { data, isLoading, error, refetch } = useEntitySummaryQuery(fy, '', period);
    const entityFilter = searchInput.trim();
    const visibleRows = data?.entities.filter(row => row.entity.toLowerCase().includes(entityFilter.toLowerCase())) ?? [];
    const billing = visibleRows.reduce((n,row) => n + Number(row.total_billing), 0);
    const margin = visibleRows.reduce((n,row) => n + Number(row.total_profit), 0);
	function toggleExpand(entity: string) {
		setExpandedEntity((prev) => (prev === entity ? null : entity));
	}

	return (
		<section className={styles.workspace}>
            <header><h1>Billing entities</h1><p>Bookings and agency margin by billing entity · {fyLabelFor(fy)}</p></header>

			{/* Toolbar */}
			<div
				className={styles.toolbar}
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
						aria-label="Filter by entity name"
                        placeholder="Filter by entity name…"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						className="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
					/>
				</div>
                {entityFilter && <Button variant="ghost" onClick={() => setSearchInput('')}>Clear</Button>}

				<div className="min-w-[160px]">
					<Select
						aria-label="Reporting period"
                        value={period}
						onChange={(e) => setPeriod(e.target.value)}
						options={PERIOD_OPTIONS}
					/>
				</div>

				<div className="ml-auto">
					<Button variant="outline" disabled={isLoading} onClick={() => refetch()}>
						<Icon name="refresh" size={14} /> Refresh
					</Button>
				</div>
			</div>

			{/* Summary cards */}
			{!isLoading && !error && data && (
				<div className={styles.metrics}>
					<SummaryCard
						label={entityFilter ? `"${entityFilter}" bookings` : 'Total bookings'}
						value={`₹${inr(billing) || '0'}`}
					/>
					<SummaryCard
						label="Agency margin"
						value={`₹${inr(margin) || '0'}`}
						dot="#0f7b6c"
					/>
					<SummaryCard label="Entities" value={String(visibleRows.length)} />
                    <SummaryCard label="Margin rate" value={profitPct(billing, margin)} />
				</div>
			)}

			{/* Table / states */}
			{isLoading ? (
				<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
					Loading…
				</div>
			) : error ? (
				<QueryErrorState description="The entity summary could not be loaded right now." onRetry={() => refetch()} />
			) : data ? (
				<div className="tbl-card">
					<div className="scroll-x">
						<table className="grid-table">
							<thead>
								<tr>
									<th className="w-6" />
									<th>Billing Entity</th>
									<th className="num">Deals</th>
									<th className="num">Bookings</th>
									<th className="num">Agency margin</th>
									<th className="num">Margin %</th>



								</tr>
							</thead>
							<tbody>
								{visibleRows.map((row) => (
									<React.Fragment key={row.entity}>
										<tr className="cursor-pointer" onClick={() => toggleExpand(row.entity)}>
											<td className="text-center select-none" style={{ color: 'var(--n-fg-subtle)' }}>
												<button type="button" className={styles.expand} aria-label={`View deals for ${row.entity}`} aria-expanded={expandedEntity === row.entity} onClick={(e) => {e.stopPropagation();toggleExpand(row.entity);}}><Icon name="chevron-right" size={16} className={expandedEntity === row.entity ? 'rotate-90' : ''} /></button>
											</td>
											<td className="font-medium" style={{ color: 'var(--n-fg)' }}>
												{row.entity}

											</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>{row.deal_count}</td>
											<td className="num tabular-nums" style={{ color: 'var(--n-fg)' }}>{`₹${inr(row.total_billing) || '0'}`}</td>
											<td className="num font-semibold tabular-nums" style={{ color: 'var(--color-success)' }}>{`₹${inr(row.total_profit) || '0'}`}</td>
											<td className="num" style={{ color: 'var(--n-fg-muted)' }}>{profitPct(row.total_billing, row.total_profit)}</td>



										</tr>
										{expandedEntity === row.entity && (
											<ExpandedRow row={row} />
										)}
									</React.Fragment>
								))}
								{visibleRows.length === 0 ? (
									<tr>
										<td colSpan={6} className="text-center py-8" style={{ color: 'var(--n-fg-subtle)' }}>
											No entity data for this reporting period{entityFilter ? ` matching "${entityFilter}"` : ''}.
										</td>
									</tr>
								) : (
									<tr className="row-total">
										<td />
										<td>Grand Total</td>
										<td className="num">{visibleRows.reduce((a, r) => a + r.deal_count, 0)}</td>
										<td className="num">{`₹${inr(billing) || '0'}`}</td>
										<td className="num" style={{ color: 'var(--color-success)' }}>{`₹${inr(margin) || '0'}`}</td>
										<td className="num">{profitPct(billing, margin)}</td>

									</tr>
								)}
							</tbody>
						</table>
					</div>
					<div className="tbl-caption">
						<span>Expand an entity to see the deals behind its totals. Entity names reflect the names entered on deals.</span>
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
 return <tr className={styles.detailsRow}><td colSpan={6}>
  <div className={styles.detailHeader}>{row.deal_count} deal{row.deal_count === 1 ? '' : 's'} · {row.campaign_count} campaign{row.campaign_count === 1 ? '' : 's'} · {row.creator_count} creator{row.creator_count === 1 ? '' : 's'}</div>
  <table className={styles.dealTable}><caption className="sr-only">Deals billed under {row.entity}</caption><thead><tr><th>Campaign</th><th>Brand</th><th>Creators</th><th className="num">Bookings</th><th className="num">Agency margin</th><th /></tr></thead><tbody>{row.deals.map(deal=><tr key={deal.id}><td>{deal.campaign || 'No campaign'}</td><td>{deal.brand || '—'}</td><td>{deal.creators.join(', ') || '—'}</td><td className="num">₹{inr(deal.bookings) || '0'}</td><td className="num">₹{inr(deal.agency_margin) || '0'}</td><td><Link href={`/commercial/${deal.id}/`}>Open deal →</Link></td></tr>)}</tbody></table>
 </td></tr>;
}
