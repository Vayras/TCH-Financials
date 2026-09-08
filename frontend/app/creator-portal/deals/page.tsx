'use client';

import { useCreatorPortalDealsQuery } from '../queries';
import { inr } from '@/lib/utils';
import Tag from '@/components/ui/Tag';
import QueryErrorState from '@/components/QueryErrorState';
import { CreatorPageHeader, PortalEmptyState } from '../components';

export default function CreatorDealsPage() {
	const { data: deals = [], isLoading, error, refetch } = useCreatorPortalDealsQuery();
	if (isLoading) return <div className="flex items-center justify-center gap-3 py-20 text-[12px] text-[var(--n-fg-muted)]"><span className="activity-spinner" />Loading your deals…</div>;
	if (error) return <QueryErrorState description="Unable to load your deals." onRetry={refetch} />;
	return <div className="space-y-6"><CreatorPageHeader title="My Deals" description="Track campaign deliverables, payout schedules and invoice readiness." />{deals.length === 0 ? <div className="rounded-xl border border-[var(--n-border)] bg-white"><PortalEmptyState icon="briefcase" title="No active campaigns yet" description="Campaign details will appear as soon as a project is assigned by your TCH manager." /></div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{deals.map((deal) => <article key={deal.id} className="rounded-xl border border-[var(--n-border)] bg-white p-4 transition-colors hover:border-[var(--n-border-strong)]"><div className="flex items-start justify-between gap-3"><span className="rounded bg-[var(--n-accent-soft)] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--n-accent)]">{deal.brand || 'Brand'}</span><Tag tone={deal.campaign_status === 'Over' ? 'yes' : 'neutral'}>{deal.campaign_status === 'Over' ? 'Completed' : 'Active'}</Tag></div><h2 className="mt-3 truncate text-[13px] font-semibold">{deal.campaign || 'Untitled campaign'}</h2><p className="mt-2 line-clamp-2 min-h-9 text-[11px] leading-[18px] text-[var(--n-fg-muted)]">{deal.deliverables || 'Deliverables will be added by your manager.'}</p><div className="mt-4 grid grid-cols-2 border-t border-[var(--n-border)] pt-3 text-[10px]"><div><span className="text-[var(--n-fg-subtle)]">Payout date</span><strong className="mt-1 block font-medium">{deal.creator_payment_date || '—'}</strong></div><div className="text-right"><span className="text-[var(--n-fg-subtle)]">My fee</span><strong className="mt-1 block text-[12px] font-semibold">₹{inr(Number(deal.creator_fee))}</strong></div></div></article>)}</div>}</div>;
}
