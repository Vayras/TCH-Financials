'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import MuiButton from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { api, ConflictError, type Deal, type Creator, type Campaign } from '@/lib/api';
import { inr } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';
import type { CampaignGroup, CardGroupBy, CreatorGroup, DealForm, DirFilter, ShareForm } from '@/types/deal';
import {
	billingPeriodOf,
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
import MetricCard from '@/components/MetricCard';
import { CampaignGroupCard, CreatorGroupCard } from '@/components/CampaignCards';
import CampaignDetailModal from '@/components/CampaignDetailModal';
import CampaignFormModal, { type CampaignFormResult } from '@/components/CampaignFormModal';
import { uploadCreatorDocument } from '@/lib/creators';

export default function CommercialPage() {
	const [rows, setRows] = React.useState<Deal[]>([]);
	const [creators, setCreators] = React.useState<Creator[]>([]);
	const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Deal | null>(null);
	const [q, setQ] = React.useState('');
	const [dirFilter, setDirFilter] = React.useState<DirFilter>('All');
	// Multi-month filter: empty = all months of the selected fiscal year.
	const [months, setMonths] = React.useState<string[]>([]);
	const { fyStart } = useFiscalYear();
	const [creatorFilter, setCreatorFilter] = React.useState('All');
	const [groupBy, setGroupBy] = React.useState<CardGroupBy>(() => {
		if (typeof window === 'undefined') return 'campaign';
		const saved = window.localStorage.getItem('commercial-card-group');
		return saved === 'campaign' || saved === 'creator' ? saved : 'campaign';
	});
	const [detail, setDetail] = React.useState<Deal | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		let shown = false;
		try {
			// fy scopes the payload server-side to the selected fiscal year
			// (plus not-yet-invoiced deals for the backfill banner) — the page
			// never shows other years, so don't download them. Each feed
			// renders from cache instantly and updates when the network lands.
			await Promise.all([
				api.getSWR<Deal[]>(`/deals/?fy=${fyStart}`, (d) => {
					shown = true;
					setRows(d);
					setLoading(false);
				}),
				api.getSWR<Creator[]>('/creators/', setCreators),
				api.getSWR<Campaign[]>('/campaigns/', setCampaigns)
			]);
		} catch (e) {
			if (!shown) setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, [fyStart]);

	React.useEffect(() => {
		load();
	}, [load]);

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
				agency_fee_inr: s.agency_fee_inr
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
					buildShare(form.creator, form.total_fee, form.agency_fee_inr),
					...shares.map((s) => buildShare(s.creator, s.total_fee, s.agency_fee_inr))
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
			if (editing) {
				await api.patch(`/deals/${editing.id}/`, { ...payload, version: editing.version });
			} else {
				await api.post('/deals/', payload);
			}
			// Invoice files are stored as documents on the primary creator until
			// deals grow their own attachment field on the backend.
			const creatorId = form.creator ? Number(form.creator) : null;
			if (creatorId) {
				const uploads: [File | null, string][] = [
					[clientInvoiceFile, `Client Invoice — ${form.campaign || form.brand}`],
					[creatorInvoiceFile, `Creator Invoice — ${form.campaign || form.brand}`]
				];
				for (const [file, label] of uploads) {
					if (!file) continue;
					try {
						await uploadCreatorDocument(creatorId, 'Other', file, label);
					} catch {
						alert(`Campaign saved, but "${label}" failed to upload.`);
					}
				}
			}
			setOpen(false);
			await load();
		} catch (e) {
			alert((e as Error).message);
			if (e instanceof ConflictError) {
				setOpen(false);
				await load();
			}
		}
	}

	async function remove(d: Deal) {
		if (!confirm(`Delete campaign for "${d.creator_name}" / brand "${d.brand}"?`)) return;
		await api.del(`/deals/${d.id}/`);
		await load();
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

	// Deals are tracked strictly by the billing month (E-Invoice No, falling
	// back to invoice date) — the same rule the Overview uses, so the two pages
	// always agree.
	const trackDate = React.useCallback((r: Deal) => billingPeriodOf(r), []);

	// Deals that can't be placed in a fiscal year because they lack the tracking
	// date — surfaced for ops to backfill rather than silently dropped.
	const missingDate = React.useMemo(() => {
		return rows.filter((r) => {
			if (dirFilter !== 'All' && r.direction !== dirFilter) return false;
			if (creatorFilter !== 'All' && !creatorNamesOf(r).includes(creatorFilter)) return false;
			return !trackDate(r);
		});
	}, [rows, dirFilter, creatorFilter, trackDate]);

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
			// Scope strictly to the selected period by the tracking date. Rows
			// with no such date can't be attributed to a fiscal year and are
			// hidden (see the backfill banner for the count).
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

	// Headline billing: every deal invoiced in the selected period.
	const billingSummary = React.useMemo(() => {
		let invoiced = 0;
		for (const r of rows) {
			if (!matchesFacets(r)) continue;
			if (inPeriod(billingPeriodOf(r))) invoiced += Number(r.total_fee) || 0;
		}
		return { invoiced };
	}, [rows, matchesFacets, inPeriod]);

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
			<Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
				<Box component="header">
					<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
						<Typography component="h1" className="page-title" sx={{ color: 'var(--n-fg)', fontSize: 28, lineHeight: 1.2, fontWeight: 700 }}>
							Campaign Tracking
						</Typography>
						<MuiButton variant="contained" onClick={startAdd} startIcon={<Icon name="plus" size={14} />} sx={{ bgcolor: 'var(--n-accent)', textTransform: 'none', '&:hover': { bgcolor: '#380e44' } }}>
							Add Campaign
						</MuiButton>
					</Box>
				</Box>

				<Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
					<MetricCard label="Invoiced Billing" value={`₹ ${inr(billingSummary.invoiced)}`} />
					<MetricCard label="Deals" value={totals.count} />
				</Box>

				<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
					<TextField
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search creator, brand, campaign…"
						size="small"
						sx={{ flex: '1 1 260px', minWidth: 220 }}
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<Icon name="search" size={14} />
									</InputAdornment>
								)
							}
						}}
					/>
					<TextField
						select
						size="small"
						label="Deal Type"
						value={dirFilter}
						onChange={(e) => setDirFilter(e.target.value as DirFilter)}
						sx={{ flex: '0 1 140px', minWidth: 120 }}
					>
						{(['All', 'Inbound', 'Outbound'] as DirFilter[]).map((d) => (
							<MenuItem key={d} value={d}>
								{d}
							</MenuItem>
						))}
					</TextField>
					<TextField
						select
						size="small"
						label="Creator"
						value={creatorFilter}
						onChange={(e) => setCreatorFilter(e.target.value)}
						sx={{ flex: '0 1 200px', minWidth: 150 }}
					>
						<MenuItem value="All">All creators</MenuItem>
						{creatorNames.map((n) => (
							<MenuItem key={n} value={n}>{n}</MenuItem>
						))}
					</TextField>
					<TextField
						select
						size="small"
						label="Months"
						value={months}
						onChange={(e) => {
							const v = e.target.value;
							setMonths(typeof v === 'string' ? (v ? v.split(',') : []) : v);
						}}
						sx={{ flex: '0 1 220px', minWidth: 170 }}
						slotProps={{
							select: {
								multiple: true,
								displayEmpty: true,
								renderValue: (selected) => {
									const sel = selected as string[];
									if (sel.length === 0) return 'All months';
									return sel
										.slice()
										.sort((a, b) => FY_MONTH_ORDER.indexOf(a) - FY_MONTH_ORDER.indexOf(b))
										.map((mm) => MONTH_NAMES[Number(mm)])
										.join(', ');
								}
							},
							inputLabel: { shrink: true }
						}}
					>
						{availMonths.map((mm) => (
							<MenuItem key={mm} value={mm}>{MONTH_NAMES[Number(mm)]}</MenuItem>
						))}
					</TextField>
					<TextField
						select
						size="small"
						label="Group by"
						value={groupBy}
						onChange={(e) => setGroupBy(e.target.value as CardGroupBy)}
						sx={{ flex: '0 1 140px', minWidth: 120 }}
					>
						<MenuItem value="campaign">Campaign</MenuItem>
						<MenuItem value="creator">Creator</MenuItem>
					</TextField>
					{filtersActive && (
						<MuiButton variant="text" onClick={resetFilters} sx={{ height: 40, textTransform: 'none' }}>
							Reset filters
						</MuiButton>
					)}
				</Box>

				{missingDate.length > 0 && (
					<Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: 13 } }}>
						{missingDate.length} deal{missingDate.length === 1 ? '' : 's'} {missingDate.length === 1 ? 'has' : 'have'} no{' '}
						E-Invoice No or invoice date and{' '}
						{missingDate.length === 1 ? "isn't" : "aren't"} counted in any
						period — backfill {missingDate.length === 1 ? 'it' : 'them'} to include {missingDate.length === 1 ? 'it' : 'them'} in billing totals.
					</Alert>
				)}

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
			</Box>

			<CampaignDetailModal
				deal={detail}
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
