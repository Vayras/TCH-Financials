'use client';

import * as React from 'react';
import Link from 'next/link';
import { useDealsQuery, useTdsEntriesQuery } from '../payments/queries';
import { useOverviewQuery } from '../queries';
import { useFiscalYear } from '@/lib/fiscal-year';
import { inr } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
import QueryErrorState from '@/components/QueryErrorState';
import Skeleton from '@/components/ui/Skeleton';
import styles from '../overview.module.css';

export default function AccountsDashboardPage() {
	const { fyStart } = useFiscalYear();

	// Load financial totals
	const { data: overview, isLoading: overviewLoading, error: overviewError, refetch: refetchOverview } = useOverviewQuery(fyStart, 'All');

	// Load deals for campaign cost aggregation
	const { data: deals = [], isLoading: dealsLoading } = useDealsQuery(fyStart);

	// Load TDS withholdings
	const { data: tdsEntries = [], isLoading: tdsLoading } = useTdsEntriesQuery();

	const loading = overviewLoading || dealsLoading || tdsLoading;

	// Calculate quarterly/statutory TDS totals
	const tdsSummary = React.useMemo(() => {
		let remitted = 0;
		let pending = 0;
		for (const entry of tdsEntries) {
			const amount = Number(entry.tdsAmount) || 0;
			if (entry.status === 'Remitted') {
				remitted += amount;
			} else {
				pending += amount;
			}
		}
		return { remitted, pending };
	}, [tdsEntries]);

	// Aggregate Cost to Client vs Cost to Us at Campaign Level
	const aggregatedCampaigns = React.useMemo(() => {
		const groups: Record<string, { brand: string; costToClient: number; costToUs: number }> = {};

		for (const deal of deals) {
			const campaignName = deal.campaign || 'Direct Deal / No Campaign';
			const brandName = deal.brand || 'Other';
			const key = `${brandName}-${campaignName}`;

			const clientCost = Number(deal.total_fee) || 0;
			const creatorCost = Number(deal.creator_fee) || 0;
			const agencyOverhead = Number(deal.agency_fee_inr) || 0;
			const usCost = creatorCost + agencyOverhead;

			if (!groups[key]) {
				groups[key] = {
					brand: brandName,
					costToClient: 0,
					costToUs: 0
				};
			}
			groups[key].costToClient += clientCost;
			groups[key].costToUs += usCost;
		}

		return Object.entries(groups).map(([key, val]) => {
			const index = key.indexOf('-');
			const campaignName = key.slice(index + 1);
			const margin = val.costToClient - val.costToUs;
			return {
				campaignName,
				brand: val.brand,
				costToClient: val.costToClient,
				costToUs: val.costToUs,
				margin
			};
		}).sort((a, b) => b.costToClient - a.costToClient);
	}, [deals]);

	if (loading) {
		return (
			<section className={styles.dashboard}>
				<header className={styles.header}>
					<div>
						<h1>Accounts overview</h1>
						<p>Cash flow, tax remittances and campaign margins.</p>
					</div>
				</header>
				<div className={styles.metrics}>
					<Skeleton className="h-28" />
					<Skeleton className="h-28" />
					<Skeleton className="h-28" />
					<Skeleton className="h-28" />
				</div>
				<Skeleton className="h-64" />
			</section>
		);
	}

	if (overviewError) {
		return <QueryErrorState description="Unable to load cash flow overview." onRetry={refetchOverview} />;
	}

	const billed = Number(overview?.billed?.total ?? 0);
	const unbilled = Number(overview?.unbilled?.total ?? 0);
	const fy = fyStart === null ? 'Fiscal year' : `FY ${fyStart % 100}–${(fyStart + 1) % 100}`;

	return (
		<section className={styles.dashboard}>
			<header className={styles.header}>
				<div>
					<h1>Accounts overview</h1>
					<p>Cash flow, tax remittances and campaign margins · {fy}.</p>
				</div>
			</header>

			<div className={styles.metrics}>
				{[
					{ label: 'Billed revenue', value: billed, detail: 'Invoices raised this financial year', icon: 'file-text' },
					{ label: 'Unbilled revenue', value: unbilled, detail: 'Campaign bookings awaiting invoices', icon: 'clock' },
					{ label: 'TDS remitted', value: tdsSummary.remitted, detail: 'Tax recorded as remitted', icon: 'tag' },
					{ label: 'TDS outstanding', value: tdsSummary.pending, detail: 'Tax awaiting remittance', icon: 'bell' },
				].map((metric, index) => (
					<article key={metric.label} className={`${styles.metric} ${index === 0 ? styles.featured : ''}`}>
						<div className={styles.metricLabel}>
							{metric.label}
							<span className={styles.icon}><Icon name={metric.icon} size={17} /></span>
						</div>
						<strong>₹{inr(metric.value) || '0'}</strong>
						<p>{metric.detail}</p>
					</article>
				))}
			</div>

			<article className={styles.panel}>
				<div className={styles.panelHeader}>
					<div>
						<h2>Campaign margins</h2>
						<p>Client billing compared with creator payouts and agency overheads.</p>
					</div>
					<Icon name="layers" size={18} />
				</div>
				{aggregatedCampaigns.length === 0 ? (
					<div className="py-10 text-center">
						<h3 className="text-sm font-semibold">No campaigns recorded</h3>
						<p className="mt-1 text-sm text-[var(--n-fg-muted)]">
							Campaign margins will appear when deals are added for this financial year.
						</p>
						<Link href="/commercial" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--n-accent)] hover:underline">
							Go to campaigns <Icon name="arrow-right" size={14} />
						</Link>
					</div>
				) : (
					<div className="tbl-card">
						<div className="scroll-x">
							<table className="grid-table w-full min-w-[760px]">
								<thead>
									<tr>
										<th>Campaign</th>
										<th>Brand</th>
										<th className="num">Billed to client</th>
										<th className="num">Creator payouts & overheads</th>
										<th className="num">Net margin</th>
									</tr>
								</thead>
								<tbody>
									{aggregatedCampaigns.map((c) => (
										<tr key={`${c.brand}:${c.campaignName}`}>
											<td className="font-medium" title={c.campaignName}>
												<span className="block max-w-[260px] truncate">{c.campaignName}</span>
											</td>
											<td className="text-[var(--n-fg-muted)]" title={c.brand}>
												<span className="block max-w-[180px] truncate">{c.brand}</span>
											</td>
											<td className="num font-medium tabular-nums">
												{c.costToClient > 0 ? `₹${inr(c.costToClient)}` : '—'}
											</td>
											<td className="num text-[var(--n-fg-muted)] tabular-nums">
												{c.costToUs > 0 ? `₹${inr(c.costToUs)}` : '—'}
											</td>
											<td className={`num font-semibold tabular-nums ${c.margin > 0 ? 'text-[var(--color-success)]' : c.margin < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--n-fg-subtle)]'}`}>
												{c.margin > 0 ? `₹${inr(c.margin)}` : c.margin < 0 ? `-₹${inr(Math.abs(c.margin))}` : '—'}
											</td>
											</tr>
										))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</article>
		</section>
	);
}
