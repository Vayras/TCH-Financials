'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ConflictError, type CampaignCardGroup, type CreatorCardGroup, type Deal } from '@/lib/api';
import { inr } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';
import useDebounce from '@/hooks/useDebounce';
import type { CampaignGroup, CreatorGroup, DealForm } from '@/types/deal';
import {
	buildShare,
	calYearOfMonth,
	EMPTY_DEAL_FORM,
	FY_MONTH_ORDER,
	normalisePctString,
} from '@/lib/deals';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
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
import { useCommercialFilters } from './useCommercialFilters';
import { CommercialFilterBar } from './components/CommercialFilterBar';
import { CommercialTable } from './components/CommercialTable';

export default function CommercialPage() {
	const { fyStart } = useFiscalYear();
	const router = useRouter();

	const { data: creators = [], isLoading: creatorsLoading } = useCommercialCreatorsQuery();
	const { data: campaigns = [], isLoading: campaignsLoading } = useCommercialCampaignsQuery();

	const saveDealMutation = useSaveDealMutation(fyStart);

	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Deal | null>(null);
	const skipFirstPageReset = React.useRef(true);

	const {
		q, setQ,
		dirFilter, setDirFilter,
		statusFilter, setStatusFilter,
		months, setMonths,
		creatorFilter, setCreatorFilter,
		groupBy, setGroupBy,
		viewMode, setViewMode,
		page, setPage,
		urlHydrated,
		resetFilters,
	} = useCommercialFilters();

	const pageSize = 12;
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
		status: statusFilter === 'All' ? undefined : statusFilter,
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

	function startAdd() {
		setEditing(null);
		setOpen(true);
	}

	function startEdit(d: Deal) {
		router.push(`/commercial/${d.id}`);
	}

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

	async function submit({ form, shares, clientInvoiceFile, creatorInvoiceFile }: CampaignFormResult) {
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
				router.push(`/commercial/${deal.id}?edit=true`);
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

	const creatorNames = React.useMemo(
		() => creators.map((creator) => creator.name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
		[creators]
	);

	const filtersActive =
		creatorFilter !== 'All' || months.length > 0 || dirFilter !== 'All' || statusFilter !== 'All' || q.trim() !== '';

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

	React.useEffect(() => {
		setMonths((prev) => {
			const next = prev.filter((mm) => availMonths.includes(mm));
			return next.length === prev.length ? prev : next;
		});
	}, [availMonths]);

	const activeData = viewMode === 'table' ? tableQuery.data : groupQuery.data;
	const billingSummary = { invoiced: Number(activeData?.summary.total_billing ?? 0) };

	const renderEmptyState = (type: 'campaigns' | 'deals') => {
		let title = `No ${type} found`;
		let desc = "Try adjusting your filters or search terms.";
		let iconName = "inbox";

		if (q.trim()) {
			title = "No search results";
			desc = `We couldn't find anything matching "${q.trim()}".`;
			iconName = "search";
		} else if (statusFilter === 'Completed') {
			title = `No completed ${type}`;
			desc = `There are no ${type} that have been fully paid and completed.`;
			iconName = "check";
		} else if (statusFilter === 'Awaiting Invoices') {
			title = "All caught up!";
			desc = `There are no ${type} waiting for invoice uploads.`;
			iconName = "check";
		} else if (statusFilter === 'Pending Payment') {
			title = "No pending payments";
			desc = `All invoiced ${type} have been processed.`;
			iconName = "credit-card";
		} else if (filtersActive) {
			title = "No matches found";
			desc = "Try clearing some filters to see more results.";
		}

		return (
			<div className="py-20 flex flex-col items-center justify-center text-center anim-fade-up">
				<div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--n-bg-soft)' }}>
					<Icon name={iconName} size={24} style={{ color: 'var(--n-fg-subtle)' }} />
				</div>
				<h3 className="text-[15px] font-bold mb-1.5" style={{ color: 'var(--n-fg)' }}>{title}</h3>
				<p className="text-[12px] max-w-[280px] mb-5" style={{ color: 'var(--n-fg-subtle)' }}>{desc}</p>
				{filtersActive && (
					<Button variant="outline" size="sm" onClick={resetFilters}>
						Clear All Filters
					</Button>
				)}
			</div>
		);
	};

	const totals = { count: activeData?.summary.deal_count ?? 0 };
	const pagedDeals = rows;
	const pagedCampaignGroups: CampaignGroup[] = groupBy === 'campaign'
		? (groupQuery.data?.items as CampaignCardGroup[] | undefined ?? []).map((group) => ({
			key: group.key, name: group.name, brand: group.brand, status: group.status,
			creatorNames: group.creator_names, deals: [group.deal], total: group.total, invoices_uploaded: group.invoices_uploaded,
			costToClient: group.cost_to_client, costToUs: group.cost_to_us
		}))
		: [];
	const pagedCreatorGroups: CreatorGroup[] = groupBy === 'creator'
		? (groupQuery.data?.items as CreatorCardGroup[] | undefined ?? []).map((group) => ({
			key: group.key, name: group.name, relationship: group.relationship,
			deals: [group.deal], dealCount: group.deal_count, total: group.total, invoices_uploaded: group.invoices_uploaded
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
	}, [urlHydrated, debouncedSearch, dirFilter, statusFilter, creatorFilter, months, groupBy, viewMode, fyStart]);

	React.useEffect(() => {
		const lastPage = Math.max(1, Math.ceil(resultTotal / pageSize));
		if (page > lastPage) setPage(lastPage);
	}, [page, resultTotal]);

	return (
		<>
			<section className="space-y-5">
				{/* ── Header ── */}
				<PageHeader title="Campaign Tracking" description={`${totals.count} deal${totals.count !== 1 ? 's' : ''} · FY ${fyStart}–${((fyStart ?? 0) + 1).toString().slice(2)}`} actions={<>
					<div className="flex items-center gap-2.5">
						<div className="flex items-center rounded-lg overflow-hidden border" style={{ borderColor: 'var(--n-border)', background: 'var(--n-bg)' }}>
							<button
								type="button"
								onClick={() => setViewMode('cards')}
								title="Card view"
								style={viewMode === 'cards'
									? { background: 'var(--n-accent)', color: '#fff' }
									: { background: 'transparent', color: 'var(--n-accent)', opacity: 0.45 }
								}
								className="h-7 w-7 flex items-center justify-center transition-colors duration-100"
							>
								<Icon name="grid" size={12} />
							</button>
							<button
								type="button"
								onClick={() => setViewMode('table')}
								title="Table view"
								style={viewMode === 'table'
									? { background: 'var(--n-accent)', color: '#fff' }
									: { background: 'transparent', color: 'var(--n-accent)', opacity: 0.45 }
								}
								className="h-7 w-7 flex items-center justify-center transition-colors duration-100"
							>
								<Icon name="list" size={12} />
							</button>
						</div>

						<Button variant="primary" size="sm" onClick={startAdd}
							style={{
								fontSize: 11
							}}
						>
							<Icon name="plus" size={12} />
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

				<CommercialFilterBar
					statusFilter={statusFilter}
					setStatusFilter={setStatusFilter}
					q={q}
					setQ={setQ}
					viewMode={viewMode}
					groupBy={groupBy}
					setGroupBy={setGroupBy}
					dirFilter={dirFilter}
					setDirFilter={setDirFilter}
					creatorFilter={creatorFilter}
					setCreatorFilter={setCreatorFilter}
					months={months}
					setMonths={setMonths}
					creatorNames={creatorNames}
					availMonths={availMonths}
					resetFilters={resetFilters}
				/>

				{/* ── Content ── */}
				{loading ? (
					<div className="flex items-center justify-center gap-3 py-16" style={{ color: 'var(--n-fg-subtle)' }}>
						<svg className="animate-spin h-5 w-5" style={{ willChange: 'transform' }} viewBox="0 0 24 24" fill="none">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
							<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
						</svg>
						<span className="text-[14px]">Loading campaigns…</span>
					</div>
				) : error ? (
					<QueryErrorState description="Campaign data is temporarily unavailable." onRetry={() => activeQuery.refetch()} />
				) : viewMode === 'table' ? (
					<>
						<CommercialTable deals={pagedDeals} onEdit={startEdit} />
						{resultTotal === 0 && renderEmptyState('deals')}
						{resultTotal > 0 && <Pagination page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} className="mt-4" />}
					</>
				) : groupBy === 'campaign' ? (
					<div className="anim-fade-up">
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{pagedCampaignGroups.map((group) => (
								<CampaignGroupCard key={group.key} group={group} onView={startEdit} />
							))}
						</div>
						{resultTotal === 0 && renderEmptyState('campaigns')}
						{resultTotal > 0 && <Pagination page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} className="mt-8 pt-4" />}
					</div>
				) : (
					<div className="anim-fade-up">
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{pagedCreatorGroups.map((group) => (
								<CreatorGroupCard key={group.key} group={group} onView={startEdit} />
							))}
						</div>
						{resultTotal === 0 && renderEmptyState('deals')}
						{resultTotal > 0 && <Pagination page={page} pageSize={pageSize} total={resultTotal} onPageChange={setPage} className="mt-8 pt-4" />}
					</div>
				)}
			</section>

			<CampaignFormModal
				open={open}
				onOpenChange={setOpen}
				title={editing ? 'Edit Campaign' : 'Add Campaign'}
				submitLabel={editing ? 'Save' : 'Create'}
				initial={initialForm}
				campaignNames={campaigns.map((c) => c.name)}
				onSubmit={submit}
			/>
		</>
	);
}
