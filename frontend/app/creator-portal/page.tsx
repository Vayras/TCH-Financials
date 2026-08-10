'use client';

import * as React from 'react';
import { useCreatorPortalDealsQuery } from './queries';
import { inr } from '@/lib/utils';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import PageHeader from '@/components/PageHeader';
import QueryErrorState from '@/components/QueryErrorState';

export default function CreatorDealsPage() {
	const { data: deals = [], isLoading, error, refetch } = useCreatorPortalDealsQuery();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-3 py-16 text-gray-500">
				<svg className="animate-spin h-5 w-5" style={{ willChange: 'transform' }} viewBox="0 0 24 24" fill="none">
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
				</svg>
				<span className="text-[14px]">Loading your deals…</span>
			</div>
		);
	}

	if (error) {
		return <QueryErrorState description="Unable to load your deals." onRetry={refetch} />;
	}

	return (
		<div className="space-y-6">
			<PageHeader title="My Deals" description="Overview of all campaigns, deliverables, and agreed payout fees." />

			{deals.length === 0 ? (
				<div className="text-center py-20 rounded-xl border bg-white border-gray-200">
					<div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
						<Icon name="briefcase" size={20} className="text-gray-400" />
					</div>
					<h3 className="text-[15px] font-bold text-gray-900 mb-1">No deals yet</h3>
					<p className="text-[13px] text-gray-500 max-w-[280px] mx-auto">
						You&apos;ll see your campaign deals here once the TCH team assigns you to one.
					</p>
					<p className="text-[11.5px] text-gray-400 mt-3 max-w-[240px] mx-auto">
						Reach out to your manager if you expected to see a deal listed here.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{deals.map((deal) => {
						return (
							<div
								key={deal.id}
							className="creator-deal-card rounded-xl p-5 hover:shadow-md hover:border-[var(--n-accent)] group flex flex-col justify-between gap-4 cursor-pointer"
								style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
							>
								<div>
									<div className="flex items-start justify-between gap-2 mb-2">
										<span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--n-accent)] bg-[var(--n-accent-soft)] px-2 py-0.5 rounded border border-[var(--n-border)]">
											{deal.brand || 'Brand'}
										</span>
										<Tag tone={deal.campaign_status === 'Over' ? 'yes' : 'neutral'}>
											{deal.campaign_status === 'Over' ? 'Completed' : 'Active'}
										</Tag>
									</div>

									<h3 className="text-[15px] font-semibold leading-tight mb-1 truncate transition-colors duration-100 tracking-[-0.01em] group-hover:text-[var(--n-accent)]" title={deal.campaign || 'Campaign'} style={{ color: 'var(--n-fg)' }}>
										{deal.campaign || 'Untitled Campaign'}
									</h3>

									<p className="text-[12.5px] line-clamp-2 mt-2 leading-relaxed" title={deal.deliverables} style={{ color: 'var(--n-fg-muted)' }}>
										<strong style={{ color: 'var(--n-fg-subtle)' }}>Deliverables:</strong> {deal.deliverables || '—'}
									</p>
								</div>

								<div className="pt-3 border-t grid grid-cols-2 gap-2 text-[12px]" style={{ borderColor: 'var(--n-border)' }}>
									<div>
										<span className="block font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Payout Date</span>
										<span className="font-semibold mt-0.5 block tabular-nums" style={{ color: 'var(--n-fg)' }}>
											{deal.creator_payment_date || '—'}
										</span>
									</div>
									<div className="text-right">
										<span className="block font-medium" style={{ color: 'var(--n-fg-subtle)' }}>My Fee</span>
										<span className="text-[14px] font-bold mt-0.5 block tabular-nums" style={{ color: 'var(--n-fg)' }}>
											₹{inr(Number(deal.creator_fee))}
										</span>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
