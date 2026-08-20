'use client';

import * as React from 'react';
import { useCreatorPortalDealsQuery, useCreatorPortalTdsQuery } from '../queries';
import { inr } from '@/lib/utils';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import PageHeader from '@/components/PageHeader';
import QueryErrorState from '@/components/QueryErrorState';

export default function CreatorPaymentsPage() {
	const { data: deals = [], isLoading: dealsLoading, error: dealsError, refetch: refetchDeals } = useCreatorPortalDealsQuery();
	const { data: tdsList = [], isLoading: tdsLoading } = useCreatorPortalTdsQuery();

	const loading = dealsLoading || tdsLoading;

	const paymentSummary = React.useMemo(() => {
		let totalPaid = 0;
		let totalPending = 0;
		for (const deal of deals) {
			const fee = Number(deal.creator_fee) || 0;
			if (deal.creator_payment_status === 'Paid') {
				totalPaid += fee;
			} else {
				totalPending += fee;
			}
		}
		return { totalPaid, totalPending };
	}, [deals]);

	if (loading) {
		return (
			<div className="flex items-center justify-center gap-3 py-24 text-gray-500">
				<svg className="animate-spin h-5 w-5 text-[#7e22ce]" viewBox="0 0 24 24" fill="none">
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
				</svg>
				<span className="text-[14px] font-medium">Loading payments &amp; tax statements…</span>
			</div>
		);
	}

	if (dealsError) {
		return <QueryErrorState description="Unable to load payments details." onRetry={refetchDeals} />;
	}

	return (
		<div className="space-y-8">
			<PageHeader title="Payments &amp; TDS" description="Track payment clearances and statutory withholdings." />

			{/* Metric Cards Row */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
					<div className="space-y-1">
						<span className="text-[11px] font-bold uppercase tracking-wider text-gray-455">Total Received Payouts</span>
						<div className="text-[22px] font-extrabold text-gray-900 tracking-tight tabular-nums">
							₹{paymentSummary.totalPaid > 0 ? inr(paymentSummary.totalPaid) : '0'}
						</div>
					</div>
					<div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
						<Icon name="check" size={20} />
					</div>
				</div>

				<div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
					<div className="space-y-1">
						<span className="text-[11px] font-bold uppercase tracking-wider text-gray-455">Pending / Upcoming Payouts</span>
						<div className="text-[22px] font-extrabold text-gray-900 tracking-tight tabular-nums">
							₹{paymentSummary.totalPending > 0 ? inr(paymentSummary.totalPending) : '0'}
						</div>
					</div>
					<div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
						<Icon name="clock" size={20} />
					</div>
				</div>
			</div>

			<div className="space-y-8">
				{/* Payout Ledger Section */}
				<div>
					<h3 className="text-[14px] font-bold text-gray-900 mb-3 flex items-center gap-2">
						<Icon name="list" size={15} className="text-gray-500" />
						<span>Payout Ledger</span>
					</h3>
					{deals.length === 0 ? (
						<div className="text-center py-12 bg-white shadow-sm rounded-xl" style={{ border: '1px solid var(--n-border)' }}>
							<div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3 text-gray-400">
								<Icon name="credit-card" size={18} />
							</div>
							<h4 className="text-[12px] font-bold text-gray-950">No payout statements</h4>
							<p className="text-[11.5px] text-gray-500 mt-0.5">Your clearances ledger will display here once transactions are recorded.</p>
						</div>
					) : (
						<div className="server-table-wrap">
							<div className="tbl-card">
								<div className="scroll-x">
									<table className="grid-table w-full">
										<thead>
											<tr>
												<th>Campaign</th>
												<th>Payout Date</th>
												<th className="num">Gross Fee</th>
												<th>Payout Status</th>
											</tr>
										</thead>
										<tbody>
											{deals.map((deal) => (
												<tr key={deal.id}>
													<td className="font-medium text-gray-800">
														{deal.brand} · {deal.campaign || 'Untitled Campaign'}
													</td>
													<td className="text-gray-500">
														{deal.creator_payment_date || '—'}
													</td>
													<td className="num font-bold text-gray-900">
														₹{inr(Number(deal.creator_fee))}
													</td>
													<td>
														<Tag tone={deal.creator_payment_status === 'Paid' ? 'yes' : deal.creator_payment_status === 'Scheduled' ? 'neutral' : 'markup'}>
															{deal.creator_payment_status || 'Pending'}
														</Tag>
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

				{/* Statutory TDS Section */}
				<div>
					<h3 className="text-[14px] font-bold text-gray-900 mb-3 flex items-center gap-2">
						<Icon name="tag" size={15} className="text-gray-500" />
						<span>Statutory TDS (Tax Withholdings)</span>
					</h3>
					{tdsList.length === 0 ? (
						<div className="text-center py-12 bg-white shadow-sm rounded-xl" style={{ border: '1px solid var(--n-border)' }}>
							<div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3 text-gray-400">
								<Icon name="tag" size={18} />
							</div>
							<h4 className="text-[12px] font-bold text-gray-950">No TDS entries</h4>
							<p className="text-[11.5px] text-gray-500 mt-0.5">Quarterly tax withholding and challan details will display here.</p>
						</div>
					) : (
						<div className="server-table-wrap">
							<div className="tbl-card">
								<div className="scroll-x">
									<table className="grid-table w-full">
										<thead>
											<tr>
												<th>Quarter</th>
												<th className="num">Gross Amount</th>
												<th className="num">TDS Rate</th>
												<th className="num">TDS Withheld</th>
												<th className="num">Net Payout</th>
												<th>Challan Info</th>
											</tr>
										</thead>
										<tbody>
											{tdsList.map((tds) => (
												<tr key={tds.id}>
													<td className="font-medium text-gray-800">{tds.quarter}</td>
													<td className="num">₹{inr(Number(tds.grossAmount))}</td>
													<td className="num">{(Number(tds.tdsRate) * 100).toFixed(1)}%</td>
													<td className="num font-medium text-amber-700">₹{inr(Number(tds.tdsAmount))}</td>
													<td className="num font-bold text-gray-900">₹{inr(Number(tds.netPayable))}</td>
													<td>
														{tds.status === 'Remitted' ? (
															<div className="leading-tight">
																<span className="font-semibold text-green-700">Remitted</span>
																<div className="text-[11px] text-gray-400 font-mono mt-0.5">Challan: {tds.challanNumber}</div>
																<div className="text-[11px] text-gray-400">Date: {tds.remittanceDate}</div>
															</div>
														) : (
															<span className="text-amber-600 font-medium">Pending Remittance</span>
														)}
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
		</div>
	);
}
