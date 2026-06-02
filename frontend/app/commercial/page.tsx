'use client';

import * as React from 'react';
import { api, type Deal, type Creator } from '@/lib/api';
import { inr } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import { useFiscalYear } from '@/lib/fiscal-year';

const DIRECTION = [
	{ value: 'Inbound', label: 'Inbound' },
	{ value: 'Outbound', label: 'Outbound' },
	{ value: 'MarkUp', label: 'Mark Up' }
];
const YN = [
	{ value: 'Y', label: 'Yes' },
	{ value: 'N', label: 'No' }
];

type DealForm = {
	confirmation_date: string;
	e_invoice_date: string;
	creator: string;
	creator_name_raw: string;
	tch_poc: string;
	direction: string;
	total_fee: string;
	agency_fee_pct: string;
	agency_fee_inr: string;
	creator_fee: string;
	billing_entity: string;
	brand: string;
	brand_poc: string;
	campaign: string;
	deliverables: string;
	ro_number: string;
	campaign_over: string;
	invoice_received: string;
	payment_cleared: string;
	e_invoice_number: string;
	payment_received: string;
	comments: string;
};

const EMPTY_FORM: DealForm = {
	confirmation_date: '',
	e_invoice_date: '',
	creator: '',
	creator_name_raw: '',
	tch_poc: '',
	direction: 'Outbound',
	total_fee: '',
	agency_fee_pct: '',
	agency_fee_inr: '',
	creator_fee: '',
	billing_entity: '',
	brand: '',
	brand_poc: '',
	campaign: '',
	deliverables: '',
	ro_number: '',
	campaign_over: '',
	invoice_received: '',
	payment_cleared: '',
	e_invoice_number: '',
	payment_received: '',
	comments: ''
};

function relTone(rel?: string) {
	if (rel === 'Exclusive') return 'exclusive' as const;
	if (rel === 'Dropping') return 'dropping' as const;
	if (rel === 'NonTCH') return 'nontch' as const;
	return 'friend' as const;
}
function dirTone(dir: string) {
	if (dir === 'Inbound') return 'inbound' as const;
	if (dir === 'Outbound') return 'outbound' as const;
	return 'markup' as const;
}
function isEmw(billing: string) {
	const b = (billing || '').toUpperCase();
	return b.includes('EMW') || b.includes('ELEMENTS MEDIAWORK');
}
function pctText(p: string): string {
	const n = Number(p);
	if (!Number.isFinite(n) || n <= 0) return '';
	return `${(n * 100).toFixed(0)}%`;
}

// Indian fiscal year runs Apr → Mar. These mirror the backend aggregation so
// client-side period filtering lines up with Current Overview / Entity Summary.
function fyStartOf(iso: string): number {
	const [y, m] = iso.split('-').map(Number);
	return m >= 4 ? y : y - 1;
}
function fyLabelShort(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

type DirFilter = 'All' | 'Inbound' | 'Outbound' | 'MarkUp';
type DateBasis = 'confirmation' | 'invoice';

export default function CommercialPage() {
	const [rows, setRows] = React.useState<Deal[]>([]);
	const [creators, setCreators] = React.useState<Creator[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Deal | null>(null);
	const [q, setQ] = React.useState('');
	const [dirFilter, setDirFilter] = React.useState<DirFilter>('All');
	const { fyStart } = useFiscalYear();
	const [entityFilter, setEntityFilter] = React.useState('All');
	const [basis, setBasis] = React.useState<DateBasis>('confirmation');
	const [form, setForm] = React.useState<DealForm>(EMPTY_FORM);

	const load = React.useCallback(async () => {
		setLoading(true);
		try {
			const [d, c] = await Promise.all([
				api.get<Deal[]>('/deals/'),
				api.get<Creator[]>('/creators/')
			]);
			setRows(d);
			setCreators(c);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		load();
	}, [load]);

	// Agency fee % and Agency fee (INR) are kept in sync both ways: editing the
	// % derives the INR, editing the INR derives the %. feeBasis remembers which
	// one the user drove last so changing Total Fee recomputes the right one.
	const feeBasis = React.useRef<'pct' | 'inr'>('pct');
	function recomputeFees(next: DealForm): DealForm {
		const total = Number(next.total_fee);
		if (!Number.isFinite(total) || total <= 0) return next;
		if (feeBasis.current === 'inr') {
			const inr = Number(next.agency_fee_inr);
			if (!Number.isFinite(inr) || inr <= 0) return next;
			return {
				...next,
				agency_fee_pct: (inr / total).toFixed(4),
				creator_fee: (total - inr).toFixed(2)
			};
		}
		const p = Number(next.agency_fee_pct);
		if (!Number.isFinite(p) || p <= 0) return next;
		const pct = p <= 1 ? p : p / 100;
		const inr = total * pct;
		return { ...next, agency_fee_inr: inr.toFixed(2), creator_fee: (total - inr).toFixed(2) };
	}

	// Mark Up deals can't be on exclusive creators — clear a now-hidden pick.
	React.useEffect(() => {
		if (form.direction === 'MarkUp' && form.creator) {
			const c = creators.find((x) => String(x.id) === form.creator);
			if (c && c.relationship === 'Exclusive') setForm((f) => ({ ...f, creator: '' }));
		}
	}, [form.direction, form.creator, creators]);

	function startAdd() {
		setEditing(null);
		setForm({
			...EMPTY_FORM,
			confirmation_date: new Date().toISOString().slice(0, 10)
		});
		setOpen(true);
	}

	function startEdit(d: Deal) {
		setEditing(d);
		setForm({
			confirmation_date: d.confirmation_date ?? '',
			e_invoice_date: d.e_invoice_date ?? '',
			creator: d.creator ? String(d.creator) : '',
			creator_name_raw: d.creator_name_raw,
			tch_poc: d.tch_poc ?? '',
			direction: d.direction,
			total_fee: d.total_fee,
			agency_fee_pct: d.agency_fee_pct,
			agency_fee_inr: d.agency_fee_inr,
			creator_fee: d.creator_fee,
			billing_entity: d.billing_entity,
			brand: d.brand,
			brand_poc: d.brand_poc ?? '',
			campaign: d.campaign,
			deliverables: d.deliverables,
			ro_number: d.ro_number,
			campaign_over: d.campaign_over,
			invoice_received: d.invoice_received,
			payment_cleared: d.payment_cleared,
			e_invoice_number: d.e_invoice_number,
			payment_received: d.payment_received,
			comments: d.comments
		});
		setOpen(true);
	}

	async function submit() {
		const payload = {
			...form,
			creator: form.creator ? Number(form.creator) : null,
			confirmation_date: form.confirmation_date || null,
			e_invoice_date: form.e_invoice_date || null,
			total_fee: form.total_fee || '0',
			agency_fee_pct: form.agency_fee_pct || '0',
			agency_fee_inr: form.agency_fee_inr || '0',
			creator_fee: form.creator_fee || '0'
		};
		try {
			if (editing) {
				await api.patch(`/deals/${editing.id}/`, payload);
			} else {
				await api.post('/deals/', payload);
			}
			setOpen(false);
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function remove(d: Deal) {
		if (!confirm(`Delete campaign for "${d.creator_name}" / brand "${d.brand}"?`)) return;
		await api.del(`/deals/${d.id}/`);
		await load();
	}

	// Distinct billing entities across all deals — powers the entity filter and
	// the Add/Edit Deal dropdown so billing under one company stays consistent.
	const entities = React.useMemo(() => {
		const set = new Set<string>();
		for (const r of rows) {
			const be = r.billing_entity?.trim();
			if (be) set.add(be);
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	}, [rows]);

	const periodActive = entityFilter !== 'All';

	const filtered = React.useMemo(() => {
		const needle = q.trim().toLowerCase();
		const list = rows.filter((r) => {
			if (dirFilter !== 'All' && r.direction !== dirFilter) return false;
			if (entityFilter !== 'All' && (r.billing_entity || '').trim() !== entityFilter)
				return false;
			const d = basis === 'invoice' ? r.e_invoice_date : r.confirmation_date;
			// Scope strictly to the site-wide fiscal year: a deal only belongs to
			// the selected FY if its tracking date (conf or invoice) falls inside
			// it. Rows with no date for the chosen basis are not attributable to a
			// year and are hidden — switch "Track by" if a deal has only one date.
			if (!d || fyStartOf(d) !== fyStart) return false;
			if (!needle) return true;
			return (
				r.creator_name?.toLowerCase().includes(needle) ||
				r.brand?.toLowerCase().includes(needle) ||
				r.campaign?.toLowerCase().includes(needle) ||
				r.billing_entity?.toLowerCase().includes(needle) ||
				r.ro_number?.toLowerCase().includes(needle)
			);
		});
		return list.slice().sort((a, b) => {
			const ad = basis === 'invoice' ? a.e_invoice_date : a.confirmation_date;
			const bd = basis === 'invoice' ? b.e_invoice_date : b.confirmation_date;
			if (!ad && !bd) return 0;
			if (!ad) return 1;
			if (!bd) return -1;
			return bd.localeCompare(ad);
		});
	}, [rows, q, dirFilter, entityFilter, basis, fyStart]);

	function resetFilters() {
		setEntityFilter('All');
	}

	const totals = React.useMemo(() => {
		let total = 0;
		let profit = 0;
		for (const r of filtered) {
			total += Number(r.total_fee || 0);
			profit += Number(r.agency_fee_inr || 0);
		}
		return { total, profit, count: filtered.length };
	}, [filtered]);

	const set = <K extends keyof DealForm>(k: K, v: DealForm[K]) =>
		setForm((f) => ({ ...f, [k]: v }));

	return (
		<>
			<section className="space-y-6">
				<header className="space-y-2">
					<div
						className="text-[12px] font-medium uppercase"
						style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
					>
						Workspace · Campaign
					</div>
					<div className="flex items-end justify-between flex-wrap gap-3">
						<div>
							<h1
								className="page-title text-[40px] leading-[1.15] font-bold"
								style={{ color: 'var(--n-fg)' }}
							>
								Campaign Tracking
							</h1>
							<p
								className="text-[15px] max-w-[640px] mt-2"
								style={{ color: 'var(--n-fg-muted)' }}
							>
								Single source of truth for billing. Add a campaign here — Current Overview and
								Quarterly Exclusives recompute automatically.
							</p>
						</div>
						<Button variant="primary" onClick={startAdd}>
							<Icon name="plus" size={14} /> Add Campaign
						</Button>
					</div>
				</header>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Campaigns shown
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{totals.count}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Total Billing
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							₹ {inr(totals.total)}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							<span className="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]" />
							TCH Profit
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							₹ {inr(totals.profit)}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Profit Ratio
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{totals.total > 0 ? `${((totals.profit / totals.total) * 100).toFixed(1)}%` : '—'}
						</div>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<div className="relative flex-1 min-w-[260px]">
						<span
							className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
							style={{ color: 'var(--n-fg-subtle)' }}
						>
							<Icon name="search" size={14} />
						</span>
						<input
							type="text"
							placeholder="Search creator, brand, campaign, RO#, billing entity…"
							className="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
							value={q}
							onChange={(e) => setQ(e.target.value)}
						/>
					</div>
					<div className="seg-toggle">
						{(['All', 'Inbound', 'Outbound', 'MarkUp'] as DirFilter[]).map((d) => (
							<button
								key={d}
								type="button"
								className={cn(dirFilter === d && 'active')}
								onClick={() => setDirFilter(d)}
							>
								{d === 'MarkUp' ? 'Mark Up' : d}
							</button>
						))}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<div className="flex items-center gap-1.5">
						<span
							className="text-[11.5px] font-medium uppercase whitespace-nowrap"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Track by
						</span>
						<div className="seg-toggle">
							<button
								type="button"
								className={cn(basis === 'confirmation' && 'active')}
								onClick={() => setBasis('confirmation')}
							>
								Conf Date
							</button>
							<button
								type="button"
								className={cn(basis === 'invoice' && 'active')}
								onClick={() => setBasis('invoice')}
							>
								Invoice Date
							</button>
						</div>
					</div>
					<div className="min-w-[200px]">
						<Select
							value={entityFilter}
							onChange={(e) => setEntityFilter(e.target.value)}
							options={[
								{ value: 'All', label: 'All billing entities' },
								...entities.map((e) => ({ value: e, label: e }))
							]}
						/>
					</div>
					{periodActive && (
						<Button variant="ghost" onClick={resetFilters}>
							Reset filters
						</Button>
					)}
					<span
						className="text-[11.5px] font-medium uppercase whitespace-nowrap"
						style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						title="Set the fiscal year from the selector in the top bar"
					>
						Scoped to {fyLabelShort(fyStart)}
					</span>
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
				) : (
					<>
						<div className="ct-wrap">
							<table className="ct-table">
								<thead>
									<tr>
										<th className="ct-sticky-l1 ct-head w-[100px]">Conf Date</th>
										<th className="ct-sticky-l2 ct-head w-[200px]">Creator</th>
										<th className="ct-head w-[110px]">Direction</th>
										<th className="ct-head w-[120px] num">Total Fee</th>
										<th className="ct-head w-[60px] num">%</th>
										<th className="ct-head w-[120px] num">Agency Fee</th>
										<th className="ct-head w-[120px] num">Creator Fee</th>
										<th className="ct-head w-[200px]">Billing Entity</th>
										<th className="ct-head w-[160px]">Brand</th>
										<th className="ct-head w-[200px]">Campaign</th>
										<th className="ct-head w-[160px]">Deliverables</th>
										<th className="ct-head w-[140px]">RO #</th>
										<th className="ct-head w-[60px]" title="Campaign Over">
											Over
										</th>
										<th className="ct-head w-[70px]" title="Invoice Received">
											Inv
										</th>
										<th className="ct-head w-[70px]" title="Payment Cleared by TCH">
											Pay Clr
										</th>
										<th className="ct-head w-[140px]">E-Invoice #</th>
										<th className="ct-head w-[80px]" title="Payment Received by TCH">
											Pay Recv
										</th>
										<th className="ct-sticky-r ct-head w-[110px]">Actions</th>
									</tr>
								</thead>
								<tbody>
									{filtered.map((r) => (
										<tr key={r.id} className="ct-row">
											<td className="ct-sticky-l1 ct-cell whitespace-nowrap">
												{r.confirmation_date ? (
													<span className="tabular-nums" style={{ color: 'var(--n-fg)' }}>
														{r.confirmation_date}
													</span>
												) : (
													<Tag tone="markup">no date</Tag>
												)}
											</td>
											<td className="ct-sticky-l2 ct-cell">
												<div className="font-medium" style={{ color: 'var(--n-fg)' }}>
													{r.creator_name || '—'}
												</div>
												{r.creator_relationship && (
													<Tag tone={relTone(r.creator_relationship)} className="mt-0.5">
														{r.creator_relationship === 'NonTCH'
															? 'Non TCH'
															: r.creator_relationship}
													</Tag>
												)}
											</td>
											<td className="ct-cell">
												<Tag tone={dirTone(r.direction)}>{r.direction}</Tag>
											</td>
											<td
												className="ct-cell num font-semibold tabular-nums"
												style={{ color: 'var(--n-fg)' }}
											>
												{inr(r.total_fee)}
											</td>
											<td className="ct-cell num" style={{ color: 'var(--n-fg-muted)' }}>
												{pctText(r.agency_fee_pct)}
											</td>
											<td className="ct-cell num tabular-nums" style={{ color: '#1f6f43' }}>
												{inr(r.agency_fee_inr)}
											</td>
											<td
												className="ct-cell num tabular-nums"
												style={{ color: 'var(--n-fg-muted)' }}
											>
												{inr(r.creator_fee)}
											</td>
											<td className="ct-cell">
												<span style={{ color: 'var(--n-fg)' }}>{r.billing_entity}</span>
												{r.billing_entity && isEmw(r.billing_entity) && (
													<Tag tone="emw" className="ml-1">
														EMW
													</Tag>
												)}
											</td>
											<td className="ct-cell" style={{ color: 'var(--n-fg)' }}>
												{r.brand}
											</td>
											<td className="ct-cell" style={{ color: 'var(--n-fg-muted)' }}>
												{r.campaign}
											</td>
											<td className="ct-cell" style={{ color: 'var(--n-fg-muted)' }}>
												{r.deliverables}
											</td>
											<td
												className="ct-cell tabular-nums whitespace-nowrap"
												style={{ color: 'var(--n-fg-muted)' }}
											>
												{r.ro_number}
											</td>
											<td className="ct-cell text-center">
												{r.campaign_over === 'Y' ? (
													<Tag tone="yes">Y</Tag>
												) : r.campaign_over === 'N' ? (
													<Tag tone="no">N</Tag>
												) : null}
											</td>
											<td className="ct-cell text-center">
												{r.invoice_received === 'Y' ? (
													<Tag tone="yes">Y</Tag>
												) : r.invoice_received === 'N' ? (
													<Tag tone="no">N</Tag>
												) : null}
											</td>
											<td className="ct-cell text-center">
												{r.payment_cleared === 'Y' ? (
													<Tag tone="yes">Y</Tag>
												) : r.payment_cleared === 'N' ? (
													<Tag tone="no">N</Tag>
												) : null}
											</td>
											<td
												className="ct-cell tabular-nums whitespace-nowrap"
												style={{ color: 'var(--n-fg-muted)' }}
											>
												{r.e_invoice_number}
											</td>
											<td className="ct-cell text-center">
												{r.payment_received === 'Y' ? (
													<Tag tone="yes">Y</Tag>
												) : r.payment_received === 'N' ? (
													<Tag tone="no">N</Tag>
												) : null}
											</td>
											<td className="ct-sticky-r ct-cell">
												<div className="flex gap-1">
													<Button variant="ghost" onClick={() => startEdit(r)}>
														Edit
													</Button>
													<Button variant="danger" onClick={() => remove(r)}>
														Del
													</Button>
												</div>
											</td>
										</tr>
									))}
									{filtered.length === 0 && (
										<tr>
											<td
												className="ct-cell text-center py-6"
												style={{ color: 'var(--n-fg-subtle)' }}
												colSpan={18}
											>
												No campaigns match the current filters.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
						<div className="tbl-caption">
							<span>
								Tip · Conf Date and Creator stay pinned on the left, Actions on the right. Scroll
								horizontally to see more columns.
							</span>
						</div>
					</>
				)}
			</section>

			<Dialog
				open={open}
				onOpenChange={setOpen}
				title={editing ? 'Edit Campaign' : 'Add Campaign'}
				className="max-w-4xl"
				footer={
					<>
						<Button variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button variant="primary" onClick={submit}>
							{editing ? 'Save' : 'Create'}
						</Button>
					</>
				}
			>
				<div className="grid grid-cols-3 gap-3">
					<div>
						<Label>Confirmation Date</Label>
						<Input
							type="date"
							value={form.confirmation_date}
							onChange={(e) => set('confirmation_date', e.target.value)}
						/>
					</div>
					<div>
						<Label>E-Invoice Date</Label>
						<Input
							type="date"
							value={form.e_invoice_date}
							onChange={(e) => set('e_invoice_date', e.target.value)}
						/>
					</div>
					<div>
						<Label>Direction</Label>
						<Select
							value={form.direction}
							onChange={(e) => {
								const dir = e.target.value;
								// Mark Up deals: TCH enters the marked-up INR amount and the
								// commission % is derived from it. Other directions default
								// back to %-driven.
								feeBasis.current = dir === 'MarkUp' ? 'inr' : 'pct';
								setForm((f) => recomputeFees({ ...f, direction: dir }));
							}}
							options={DIRECTION}
						/>
					</div>

					<div className="col-span-2">
						<Label>Creator (pick from master)</Label>
						<Select
							value={form.creator}
							onChange={(e) => set('creator', e.target.value)}
							options={creators
								.filter(
									(c) => form.direction !== 'MarkUp' || c.relationship !== 'Exclusive'
								)
								.map((c) => ({
									value: String(c.id),
									label: `${c.name} · ${c.relationship}`
								}))}
							placeholder="— none —"
						/>
					</div>
					<div>
						<Label>Creator Name (raw, if not in master)</Label>
						<Input
							value={form.creator_name_raw}
							onChange={(e) => set('creator_name_raw', e.target.value)}
						/>
					</div>
					<div className="col-span-2">
						<Label>TCH POC (who worked on this)</Label>
						<Input
							value={form.tch_poc}
							onChange={(e) => set('tch_poc', e.target.value)}
							placeholder="TCH person handling this deal"
						/>
					</div>
					<div />

					<div>
						<Label>Total Fee (INR)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.total_fee}
							onChange={(e) =>
								setForm((f) => recomputeFees({ ...f, total_fee: e.target.value }))
							}
						/>
					</div>
					<div>
						<Label>Agency Fee %</Label>
						<Input
							type="number"
							step="0.0001"
							placeholder="0.20 = 20%"
							value={form.agency_fee_pct}
							onChange={(e) => {
								feeBasis.current = 'pct';
								setForm((f) => recomputeFees({ ...f, agency_fee_pct: e.target.value }));
							}}
						/>
					</div>
					<div>
						<Label>Agency Fee (INR)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.agency_fee_inr}
							onChange={(e) => {
								feeBasis.current = 'inr';
								setForm((f) => recomputeFees({ ...f, agency_fee_inr: e.target.value }));
							}}
						/>
					</div>
					<div className="col-span-2">
						<Label>Creator Fee (INR) — auto</Label>
						<Input
							type="number"
							step="0.01"
							value={form.creator_fee}
							onChange={(e) => set('creator_fee', e.target.value)}
						/>
					</div>
					<div>
						<Label>Billing Entity</Label>
						<Input
							list="billing-entities"
							value={form.billing_entity}
							onChange={(e) => set('billing_entity', e.target.value)}
							placeholder="Pick or type — EMW / MSL Group / …"
						/>
						<datalist id="billing-entities">
							{entities.map((e) => (
								<option key={e} value={e} />
							))}
						</datalist>
					</div>
					<div>
						<Label>Brand</Label>
						<Input value={form.brand} onChange={(e) => set('brand', e.target.value)} />
					</div>
					<div>
						<Label>Brand POC</Label>
						<Input
							value={form.brand_poc}
							onChange={(e) => set('brand_poc', e.target.value)}
							placeholder="Brand-side contact"
						/>
					</div>
					<div>
						<Label>Campaign</Label>
						<Input value={form.campaign} onChange={(e) => set('campaign', e.target.value)} />
					</div>

					<div className="col-span-2">
						<Label>Deliverables</Label>
						<Input
							value={form.deliverables}
							onChange={(e) => set('deliverables', e.target.value)}
						/>
					</div>
					<div>
						<Label>RO Number</Label>
						<Input value={form.ro_number} onChange={(e) => set('ro_number', e.target.value)} />
					</div>

					<div>
						<Label>Campaign Over</Label>
						<Select
							value={form.campaign_over}
							onChange={(e) => set('campaign_over', e.target.value)}
							options={YN}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Invoice Received</Label>
						<Select
							value={form.invoice_received}
							onChange={(e) => set('invoice_received', e.target.value)}
							options={YN}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Payment Cleared by TCH</Label>
						<Select
							value={form.payment_cleared}
							onChange={(e) => set('payment_cleared', e.target.value)}
							options={YN}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>E-Invoice # (TCH to Client)</Label>
						<Input
							value={form.e_invoice_number}
							onChange={(e) => set('e_invoice_number', e.target.value)}
						/>
					</div>
					<div>
						<Label>Payment Received by TCH</Label>
						<Select
							value={form.payment_received}
							onChange={(e) => set('payment_received', e.target.value)}
							options={YN}
							placeholder="—"
						/>
					</div>
					<div />

					<div className="col-span-3">
						<Label>Comments</Label>
						<Textarea
							value={form.comments}
							onChange={(e) => set('comments', e.target.value)}
						/>
					</div>
				</div>
			</Dialog>
		</>
	);
}
