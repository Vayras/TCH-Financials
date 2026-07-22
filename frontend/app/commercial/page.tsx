'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ConflictError, type CampaignCardGroup, type CreatorCardGroup, type Deal } from '@/lib/api';
import { inr } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';
import useDebounce from '@/hooks/useDebounce';
import type { CampaignGroup, CardGroupBy, CreatorGroup, DealForm, DirFilter, ShareForm } from '@/types/deal';
import {
	buildShare,
	calYearOfMonth,
	creatorNamesOf,
	EMPTY_DEAL_FORM,
	FY_MONTH_ORDER,
	MONTH_NAMES,
	normalisePctString
} from '@/lib/deals';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import MetricCard from '@/components/MetricCard';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import QueryErrorState from '@/components/QueryErrorState';
import { CampaignGroupCard, CreatorGroupCard } from '@/components/CampaignCards';
import CampaignFormModal, { type CampaignFormResult } from '@/components/CampaignFormModal';
import {
	useCommercialDealsPageQuery,
	useCommercialGroupPageQuery,
	useCommercialCreatorsQuery,
	useCommercialCampaignsQuery,
	useSaveDealMutation,
} from './queries';

import { useRouter } from 'next/navigation';

export default function CommercialPage() {
	const { fyStart } = useFiscalYear();
	const router = useRouter();

	const { data: creators = [], isLoading: creatorsLoading } = useCommercialCreatorsQuery();
	const { data: campaigns = [], isLoading: campaignsLoading } = useCommercialCampaignsQuery();

	const saveDealMutation = useSaveDealMutation(fyStart);

	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Deal | null>(null);
	const [q, setQ] = React.useState('');
	const [dirFilter, setDirFilter] = React.useState<DirFilter>('All');
	// Multi-month filter: empty = all months of the selected fiscal year.
	const [months, setMonths] = React.useState<string[]>([]);
	const [creatorFilter, setCreatorFilter] = React.useState('All');
	const [groupBy, setGroupBy] = React.useState<CardGroupBy>(() => {
		if (typeof window === 'undefined') return 'campaign';
		const saved = window.localStorage.getItem('commercial-card-group');
		return saved === 'campaign' || saved === 'creator' ? saved : 'campaign';
	});
	const [page, setPage] = React.useState(1);
	const [urlHydrated, setUrlHydrated] = React.useState(false);
	const skipFirstPageReset = React.useRef(true);
	const pageSize = 12;
	const [viewMode, setViewMode] = React.useState<'cards' | 'table'>(() => {
		if (typeof window === 'undefined') return 'cards';
		const saved = window.localStorage.getItem('commercial-view-mode');
		return saved === 'cards' || saved === 'table' ? saved : 'cards';
	});
	const debouncedSearch = useDebounce(q.trim(), 500);
	const selectedCreatorId = creatorFilter === 'All'
		? undefined
		: creators.find((creator) => creator.name === creatorFilter)?.id;
	const queryParams = {
		fyStart,
		page,
		pageSize,
		search: debouncedSearch || undefined,
		direction: dirFilter === 'All' ? undefined : dirFilter,
		creator: selectedCreatorId,
		months: months.map(Number),
		sortBy: 'billing_period' as const,
		sortOrder: 'desc' as const,
		periodOnly: true
	};
	const tableQuery = useCommercialDealsPageQuery({ ...queryParams, enabled: viewMode === 'table' });
	const groupQuery = useCommercialGroupPageQuery({ ...queryParams, groupBy, enabled: viewMode === 'cards' });
	const activeQuery = viewMode === 'table' ? tableQuery : groupQuery;
	const rows = tableQuery.data?.items ?? [];
	const loading = activeQuery.isLoading || creatorsLoading || campaignsLoading;
	const error = activeQuery.error ? activeQuery.error.message : null;

	React.useEffect(() => {
		window.localStorage.setItem('commercial-card-group', groupBy);
	}, [groupBy]);

	React.useEffect(() => {
		window.localStorage.setItem('commercial-view-mode', viewMode);
	}, [viewMode]);

	React.useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		setQ(params.get('search') ?? '');
		const direction = params.get('direction');
		if (direction === 'Inbound' || direction === 'Outbound') setDirFilter(direction);
		setCreatorFilter(params.get('creator') ?? 'All');
		setMonths(params.get('month') ? [params.get('month')!] : []);
		const urlGroup = params.get('group');
		if (urlGroup === 'campaign' || urlGroup === 'creator') setGroupBy(urlGroup);
		const urlView = params.get('view');
		if (urlView === 'cards' || urlView === 'table') setViewMode(urlView);
		const urlPage = Number(params.get('page'));
		if (Number.isInteger(urlPage) && urlPage > 0) setPage(urlPage);
		setUrlHydrated(true);
	}, []);

	React.useEffect(() => {
		if (!urlHydrated) return;
		const params = new URLSearchParams();
		if (q.trim()) params.set('search', q.trim());
		if (dirFilter !== 'All') params.set('direction', dirFilter);
		if (creatorFilter !== 'All') params.set('creator', creatorFilter);
		if (months[0]) params.set('month', months[0]);
		if (viewMode !== 'cards') params.set('view', viewMode);
		if (groupBy !== 'campaign') params.set('group', groupBy);
		if (page > 1) params.set('page', String(page));
		const query = params.toString();
		window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
	}, [urlHydrated, q, dirFilter, creatorFilter, months, viewMode, groupBy, page]);

	function startAdd() {
		setEditing(null);
		setOpen(true);
	}

	function startEdit(d: Deal) {
		router.push(`/commercial/${d.id}`);
	}

	// Form seed values. When editing a split campaign, the first share fills the
	// primary fields and the rest become additional rows.
	const initialForm = React.useMemo<DealForm>(() => {
		if (!editing) {
			return { ...EMPTY_DEAL_FORM, confirmation_date: new Date().toISOString().slice(0, 10) };
		}
		const primary = editing.creator_shares?.[0];
		return {
			confirmation_date: editing.confirmation_date ?? '',
			e_invoice_number: editing.e_invoice_number ?? '',
			e_invoice_date: editing.e_invoice_date ?? '',
			creator: primary
				? primary.creator
					? String(primary.creator)
					: ''
				: editing.creator
					? String(editing.creator)
					: '',
			tch_poc: editing.tch_poc ?? '',
			direction: editing.direction,
			total_fee: primary ? primary.total_fee : editing.total_fee,
			agency_fee_pct: primary ? primary.agency_fee_pct : editing.agency_fee_pct,
			agency_fee_inr: primary ? primary.agency_fee_inr : editing.agency_fee_inr,
			creator_fee: primary ? primary.creator_fee : editing.creator_fee,
			billing_entity: editing.billing_entity,
			brand: editing.brand,
			brand_poc: editing.brand_poc ?? '',
			campaign: editing.campaign ?? '',
			deliverables: editing.deliverables,
			ro_number: editing.ro_number,
			comments: editing.comments
		};
	}, [editing]);

	const initialShares = React.useMemo<ShareForm[]>(
		() =>
			(editing?.creator_shares ?? []).slice(1).map((s) => ({
				creator: s.creator ? String(s.creator) : '',
				total_fee: s.total_fee,
				agency_fee_pct: s.agency_fee_pct
			})),
		[editing]
	);

	async function submit({ form, shares, clientInvoiceFile, creatorInvoiceFile }: CampaignFormResult) {
		// A campaign is "split" when extra creators are added. We then send the
		// full creator_shares set (primary + additions) and roll the campaign
		// totals up from the shares. With no extra creators we send an empty
		// set so any previous split is cleared and the single creator is used.
		const hasSplit = shares.length > 0;
		const shareRows = hasSplit
			? [
				buildShare(form.creator, form.total_fee, form.agency_fee_pct),
				...shares.map((s) => buildShare(s.creator, s.total_fee, s.agency_fee_pct))
			]
			: [];
		const sum = (k: 'total_fee' | 'agency_fee_inr' | 'creator_fee') =>
			shareRows.reduce((n, s) => n + (Number(s[k]) || 0), 0).toFixed(2);
		const payload = {
			...form,
			creator: form.creator ? Number(form.creator) : null,
			creator_name_raw: '',
			confirmation_date: form.confirmation_date || null,
			e_invoice_date: form.e_invoice_date || null,
			total_fee: hasSplit ? sum('total_fee') : form.total_fee || '0',
			agency_fee_pct: normalisePctString(form.agency_fee_pct),
			agency_fee_inr: hasSplit ? sum('agency_fee_inr') : form.agency_fee_inr || '0',
			creator_fee: hasSplit ? sum('creator_fee') : form.creator_fee || '0',
			creator_shares: shareRows
		};
		try {
			const deal = await saveDealMutation.mutateAsync({
				editingId: editing?.id,
				editingVersion: editing?.version,
				payload,
				clientInvoiceFile,
				creatorInvoiceFile
			});
			setOpen(false);
			if (!editing && deal && deal.id) {
				toast.success('Campaign created.');
				router.push(`/commercial/${deal.id}`);
			} else {
				toast.success('Campaign updated.');
			}
		} catch (e) {
			toast.error('Campaign could not be saved.', { description: (e as Error).message });
			if (e instanceof ConflictError) {
				setOpen(false);
			}
		}
	}

	// Distinct creator names across the loaded deals (primary + split rows) —
	// The master list keeps the filter stable even while a server page changes.
	const creatorNames = React.useMemo(
		() => creators.map((creator) => creator.name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
		[creators]
	);

	const filtersActive =
		creatorFilter !== 'All' || months.length > 0 || dirFilter !== 'All' || q.trim() !== '';

	// Months are offered only once they've started: a month appears in the
	// dropdown when its calendar position is in the past or is the running one
	// for the selected fiscal year. Future months are hidden entirely.
	const availMonths = React.useMemo(() => {
		if (fyStart === null) return [];
		const now = new Date();
		const curY = now.getFullYear();
		const curM = now.getMonth() + 1;
		return FY_MONTH_ORDER.filter((mm) => {
			const y = calYearOfMonth(mm, fyStart);
			return y < curY || (y === curY && Number(mm) <= curM);
		});
	}, [fyStart]);

	// Switching fiscal year can invalidate chosen months (e.g. a future FY where
	// they haven't started) — drop the ones that no longer apply.
	React.useEffect(() => {
		setMonths((prev) => {
			const next = prev.filter((mm) => availMonths.includes(mm));
			return next.length === prev.length ? prev : next;
		});
	}, [availMonths]);

	const filtered = rows;
	const activeData = viewMode === 'table' ? tableQuery.data : groupQuery.data;
	const billingSummary = { invoiced: Number(activeData?.summary.total_billing ?? 0) };

	function resetFilters() {
		setCreatorFilter('All');
		setMonths([]);
		setDirFilter('All');
		setQ('');
	}

	const totals = { count: activeData?.summary.deal_count ?? 0 };
	const pagedDeals = filtered;
	const pagedCampaignGroups: CampaignGroup[] = groupBy === 'campaign'
		? (groupQuery.data?.items as CampaignCardGroup[] | undefined ?? []).map((group) => ({
			key: group.key, name: group.name, brand: group.brand, status: group.status,
			creatorNames: group.creator_names, deals: [group.deal], total: group.total
		}))
		: [];
	const pagedCreatorGroups: CreatorGroup[] = groupBy === 'creator'
		? (groupQuery.data?.items as CreatorCardGroup[] | undefined ?? []).map((group) => ({
			key: group.key, name: group.name, relationship: group.relationship,
			deals: [group.deal], dealCount: group.deal_count, total: group.total
		}))
		: [];
	const resultTotal = activeData?.total ?? 0;

	React.useEffect(() => {
		if (!urlHydrated) return;
		if (skipFirstPageReset.current) {
			skipFirstPageReset.current = false;
			return;
		}
		setPage(1);
	}, [urlHydrated, debouncedSearch, dirFilter, creatorFilter, months, groupBy, viewMode, fyStart]);
	React.useEffect(() => {
		const lastPage = Math.max(1, Math.ceil(resultTotal / pageSize));
		if (page > lastPage) setPage(lastPage);
	}, [page, resultTotal]);

	return (
		<>
			<style dangerouslySetInnerHTML={{
				__html: `
				@keyframes fadeUp {
					from { opacity: 0; transform: translateY(10px); }
					to { opacity: 1; transform: translateY(0); }
				}
				.anim-fade-up { animation: fadeUp 0.28s ease-out; }
				.dir-badge-in {
					background: var(--color-inbound-bg);
					color: var(--color-inbound);
					border: 1px solid var(--color-inbound-border);
				}
				.dir-badge-out {
					background: var(--color-outbound-bg);
					color: var(--color-outbound);
					border: 1px solid var(--color-outbound-border);
				}
				.table-row:hover { background: var(--n-bg-hover); }
			`}} />

			<section className="space-y-5">
				{/* ── Header ── */}
				<PageHeader title="Campaign Tracking" description={`${totals.count} deal${totals.count !== 1 ? 's' : ''} · FY ${fyStart}–${((fyStart ?? 0) + 1).toString().slice(2)}`} actions={<>
					<div className="flex items-center gap-2.5">
						{/* View toggle */}
						<div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: 'var(--n-border)', background: 'var(--n-bg)' }}>
							<button
								type="button"
								onClick={() => setViewMode('cards')}
								title="Card view"
								style={viewMode === 'cards'
									? { background: '#441151', color: '#fff' }
									: { background: 'transparent', color: '#441151', opacity: 0.45 }
								}
								className="h-8 w-9 flex items-center justify-center transition-all"
							>
								<Icon name="grid" size={14} />
							</button>
							<button
								type="button"
								onClick={() => setViewMode('table')}
								title="Table view"
								style={viewMode === 'table'
									? { background: '#441151', color: '#fff' }
									: { background: 'transparent', color: '#441151', opacity: 0.45 }
								}
								className="h-8 w-9 flex items-center justify-center transition-all"
							>
								<Icon name="list" size={14} />
							</button>
						</div>

						<Button variant="primary" size="md" onClick={startAdd}>
							<Icon name="plus" size={14} />
							Add Campaign
						</Button>
					</div>
				</>} />

				{/* ── Metric Cards ── */}
				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-xl p-4 border" style={{ background: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
						<p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--n-fg-subtle)' }}>Total Billing</p>
						<p className="text-[24px] font-bold tracking-tight tabular-nums" style={{ color: 'var(--n-fg)' }}>
							₹&thinsp;{inr(billingSummary.invoiced) || '0'}
						</p>
					</div>
					<div className="rounded-xl p-4 border" style={{ background: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
						<p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--n-fg-subtle)' }}>Deals</p>
						<p className="text-[24px] font-bold tracking-tight tabular-nums" style={{ color: 'var(--n-fg)' }}>
							{totals.count}
						</p>
					</div>
				</div>

				{/* ── Filter Bar ── */}
				<div className="flex flex-wrap items-center gap-2" style={{ background: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
					<div className="relative flex-1 min-w-[200px]">
						<span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--n-fg-subtle)' }}>
							<Icon name="search" size={13} />
						</span>
						<input
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder="Search creator, brand, campaign…"
							className="h-8 w-full rounded-lg pl-8 pr-3 text-[13px] transition-colors focus:outline-none"
							style={{ background: 'var(--n-bg-soft)', color: 'var(--n-fg)', border: '1px solid var(--n-border)' }}
						/>
					</div>

					<select
						value={dirFilter}
						onChange={(e) => setDirFilter(e.target.value as DirFilter)}
						className="h-8 rounded-lg px-2 text-[13px] focus:outline-none"
						style={{ background: 'var(--n-bg-soft)', color: 'var(--n-fg)', border: '1px solid var(--n-border)' }}
					>
						{(['All', 'Inbound', 'Outbound'] as DirFilter[]).map((d) => <option key={d} value={d}>{d === 'All' ? 'All Types' : d}</option>)}
					</select>

					<select
						value={creatorFilter}
						onChange={(e) => setCreatorFilter(e.target.value)}
						className="h-8 rounded-lg px-2 text-[13px] focus:outline-none min-w-[140px]"
						style={{ background: 'var(--n-bg-soft)', color: 'var(--n-fg)', border: '1px solid var(--n-border)' }}
					>
						<option value="All">All Creators</option>
						{creatorNames.map((n) => <option key={n} value={n}>{n}</option>)}
					</select>

					<select
						value={months[0] ?? ''}
						onChange={(e) => setMonths(e.target.value ? [e.target.value] : [])}
						className="h-8 rounded-lg px-2 text-[13px] focus:outline-none"
						style={{ background: 'var(--n-bg-soft)', color: 'var(--n-fg)', border: '1px solid var(--n-border)' }}
					>
						<option value="">All Months</option>
						{availMonths.map((mm) => <option key={mm} value={mm}>{MONTH_NAMES[Number(mm)]}</option>)}
					</select>

					{viewMode === 'cards' && (
						<select
							value={groupBy}
							onChange={(e) => setGroupBy(e.target.value as CardGroupBy)}
							className="h-8 rounded-lg px-2 text-[13px] focus:outline-none"
							style={{ background: 'var(--n-bg-soft)', color: 'var(--n-fg)', border: '1px solid var(--n-border)' }}
						>
							<option value="campaign">By Campaign</option>
							<option value="creator">By Creator</option>
						</select>
					)}

					{filtersActive && (
						<button
							onClick={resetFilters}
							className="h-8 px-3 rounded-lg text-[13px] flex items-center gap-1 transition-colors hover:opacity-80"
							style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)' }}
						>
							<Icon name="x" size={12} />
							Reset
						</button>
					)}
				</div>

				{/* ── Content ── */}
				{loading ? (
					<div className="flex items-center justify-center gap-3 py-16" style={{ color: 'var(--n-fg-subtle)' }}>
						<svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
							<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
						</svg>
						<span className="text-[14px]">Loading campaigns…</span>
					</div>
				) : error ? (
					<QueryErrorState description="Campaign data is temporarily unavailable." onRetry={() => activeQuery.refetch()} />
				) : viewMode === 'table' ? (
					<div className="anim-fade-up rounded-xl border overflow-hidden" style={{ borderColor: 'var(--n-border)', background: 'var(--n-bg)' }}>
						<table className="w-full border-collapse">
							<thead>
								<tr style={{ background: 'var(--n-bg-soft)', borderBottom: '1px solid var(--n-border)' }}>
									<th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Campaign / Brand</th>
									<th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Creators</th>
									<th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Total Fee</th>
									<th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Date</th>
									<th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Type</th>
									<th className="px-4 py-3" />
								</tr>
							</thead>
							<tbody>
								{pagedDeals.map((deal, idx) => {
									const cNames = creatorNamesOf(deal).join(', ') || '—';
									const label = Array.from(new Set([deal.brand, deal.campaign].filter(Boolean))).join(' · ') || '—';
									const isOut = deal.direction === 'Outbound';
									return (
										<tr
											key={deal.id}
											className="table-row border-b last:border-b-0 cursor-pointer transition-colors"
											style={{ borderColor: 'var(--n-border)', animationDelay: `${idx * 0.03}s` }}
											onClick={() => startEdit(deal)}
											onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--n-bg-hover)')}
											onMouseLeave={(e) => (e.currentTarget.style.background = '')}
										>
											<td className="px-4 py-3.5 max-w-[280px]">
												<span className="text-[13px] font-semibold leading-tight block truncate" style={{ color: 'var(--n-fg)' }} title={label}>{label}</span>
											</td>
											<td className="px-4 py-3.5">
												<span className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }} title={cNames}>
													{cNames.length > 30 ? cNames.slice(0, 30) + '…' : cNames}
												</span>
											</td>
											<td className="px-4 py-3.5 text-right whitespace-nowrap">
												<span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--n-fg)' }}>₹{inr(deal.total_fee)}</span>
											</td>
											<td className="px-4 py-3.5 whitespace-nowrap">
												<span className="text-[12.5px] tabular-nums" style={{ color: 'var(--n-fg-subtle)' }}>
													{deal.confirmation_date || deal.e_invoice_date || '—'}
												</span>
											</td>
											<td className="px-4 py-3.5">
												<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${isOut ? 'dir-badge-out' : 'dir-badge-in'}`}>
													{deal.direction}
												</span>
											</td>
											<td className="px-4 py-3.5">
												<div className="flex items-center justify-end">
													<Button
														variant="outline"
														size="sm"
														onClick={() => startEdit(deal)}
														title="Open campaign workspace"
														aria-label="Open campaign workspace"
													>
														<Icon name="arrow-right" size={14} />
													</Button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{resultTotal === 0 && (
							<div className="py-16 text-center">
								<Icon name="inbox" size={28} className="mx-auto mb-3 opacity-30" />
								<p className="text-[14px]" style={{ color: 'var(--n-fg-subtle)' }}>No campaigns match the current filters.</p>
							</div>
						)}
						{resultTotal > 0 && <Pagination page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} />}
					</div>
				) : groupBy === 'campaign' ? (
					<div className="anim-fade-up">
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{pagedCampaignGroups.map((group) => (
								<CampaignGroupCard key={group.key} group={group} onView={startEdit} />
							))}
						</div>
						{resultTotal === 0 && (
							<div className="py-16 text-center">
								<Icon name="inbox" size={28} className="mx-auto mb-3 opacity-30" />
								<p className="text-[14px]" style={{ color: 'var(--n-fg-subtle)' }}>No campaigns match the current filters.</p>
							</div>
						)}
						{resultTotal > 0 && <Pagination page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} />}
					</div>
				) : (
					<div className="anim-fade-up">
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{pagedCreatorGroups.map((group) => (
								<CreatorGroupCard key={group.key} group={group} onView={startEdit} />
							))}
						</div>
						{resultTotal === 0 && (
							<div className="py-16 text-center">
								<Icon name="inbox" size={28} className="mx-auto mb-3 opacity-30" />
								<p className="text-[14px]" style={{ color: 'var(--n-fg-subtle)' }}>No deals match the current filters.</p>
							</div>
						)}
						{resultTotal > 0 && <Pagination page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} />}
					</div>
				)}
			</section>

			<CampaignFormModal
				open={open}
				onOpenChange={setOpen}
				title={editing ? 'Edit Campaign' : 'Add Campaign'}
				submitLabel={editing ? 'Save' : 'Create'}
				initial={initialForm}
				initialShares={initialShares}
				creators={creators}
				campaignNames={campaigns.map((c) => c.name)}
				onSubmit={submit}
			/>
		</>
	);
}
