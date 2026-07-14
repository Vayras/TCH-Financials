'use client';

import * as React from 'react';
import { ConflictError, type Deal, type Creator, type Campaign, type DealDocument } from '@/lib/api';
import { inr } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';
import type { CampaignGroup, CardGroupBy, CreatorGroup, DealForm, DirFilter, ShareForm } from '@/types/deal';
import {
	buildShare,
	calYearOfMonth,
	creatorNamesOf,
	EMPTY_DEAL_FORM,
	FY_MONTH_ORDER,
	fyStartOf,
	MONTH_NAMES,
	normalisePctString
} from '@/lib/deals';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import MetricCard from '@/components/MetricCard';
import { CampaignGroupCard, CreatorGroupCard } from '@/components/CampaignCards';
import CampaignDetailModal from '@/components/CampaignDetailModal';
import CampaignFormModal, { type CampaignFormResult } from '@/components/CampaignFormModal';
import { uploadCreatorDocument } from '@/lib/creators';
import {
	useCommercialDealsQuery,
	useCommercialCreatorsQuery,
	useCommercialCampaignsQuery,
	useCommercialDocsQuery,
	useSaveDealMutation,
	useDeleteDealMutation
} from './queries';

export default function CommercialPage() {
	const { fyStart } = useFiscalYear();

	const { data: rows = [], isLoading: dealsLoading, error: dealsError } = useCommercialDealsQuery(fyStart);
	const { data: creators = [], isLoading: creatorsLoading } = useCommercialCreatorsQuery();
	const { data: campaigns = [], isLoading: campaignsLoading } = useCommercialCampaignsQuery();
	const { data: docs = [], isLoading: docsLoading } = useCommercialDocsQuery();

	const loading = dealsLoading || creatorsLoading || campaignsLoading || docsLoading;
	const error = dealsError ? dealsError.message : null;

	const saveDealMutation = useSaveDealMutation(fyStart);
	const deleteDealMutation = useDeleteDealMutation(fyStart);

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
	const [detail, setDetail] = React.useState<Deal | null>(null);

	React.useEffect(() => {
		window.localStorage.setItem('commercial-card-group', groupBy);
	}, [groupBy]);

	function startAdd() {
		setEditing(null);
		setOpen(true);
	}

	function startEdit(d: Deal) {
		setEditing(d);
		setOpen(true);
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
			await saveDealMutation.mutateAsync({
				editingId: editing?.id,
				editingVersion: editing?.version,
				payload,
				clientInvoiceFile,
				creatorInvoiceFile
			});
			setOpen(false);
		} catch (e) {
			alert((e as Error).message);
			if (e instanceof ConflictError) {
				setOpen(false);
			}
		}
	}

	async function remove(d: Deal) {
		try {
			await deleteDealMutation.mutateAsync(d.id);
		} catch (e) {
			alert((e as Error).message);
		}
	}

	// Distinct creator names across the loaded deals (primary + split rows) —
	// powers the creator filter; a multi-creator deal appears under every name.
	const creatorNames = React.useMemo(() => {
		const set = new Set<string>();
		for (const r of rows) for (const n of creatorNamesOf(r)) if (n.trim()) set.add(n.trim());
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	}, [rows]);

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

	// Deals are tracked primarily by their E-invoice date. If a deal hasn't
	// been invoiced yet, it falls back to the confirmation date.
	const trackDate = React.useCallback((r: Deal) => r.e_invoice_date || r.confirmation_date, []);

	// Non-period filters (direction, creator, search) — shared between the
	// visible list and the billing summary so the two always describe the same
	// slice of deals.
	const matchesFacets = React.useCallback(
		(r: Deal) => {
			if (dirFilter !== 'All' && r.direction !== dirFilter) return false;
			if (creatorFilter !== 'All' && !creatorNamesOf(r).includes(creatorFilter)) return false;
			const needle = q.trim().toLowerCase();
			if (!needle) return true;
			return (
				creatorNamesOf(r).some((n) => n.toLowerCase().includes(needle)) ||
				r.brand?.toLowerCase().includes(needle) ||
				r.campaign?.toLowerCase().includes(needle) ||
				r.ro_number?.toLowerCase().includes(needle)
			);
		},
		[dirFilter, creatorFilter, q]
	);

	// Does a date fall inside the selected FY + months scope?
	const inPeriod = React.useCallback(
		(d: string | null) => {
			if (!d || fyStartOf(d) !== fyStart) return false;
			if (months.length === 0) return true;
			return months.includes(d.split('-')[1]);
		},
		[fyStart, months]
	);

	const filtered = React.useMemo(() => {
		const list = rows.filter((r) => {
			if (!matchesFacets(r)) return false;
			return inPeriod(trackDate(r));
		});
		return list.slice().sort((a, b) => {
			const ad = trackDate(a);
			const bd = trackDate(b);
			if (!ad && !bd) return 0;
			if (!ad) return 1;
			if (!bd) return -1;
			return bd.localeCompare(ad);
		});
	}, [rows, matchesFacets, inPeriod, trackDate]);

	// Headline billing: every deal confirmed in the selected period — the same
	// rule as the visible list, so the metric always matches the cards.
	const billingSummary = React.useMemo(() => {
		let invoiced = 0;
		for (const r of rows) {
			if (!matchesFacets(r)) continue;
			if (inPeriod(trackDate(r))) invoiced += Number(r.total_fee) || 0;
		}
		return { invoiced };
	}, [rows, matchesFacets, inPeriod, trackDate]);

	function resetFilters() {
		setCreatorFilter('All');
		setMonths([]);
		setDirFilter('All');
		setQ('');
	}

	const totals = React.useMemo(() => ({ count: filtered.length }), [filtered]);

	// Rolled-up groups for the Creator card layout. A deal with multiple
	// creators contributes to each of its creators' groups (so filtering by a
	// creator surfaces every campaign they appear in), splitting the fee by
	// the per-creator share where available.
	const creatorGroups = React.useMemo<CreatorGroup[]>(() => {
		const map = new Map<string, CreatorGroup>();
		const add = (rawName: string, relationship: string | undefined, r: Deal, total: number) => {
			const name = rawName || '—';
			const key = name.toLowerCase();
			const group = map.get(key) ?? { key, name, relationship, deals: [], total: 0 };
			group.deals.push(r);
			group.total += total;
			if (!group.relationship) group.relationship = relationship;
			map.set(key, group);
		};
		for (const r of filtered) {
			if (r.creator_shares && r.creator_shares.length > 0) {
				for (const s of r.creator_shares) {
					add(s.creator_name || s.creator_name_raw, s.creator_relationship, r, Number(s.total_fee) || 0);
				}
			} else {
				add(r.creator_name || r.creator_name_raw, r.creator_relationship, r, Number(r.total_fee) || 0);
			}
		}
		return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [filtered]);

	// One card per campaign: every deal sharing a campaign rolls into a single
	// group so its creators are listed together instead of appearing as separate
	// "campaigns". Deals with no campaign stay individual (keyed by deal id) so
	// they aren't lumped into one anonymous bucket. Fees sum across the
	// campaign's deals; creator names are deduped in first-seen order.
	const campaignGroups = React.useMemo<CampaignGroup[]>(() => {
		const map = new Map<string, CampaignGroup>();
		for (const r of filtered) {
			const key = r.campaign_id != null ? `c${r.campaign_id}` : `d${r.id}`;
			const name = r.campaign || r.brand || '—';
			const group = map.get(key) ?? {
				key,
				name,
				brand: r.brand,
				status: r.campaign_status,
				creatorNames: [],
				deals: [],
				total: 0
			};
			group.deals.push(r);
			group.total += Number(r.total_fee) || 0;
			if (!group.brand) group.brand = r.brand;
			for (const n of creatorNamesOf(r)) {
				if (n && !group.creatorNames.includes(n)) group.creatorNames.push(n);
			}
			map.set(key, group);
		}
		return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [filtered]);

	return (
		<>
			<section className="space-y-6">
				<header className="flex items-end justify-between flex-wrap gap-3">
					<h1 className="page-title text-[28px] leading-[1.2] font-bold" style={{ color: 'var(--n-fg)' }}>
						Campaign Tracking
					</h1>
					<Button variant="primary" size="md" onClick={startAdd}>
						<Icon name="plus" size={14} /> Add Campaign
					</Button>
				</header>

				<div className="grid grid-cols-2 gap-2">
					<MetricCard label="Billing" value={`₹ ${inr(billingSummary.invoiced) || '0'}`} />
					<MetricCard label="Deals" value={totals.count} />
				</div>

				<div className="flex flex-wrap items-end gap-2">
					<div className="relative flex-1 min-w-[260px]">
							<span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--n-fg-subtle)' }}>
								<Icon name="search" size={14} />
							</span>
							<input
								value={q}
								onChange={(e) => setQ(e.target.value)}
								placeholder="Search creator, brand, campaign…"
								className="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
							/>
						</div>
					<label className="flex flex-col gap-1 min-w-[120px] text-[11.5px] font-medium" style={{ color: 'var(--n-fg-subtle)' }}>
						Deal Type
						<select value={dirFilter} onChange={(e) => setDirFilter(e.target.value as DirFilter)} className="h-8 rounded px-2 text-[14px] font-normal bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)]">
							{(['All', 'Inbound', 'Outbound'] as DirFilter[]).map((d) => <option key={d} value={d}>{d}</option>)}
						</select>
					</label>
					<label className="flex flex-col gap-1 min-w-[170px] text-[11.5px] font-medium" style={{ color: 'var(--n-fg-subtle)' }}>
						Creator
						<select value={creatorFilter} onChange={(e) => setCreatorFilter(e.target.value)} className="h-8 rounded px-2 text-[14px] font-normal bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)]">
							<option value="All">All creators</option>
							{creatorNames.map((n) => <option key={n} value={n}>{n}</option>)}
						</select>
					</label>
					<label className="flex flex-col gap-1 min-w-[150px] text-[11.5px] font-medium" style={{ color: 'var(--n-fg-subtle)' }}>
						Month
						<select value={months[0] ?? ''} onChange={(e) => setMonths(e.target.value ? [e.target.value] : [])} className="h-8 rounded px-2 text-[14px] font-normal bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)]">
							<option value="">All months</option>
							{availMonths.map((mm) => <option key={mm} value={mm}>{MONTH_NAMES[Number(mm)]}</option>)}
						</select>
					</label>
					<label className="flex flex-col gap-1 min-w-[130px] text-[11.5px] font-medium" style={{ color: 'var(--n-fg-subtle)' }}>
						Group by
						<select value={groupBy} onChange={(e) => setGroupBy(e.target.value as CardGroupBy)} className="h-8 rounded px-2 text-[14px] font-normal bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)]">
							<option value="campaign">Campaign</option>
							<option value="creator">Creator</option>
						</select>
					</label>
					{filtersActive && <Button variant="ghost" onClick={resetFilters}>Reset filters</Button>}
				</div>

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
				) : groupBy === 'campaign' ? (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{campaignGroups.map((group) => (
								<CampaignGroupCard key={group.key} group={group} onView={setDetail} />
							))}
						</div>
						{campaignGroups.length === 0 && (
							<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
								No campaigns match the current filters.
							</div>
						)}
					</>
				) : (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{creatorGroups.map((group) => (
								<CreatorGroupCard key={group.key} group={group} onView={setDetail} />
							))}
						</div>
						{filtered.length === 0 && (
							<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
								No deals match the current filters.
							</div>
						)}
					</>
				)}
			</section>

			<CampaignDetailModal
				deal={detail}
				docs={docs.filter((d) => d.deal === detail?.id)}
				onClose={() => setDetail(null)}
				onEdit={startEdit}
				onDelete={remove}
			/>

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
