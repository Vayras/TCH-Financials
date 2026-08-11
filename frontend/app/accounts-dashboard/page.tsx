'use client';

import * as React from 'react';
import Link from 'next/link';
import { useDealsQuery, useTdsEntriesQuery } from '../payments/queries';
import { useOverviewQuery } from '../queries';
import { useFiscalYear } from '@/lib/fiscal-year';
import { inr } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
import PageHeader from '@/components/PageHeader';
import QueryErrorState from '@/components/QueryErrorState';

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
			<div className="flex items-center justify-center gap-3 py-24 text-gray-500">
				<svg className="animate-spin h-5 w-5 text-[var(--n-accent)]" style={{ willChange: 'transform' }} viewBox="0 0 24 24" fill="none">
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
				</svg>
				<span className="text-[14px] font-medium">Loading financial dashboard…</span>
			</div>
		);
	}

	if (overviewError) {
		return <QueryErrorState description="Unable to load cash flow overview." onRetry={refetchOverview} />;
	}

	const billed = Number(overview?.billed?.total ?? 0);
	const unbilled = Number(overview?.unbilled?.total ?? 0);

	return (
		<div className="space-y-8">
			<PageHeader title="Accounts Overview" description="Consolidated cash flow tracking, ledger totals, and campaign audits." />

			{/* Metric Blocks Row */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				{/* Billed */}
				<div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between transition-colors duration-100 hover:border-gray-300">
					<div className="space-y-1">
						<span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Billed Revenue</span>
						<div className="text-[20px] font-extrabold text-[var(--color-success)] tracking-tight tabular-nums">
							{billed > 0 ? `₹${inr(billed)}` : '₹0'}
						</div>
					</div>
					<div className="h-9 w-9 rounded-lg bg-[var(--color-success-bg)] flex items-center justify-center text-[var(--color-success)]">
						<Icon name="check" size={18} />
					</div>
				</div>

				{/* Unbilled */}
				<div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between transition-colors duration-100 hover:border-gray-300">
					<div className="space-y-1">
						<span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Unbilled Revenue</span>
						<div className="text-[20px] font-extrabold text-[var(--color-warning)] tracking-tight tabular-nums">
							{unbilled > 0 ? `₹${inr(unbilled)}` : '₹0'}
						</div>
					</div>
					<div className="h-9 w-9 rounded-lg bg-[var(--color-warning-bg)] flex items-center justify-center text-[var(--color-warning)]">
						<Icon name="clock" size={18} />
					</div>
				</div>

				{/* TDS Remitted */}
				<div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between transition-colors duration-100 hover:border-gray-300">
					<div className="space-y-1">
						<span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">TDS Remitted</span>
						<div className="text-[20px] font-extrabold text-gray-900 tracking-tight tabular-nums">
							{tdsSummary.remitted > 0 ? `₹${inr(tdsSummary.remitted)}` : '₹0'}
						</div>
					</div>
					<div className="h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-700">
						<Icon name="tag" size={18} />
					</div>
				</div>

				{/* TDS Outstanding */}
				<div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between transition-colors duration-100 hover:border-gray-300">
					<div className="space-y-1">
						<span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">TDS Outstanding</span>
						<div className="text-[20px] font-extrabold text-[var(--color-danger)] tracking-tight tabular-nums">
							{tdsSummary.pending > 0 ? `₹${inr(tdsSummary.pending)}` : '₹0'}
						</div>
					</div>
					<div className="h-9 w-9 rounded-lg bg-[var(--color-danger-bg)] flex items-center justify-center text-[var(--color-danger)]">
						<Icon name="bell" size={18} />
					</div>
				</div>
			</div>

			{/* Section: Campaign Audits */}
			<div className="space-y-3">
				<h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
					<Icon name="layers" size={15} className="text-gray-500" />
					<span>Campaign Financial Audits (Cost to Us vs Cost to Client)</span>
				</h3>

				{aggregatedCampaigns.length === 0 ? (
					<div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
						<div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3 text-gray-400">
							<Icon name="layers" size={18} />
						</div>
						<h4 className="text-[13px] font-bold text-gray-950">No campaigns recorded</h4>
						<p className="text-[11.5px] text-gray-500 mt-0.5 max-w-[280px] mx-auto">
							Aggregated costs will display here when deals are added for this fiscal year.
						</p>
						<div className="mt-4">
							<Link
								href="/commercial"
								className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--n-accent)] hover:underline"
							>
								Go to Campaign Tracking →
							</Link>
						</div>
					</div>
				) : (
					<div className="server-table-wrap">
						<div className="tbl-card">
							<div className="scroll-x">
								<table className="grid-table w-full table-fixed">
									<thead>
										<tr>
											<th className="w-[220px]">Campaign Name</th>
											<th className="w-[140px]">Brand</th>
											<th className="num w-[140px]">Cost to Client (Billed)</th>
											<th className="num w-[160px]">Cost to Us (Payouts + Overheads)</th>
											<th className="num w-[120px]">Gross Margin</th>
										</tr>
									</thead>
									<tbody>
										{aggregatedCampaigns.map((c, i) => (
											<tr key={i}>
												<td className="text-gray-800">
													<span className="block truncate max-w-[200px] font-medium" title={c.campaignName}>
														{c.campaignName}
													</span>
												</td>
												<td className="text-gray-500">
													<span className="block truncate max-w-[120px]" title={c.brand}>
														{c.brand}
													</span>
												</td>
												<td className="num text-gray-900 font-medium">
													{c.costToClient > 0 ? `₹${inr(c.costToClient)}` : '—'}
												</td>
												<td className="num text-gray-500">
													{c.costToUs > 0 ? `₹${inr(c.costToUs)}` : '—'}
												</td>
												<td className={`num font-bold ${c.margin > 0 ? 'text-[#15803d]' : c.margin < 0 ? 'text-[#b91c1c]' : 'text-gray-400'}`}>
													{c.margin > 0 ? `₹${inr(c.margin)}` : c.margin < 0 ? `-₹${inr(Math.abs(c.margin))}` : '—'}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
