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

const DIRECTION = [
	{ value: 'Inbound', label: 'Inbound' },
	{ value: 'Outbound', label: 'Outbound' },
	{ value: 'MarkUp', label: 'Mark Up' }
];
const YN = [
	{ value: 'Y', label: 'Y' },
	{ value: 'N', label: 'N' }
];

const CLIENT_PAY_STATUS = [
	{ value: 'Pending', label: 'Pending' },
	{ value: 'Partial', label: 'Partial' },
	{ value: 'Received', label: 'Received' },
	{ value: 'Overdue', label: 'Overdue' }
];
const CREATOR_PAY_STATUS = [
	{ value: 'Pending', label: 'Pending' },
	{ value: 'Scheduled', label: 'Scheduled' },
	{ value: 'Paid', label: 'Paid' },
	{ value: 'Overdue', label: 'Overdue' }
];
const PAY_CYCLES = [
	{ value: 'Immediate', label: 'Immediate' },
	{ value: 'Net15', label: 'Net 15' },
	{ value: 'Net30', label: 'Net 30' },
	{ value: 'Net45', label: 'Net 45' },
	{ value: 'Net60', label: 'Net 60' }
];

type ColumnGroup = 'deal' | 'finance_client' | 'finance_creator' | 'status';

type DealForm = {
	confirmation_date: string;
	e_invoice_date: string;
	creator: string;
	creator_name_raw: string;
	agency_commission_agreed: string;
	direction: string;
	total_fee: string;
	agency_fee_pct: string;
	agency_fee_inr: string;
	creator_fee: string;
	billing_entity: string;
	brand: string;
	campaign: string;
	deliverables: string;
	ro_number: string;
	campaign_over: string;
	invoice_received: string;
	payment_cleared: string;
	e_invoice_number: string;
	payment_received: string;
	client_invoice_number: string;
	client_invoice_date: string;
	client_invoice_amount: string;
	client_payment_status: string;
	client_payment_received_amount: string;
	client_payment_date: string;
	creator_invoice_number: string;
	creator_invoice_date: string;
	creator_invoice_amount: string;
	creator_payment_status: string;
	creator_payment_cycle: string;
	creator_payment_date: string;
	comments: string;
};

const EMPTY_FORM: DealForm = {
	confirmation_date: '',
	e_invoice_date: '',
	creator: '',
	creator_name_raw: '',
	agency_commission_agreed: '',
	direction: 'Outbound',
	total_fee: '',
	agency_fee_pct: '',
	agency_fee_inr: '',
	creator_fee: '',
	billing_entity: '',
	brand: '',
	campaign: '',
	deliverables: '',
	ro_number: '',
	campaign_over: '',
	invoice_received: '',
	payment_cleared: '',
	e_invoice_number: '',
	payment_received: '',
	client_invoice_number: '',
	client_invoice_date: '',
	client_invoice_amount: '',
	client_payment_status: '',
	client_payment_received_amount: '',
	client_payment_date: '',
	creator_invoice_number: '',
	creator_invoice_date: '',
	creator_invoice_amount: '',
	creator_payment_status: '',
	creator_payment_cycle: '',
	creator_payment_date: '',
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
function quarterOf(iso: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
	const m = Number(iso.split('-')[1]);
	if (m >= 4 && m <= 6) return 'Q1';
	if (m >= 7 && m <= 9) return 'Q2';
	if (m >= 10 && m <= 12) return 'Q3';
	return 'Q4';
}
function monthOf(iso: string): string {
	return iso.split('-')[1];
}
function fyLabelShort(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

// Sub-period options in fiscal-year order (Apr → Mar) plus the four quarters.
const SUB_PERIODS = [
	{ value: 'All', label: 'All periods' },
	{ value: 'Q1', label: 'Q1 (Apr–Jun)' },
	{ value: 'Q2', label: 'Q2 (Jul–Sep)' },
	{ value: 'Q3', label: 'Q3 (Oct–Dec)' },
	{ value: 'Q4', label: 'Q4 (Jan–Mar)' },
	{ value: '04', label: 'April' },
	{ value: '05', label: 'May' },
	{ value: '06', label: 'June' },
	{ value: '07', label: 'July' },
	{ value: '08', label: 'August' },
	{ value: '09', label: 'September' },
	{ value: '10', label: 'October' },
	{ value: '11', label: 'November' },
	{ value: '12', label: 'December' },
	{ value: '01', label: 'January' },
	{ value: '02', label: 'February' },
	{ value: '03', label: 'March' }
];

type DirFilter = 'All' | 'Inbound' | 'Outbound' | 'MarkUp';
type DateBasis = 'confirmation' | 'invoice';
type ViewMode = 'table' | 'cards';

export default function CommercialPage() {
	const [rows, setRows] = React.useState<Deal[]>([]);
	const [creators, setCreators] = React.useState<Creator[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Deal | null>(null);
	const [q, setQ] = React.useState('');
	const [dirFilter, setDirFilter] = React.useState<DirFilter>('All');
	const [entityFilter, setEntityFilter] = React.useState('All');
	const [basis, setBasis] = React.useState<DateBasis>('confirmation');
	const [fyFilter, setFyFilter] = React.useState('All');
	const [subPeriod, setSubPeriod] = React.useState('All');
	const [form, setForm] = React.useState<DealForm>(EMPTY_FORM);
	const [viewMode, setViewMode] = React.useState<ViewMode>('table');
	const [colGroups, setColGroups] = React.useState<Record<ColumnGroup, boolean>>({
		deal: true,
		finance_client: true,
		finance_creator: true,
		status: true,
	});
	const toggleCol = (g: ColumnGroup) => setColGroups((prev) => ({ ...prev, [g]: !prev[g] }));

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

	// Auto-compute agency_fee_inr and creator_fee from total_fee + agency_fee_pct.
	React.useEffect(() => {
		const total = Number(form.total_fee);
		const p = Number(form.agency_fee_pct);
		if (Number.isFinite(total) && Number.isFinite(p) && total > 0 && p > 0) {
			const pct = p <= 1 ? p : p / 100;
			const fee = (total * pct).toFixed(2);
			const creatorFee = (total - total * pct).toFixed(2);
			setForm((f) =>
				f.agency_fee_inr === fee && f.creator_fee === creatorFee
					? f
					: { ...f, agency_fee_inr: fee, creator_fee: creatorFee }
			);
		}
	}, [form.total_fee, form.agency_fee_pct]);

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
			agency_commission_agreed: d.agency_commission_agreed,
			direction: d.direction,
			total_fee: d.total_fee,
			agency_fee_pct: d.agency_fee_pct,
			agency_fee_inr: d.agency_fee_inr,
			creator_fee: d.creator_fee,
			billing_entity: d.billing_entity,
			brand: d.brand,
			campaign: d.campaign,
			deliverables: d.deliverables,
			ro_number: d.ro_number,
			campaign_over: d.campaign_over,
			invoice_received: d.invoice_received,
			payment_cleared: d.payment_cleared,
			e_invoice_number: d.e_invoice_number,
			payment_received: d.payment_received,
			client_invoice_number: d.client_invoice_number ?? '',
			client_invoice_date: d.client_invoice_date ?? '',
			client_invoice_amount: d.client_invoice_amount ?? '',
			client_payment_status: d.client_payment_status ?? '',
			client_payment_received_amount: d.client_payment_received_amount ?? '',
			client_payment_date: d.client_payment_date ?? '',
			creator_invoice_number: d.creator_invoice_number ?? '',
			creator_invoice_date: d.creator_invoice_date ?? '',
			creator_invoice_amount: d.creator_invoice_amount ?? '',
			creator_payment_status: d.creator_payment_status ?? '',
			creator_payment_cycle: d.creator_payment_cycle ?? '',
			creator_payment_date: d.creator_payment_date ?? '',
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
			creator_fee: form.creator_fee || '0',
			client_invoice_date: form.client_invoice_date || null,
			client_invoice_amount: form.client_invoice_amount || '0',
			client_payment_received_amount: form.client_payment_received_amount || '0',
			client_payment_date: form.client_payment_date || null,
			creator_invoice_date: form.creator_invoice_date || null,
			creator_invoice_amount: form.creator_invoice_amount || '0',
			creator_payment_date: form.creator_payment_date || null,
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
		if (!confirm(`Delete deal for "${d.creator_name}" / brand "${d.brand}"?`)) return;
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

	// Fiscal years present in the data for the chosen tracking basis.
	const fyYears = React.useMemo(() => {
		const set = new Set<number>();
		for (const r of rows) {
			const d = basis === 'invoice' ? r.e_invoice_date : r.confirmation_date;
			if (d) set.add(fyStartOf(d));
		}
		return Array.from(set).sort((a, b) => b - a);
	}, [rows, basis]);

	const periodActive = entityFilter !== 'All' || fyFilter !== 'All' || subPeriod !== 'All';

	const filtered = React.useMemo(() => {
		const needle = q.trim().toLowerCase();
		const list = rows.filter((r) => {
			if (dirFilter !== 'All' && r.direction !== dirFilter) return false;
			if (entityFilter !== 'All' && (r.billing_entity || '').trim() !== entityFilter)
				return false;
			const d = basis === 'invoice' ? r.e_invoice_date : r.confirmation_date;
			if (fyFilter !== 'All') {
				if (!d || fyStartOf(d) !== Number(fyFilter)) return false;
			}
			if (subPeriod !== 'All') {
				if (!d) return false;
				if (subPeriod.startsWith('Q')) {
					if (quarterOf(d) !== subPeriod) return false;
				} else if (monthOf(d) !== subPeriod) {
					return false;
				}
			}
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
	}, [rows, q, dirFilter, entityFilter, basis, fyFilter, subPeriod]);

	function resetFilters() {
		setEntityFilter('All');
		setFyFilter('All');
		setSubPeriod('All');
	}

	const totals = React.useMemo(() => {
		let total = 0;
		let profit = 0;
		let clientOutstanding = 0;
		let clientReceived = 0;
		let creatorPending = 0;
		for (const r of filtered) {
			total += Number(r.total_fee || 0);
			profit += Number(r.agency_fee_inr || 0);
			const cInvAmt = Number(r.client_invoice_amount || 0);
			const cRecvAmt = Number(r.client_payment_received_amount || 0);
			clientReceived += cRecvAmt;
			if (cInvAmt > 0) clientOutstanding += cInvAmt - cRecvAmt;
			if (r.creator_payment_status && r.creator_payment_status !== 'Paid') {
				creatorPending += Number(r.creator_invoice_amount || 0);
			}
		}
		return { total, profit, count: filtered.length, clientOutstanding, clientReceived, creatorPending };
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
						Workspace · Commercial
					</div>
					<div className="flex items-end justify-between flex-wrap gap-3">
						<div>
							<h1
								className="page-title text-[40px] leading-[1.15] font-bold"
								style={{ color: 'var(--n-fg)' }}
							>
								Commercial Tracking
							</h1>
							<p
								className="text-[15px] max-w-[640px] mt-2"
								style={{ color: 'var(--n-fg-muted)' }}
							>
								Single source of truth for billing. Add a deal here — Current Overview and
								Quarterly Exclusives recompute automatically.
							</p>
						</div>
						<Button variant="primary" onClick={startAdd}>
							<Icon name="plus" size={14} /> Add Deal
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
							Deals shown
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
					<div className="min-w-[130px]">
						<Select
							value={fyFilter}
							onChange={(e) => setFyFilter(e.target.value)}
							options={[
								{ value: 'All', label: 'All years' },
								...fyYears.map((y) => ({ value: String(y), label: fyLabelShort(y) }))
							]}
						/>
					</div>
					<div className="min-w-[150px]">
						<Select
							value={subPeriod}
							onChange={(e) => setSubPeriod(e.target.value)}
							options={SUB_PERIODS}
						/>
					</div>
					{periodActive && (
						<Button variant="ghost" onClick={resetFilters}>
							Reset filters
						</Button>
					)}
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<div className="flex items-center gap-1.5 mr-3">
						<span
							className="text-[11.5px] font-medium uppercase whitespace-nowrap"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							View
						</span>
						<div className="seg-toggle">
							<button
								type="button"
								className={cn(viewMode === 'table' && 'active')}
								onClick={() => setViewMode('table')}
							>
								Table
							</button>
							<button
								type="button"
								className={cn(viewMode === 'cards' && 'active')}
								onClick={() => setViewMode('cards')}
							>
								Cards
							</button>
						</div>
					</div>
					{viewMode === 'table' && <>
					<span
						className="text-[11.5px] font-medium uppercase whitespace-nowrap"
						style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
					>
						Columns
					</span>
					{([
						['deal', 'Deal Info'],
						['finance_client', 'Client Invoice'],
						['finance_creator', 'Creator Invoice'],
						['status', 'Status'],
					] as [ColumnGroup, string][]).map(([key, label]) => (
						<button
							key={key}
							type="button"
							className={cn(
								'h-7 px-2.5 rounded text-[12px] font-medium border transition-colors',
								colGroups[key]
									? 'bg-[var(--n-fg)] text-white border-transparent'
									: 'bg-[var(--n-bg)] text-[var(--n-fg-muted)] border-[var(--n-border)] hover:border-[var(--n-border-strong)]'
							)}
							onClick={() => toggleCol(key)}
						>
							{label}
						</button>
					))}
					</>}
				</div>

				{(colGroups.finance_client || colGroups.finance_creator) && (
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
						{colGroups.finance_client && (
							<>
								<div
									className="rounded p-3"
									style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
								>
									<div
										className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
										style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
									>
										<span className="h-1.5 w-1.5 rounded-full bg-[#dc6803]" />
										Client Outstanding
									</div>
									<div
										className="text-[22px] font-semibold tabular-nums mt-1"
										style={{ color: totals.clientOutstanding > 0 ? '#dc6803' : 'var(--n-fg)' }}
									>
										{inr(totals.clientOutstanding)}
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
										Client Received
									</div>
									<div
										className="text-[22px] font-semibold tabular-nums mt-1"
										style={{ color: 'var(--n-fg)' }}
									>
										{inr(totals.clientReceived)}
									</div>
								</div>
							</>
						)}
						{colGroups.finance_creator && (
							<div
								className="rounded p-3"
								style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
							>
								<div
									className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
									style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
								>
									<span className="h-1.5 w-1.5 rounded-full bg-[#6941c6]" />
									Creator Payable
								</div>
								<div
									className="text-[22px] font-semibold tabular-nums mt-1"
									style={{ color: totals.creatorPending > 0 ? '#6941c6' : 'var(--n-fg)' }}
								>
									{inr(totals.creatorPending)}
								</div>
							</div>
						)}
					</div>
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
				) : viewMode === 'cards' ? (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{filtered.map((r) => (
								<div
									key={r.id}
									className="rounded-lg p-4 space-y-3 transition-shadow hover:shadow-sm"
									style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
								>
									<div className="flex items-start justify-between gap-2">
										<div>
											<div className="font-semibold text-[15px]" style={{ color: 'var(--n-fg)' }}>
												{r.creator_name || '—'}
											</div>
											<div className="text-[13px] mt-0.5" style={{ color: 'var(--n-fg-muted)' }}>
												{r.brand}{r.campaign ? ` · ${r.campaign}` : ''}
											</div>
										</div>
										<div className="flex items-center gap-1 shrink-0">
											<Tag tone={dirTone(r.direction)}>{r.direction}</Tag>
											{r.creator_relationship && (
												<Tag tone={relTone(r.creator_relationship)}>
													{r.creator_relationship === 'NonTCH' ? 'Non TCH' : r.creator_relationship}
												</Tag>
											)}
										</div>
									</div>

									<div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
										<div>
											<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>Total Fee</div>
											<div className="font-semibold tabular-nums" style={{ color: 'var(--n-fg)' }}>{inr(r.total_fee)}</div>
										</div>
										<div>
											<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>TCH Profit</div>
											<div className="font-semibold tabular-nums" style={{ color: '#1f6f43' }}>{inr(r.agency_fee_inr)}</div>
										</div>
										{r.confirmation_date && (
											<div>
												<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>Conf Date</div>
												<div className="tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>{r.confirmation_date}</div>
											</div>
										)}
										{r.billing_entity && (
											<div>
												<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>Entity</div>
												<div style={{ color: 'var(--n-fg-muted)' }}>
													{r.billing_entity}
													{isEmw(r.billing_entity) && <Tag tone="emw" className="ml-1">EMW</Tag>}
												</div>
											</div>
										)}
									</div>

									{(r.client_payment_status || r.creator_payment_status) && (
										<div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] pt-1 border-t" style={{ borderColor: 'var(--n-border)' }}>
											{r.client_payment_status && (
												<div>
													<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>Client</div>
													{r.client_payment_status === 'Received' ? (
														<Tag tone="yes">{r.client_payment_status}</Tag>
													) : r.client_payment_status === 'Overdue' ? (
														<Tag tone="no">{r.client_payment_status}</Tag>
													) : (
														<Tag tone="neutral">{r.client_payment_status}</Tag>
													)}
												</div>
											)}
											{r.creator_payment_status && (
												<div>
													<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>Creator</div>
													{r.creator_payment_status === 'Paid' ? (
														<Tag tone="yes">{r.creator_payment_status}</Tag>
													) : r.creator_payment_status === 'Overdue' ? (
														<Tag tone="no">{r.creator_payment_status}</Tag>
													) : (
														<Tag tone="neutral">{r.creator_payment_status}</Tag>
													)}
													{r.creator_payment_cycle && (
														<span className="text-[11px] ml-1" style={{ color: 'var(--n-fg-subtle)' }}>
															{r.creator_payment_cycle.replace('Net', 'Net ')}
														</span>
													)}
												</div>
											)}
										</div>
									)}

									<div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--n-border)' }}>
										<div className="flex gap-1 text-[13px]">
											{r.campaign_over === 'Y' && <Tag tone="yes">Done</Tag>}
											{r.invoice_received === 'Y' && <Tag tone="yes">Inv</Tag>}
											{r.payment_received === 'Y' && <Tag tone="yes">Paid</Tag>}
											{r.campaign_over !== 'Y' && <Tag tone="neutral">Active</Tag>}
										</div>
										<div className="ml-auto flex gap-1">
											<Button variant="ghost" onClick={() => startEdit(r)}>Edit</Button>
											<Button variant="danger" onClick={() => remove(r)}>Del</Button>
										</div>
									</div>
								</div>
							))}
						</div>
						{filtered.length === 0 && (
							<div
								className="text-[14px] py-8 text-center"
								style={{ color: 'var(--n-fg-subtle)' }}
							>
								No deals match the current filters.
							</div>
						)}
					</>
				) : (
					<>
						<div className="ct-wrap">
							<table className="ct-table">
								<thead>
									<tr>
										<th className="ct-sticky-l1 ct-head w-[100px]">Conf Date</th>
										<th className="ct-sticky-l2 ct-head w-[200px]">Creator</th>
										{colGroups.deal && <>
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
										</>}
										{colGroups.finance_client && <>
											<th className="ct-head w-[130px]">Client Inv #</th>
											<th className="ct-head w-[100px]">Client Inv Date</th>
											<th className="ct-head w-[120px] num">Client Inv Amt</th>
											<th className="ct-head w-[90px]">Client Status</th>
											<th className="ct-head w-[120px] num">Client Recv</th>
											<th className="ct-head w-[100px]">Client Pay Date</th>
										</>}
										{colGroups.finance_creator && <>
											<th className="ct-head w-[130px]">Creator Inv #</th>
											<th className="ct-head w-[100px]">Creator Inv Date</th>
											<th className="ct-head w-[120px] num">Creator Inv Amt</th>
											<th className="ct-head w-[90px]">Creator Status</th>
											<th className="ct-head w-[90px]">Pay Cycle</th>
											<th className="ct-head w-[100px]">Creator Pay Date</th>
										</>}
										{colGroups.status && <>
											<th className="ct-head w-[60px]" title="Campaign Over">Over</th>
											<th className="ct-head w-[70px]" title="Invoice Received">Inv</th>
											<th className="ct-head w-[70px]" title="Payment Cleared by TCH">Pay Clr</th>
											<th className="ct-head w-[140px]">E-Invoice #</th>
											<th className="ct-head w-[80px]" title="Payment Received by TCH">Pay Recv</th>
										</>}
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
											{colGroups.deal && <>
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
										</>}
										{colGroups.finance_client && <>
											<td className="ct-cell whitespace-nowrap" style={{ color: 'var(--n-fg-muted)' }}>
												{r.client_invoice_number}
											</td>
											<td className="ct-cell whitespace-nowrap tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
												{r.client_invoice_date}
											</td>
											<td className="ct-cell num tabular-nums" style={{ color: 'var(--n-fg)' }}>
												{Number(r.client_invoice_amount) > 0 ? inr(r.client_invoice_amount) : ''}
											</td>
											<td className="ct-cell">
												{r.client_payment_status === 'Received' ? (
													<Tag tone="yes">{r.client_payment_status}</Tag>
												) : r.client_payment_status === 'Overdue' ? (
													<Tag tone="no">{r.client_payment_status}</Tag>
												) : r.client_payment_status ? (
													<Tag tone="neutral">{r.client_payment_status}</Tag>
												) : null}
											</td>
											<td className="ct-cell num tabular-nums" style={{ color: '#0f7b6c' }}>
												{Number(r.client_payment_received_amount) > 0 ? inr(r.client_payment_received_amount) : ''}
											</td>
											<td className="ct-cell whitespace-nowrap tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
												{r.client_payment_date}
											</td>
										</>}
										{colGroups.finance_creator && <>
											<td className="ct-cell whitespace-nowrap" style={{ color: 'var(--n-fg-muted)' }}>
												{r.creator_invoice_number}
											</td>
											<td className="ct-cell whitespace-nowrap tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
												{r.creator_invoice_date}
											</td>
											<td className="ct-cell num tabular-nums" style={{ color: 'var(--n-fg)' }}>
												{Number(r.creator_invoice_amount) > 0 ? inr(r.creator_invoice_amount) : ''}
											</td>
											<td className="ct-cell">
												{r.creator_payment_status === 'Paid' ? (
													<Tag tone="yes">{r.creator_payment_status}</Tag>
												) : r.creator_payment_status === 'Overdue' ? (
													<Tag tone="no">{r.creator_payment_status}</Tag>
												) : r.creator_payment_status ? (
													<Tag tone="neutral">{r.creator_payment_status}</Tag>
												) : null}
											</td>
											<td className="ct-cell" style={{ color: 'var(--n-fg-muted)' }}>
												{r.creator_payment_cycle ? r.creator_payment_cycle.replace('Net', 'Net ') : ''}
											</td>
											<td className="ct-cell whitespace-nowrap tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
												{r.creator_payment_date}
											</td>
										</>}
										{colGroups.status && <>
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
										</>}
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
												colSpan={99}
											>
												No deals match the current filters.
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
				title={editing ? 'Edit Deal' : 'Add Deal'}
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
							onChange={(e) => set('direction', e.target.value)}
							options={DIRECTION}
						/>
					</div>

					<div className="col-span-2">
						<Label>Creator (pick from master)</Label>
						<Select
							value={form.creator}
							onChange={(e) => set('creator', e.target.value)}
							options={creators.map((c) => ({
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

					<div>
						<Label>Total Fee (INR)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.total_fee}
							onChange={(e) => set('total_fee', e.target.value)}
						/>
					</div>
					<div>
						<Label>Agency Fee %</Label>
						<Input
							type="number"
							step="0.0001"
							placeholder="0.20 = 20%"
							value={form.agency_fee_pct}
							onChange={(e) => set('agency_fee_pct', e.target.value)}
						/>
					</div>
					<div>
						<Label>Agency Fee (INR) — auto</Label>
						<Input
							type="number"
							step="0.01"
							value={form.agency_fee_inr}
							onChange={(e) => set('agency_fee_inr', e.target.value)}
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
						<Label>Agency Commission Agreed</Label>
						<Input
							value={form.agency_commission_agreed}
							onChange={(e) => set('agency_commission_agreed', e.target.value)}
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

					<div className="col-span-3 border-t pt-3 mt-1" style={{ borderColor: 'var(--n-border)' }}>
						<div className="text-[12px] font-semibold uppercase mb-2" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}>
							Client Invoice (TCH → Client)
						</div>
					</div>
					<div>
						<Label>Invoice Number</Label>
						<Input
							value={form.client_invoice_number}
							onChange={(e) => set('client_invoice_number', e.target.value)}
						/>
					</div>
					<div>
						<Label>Invoice Date</Label>
						<Input
							type="date"
							value={form.client_invoice_date}
							onChange={(e) => set('client_invoice_date', e.target.value)}
						/>
					</div>
					<div>
						<Label>Invoice Amount (INR)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.client_invoice_amount}
							onChange={(e) => set('client_invoice_amount', e.target.value)}
						/>
					</div>
					<div>
						<Label>Payment Status</Label>
						<Select
							value={form.client_payment_status}
							onChange={(e) => set('client_payment_status', e.target.value)}
							options={CLIENT_PAY_STATUS}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Amount Received (INR)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.client_payment_received_amount}
							onChange={(e) => set('client_payment_received_amount', e.target.value)}
						/>
					</div>
					<div>
						<Label>Payment Date</Label>
						<Input
							type="date"
							value={form.client_payment_date}
							onChange={(e) => set('client_payment_date', e.target.value)}
						/>
					</div>

					<div className="col-span-3 border-t pt-3 mt-1" style={{ borderColor: 'var(--n-border)' }}>
						<div className="text-[12px] font-semibold uppercase mb-2" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}>
							Creator Invoice (Creator → TCH)
						</div>
					</div>
					<div>
						<Label>Invoice Number</Label>
						<Input
							value={form.creator_invoice_number}
							onChange={(e) => set('creator_invoice_number', e.target.value)}
						/>
					</div>
					<div>
						<Label>Invoice Date</Label>
						<Input
							type="date"
							value={form.creator_invoice_date}
							onChange={(e) => set('creator_invoice_date', e.target.value)}
						/>
					</div>
					<div>
						<Label>Invoice Amount (INR)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.creator_invoice_amount}
							onChange={(e) => set('creator_invoice_amount', e.target.value)}
						/>
					</div>
					<div>
						<Label>Payment Status</Label>
						<Select
							value={form.creator_payment_status}
							onChange={(e) => set('creator_payment_status', e.target.value)}
							options={CREATOR_PAY_STATUS}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Payment Cycle</Label>
						<Select
							value={form.creator_payment_cycle}
							onChange={(e) => set('creator_payment_cycle', e.target.value)}
							options={PAY_CYCLES}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Payment Date</Label>
						<Input
							type="date"
							value={form.creator_payment_date}
							onChange={(e) => set('creator_payment_date', e.target.value)}
						/>
					</div>

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
