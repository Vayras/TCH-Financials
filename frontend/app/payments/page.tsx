'use client';

import * as React from 'react';
import { api, type InvoiceFile, type Deal } from '@/lib/api';
import { inr, cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import Textarea from '@/components/ui/Textarea';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';

type Tab = 'creator' | 'client';

const STATUS_OPTIONS = [
	{ value: 'Received', label: 'Received' },
	{ value: 'Accepted', label: 'Accepted' },
	{ value: 'NeedsRevision', label: 'Needs Revision' },
	{ value: 'Cleared', label: 'Cleared' },
];

function statusTone(s: string) {
	if (s === 'Cleared') return 'yes' as const;
	if (s === 'NeedsRevision') return 'no' as const;
	if (s === 'Accepted') return 'accent' as const;
	return 'neutral' as const;
}

export default function PaymentsPage() {
	const [tab, setTab] = React.useState<Tab>('creator');
	const [invoices, setInvoices] = React.useState<InvoiceFile[]>([]);
	const [deals, setDeals] = React.useState<Deal[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [q, setQ] = React.useState('');

	// Upload dialog
	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<InvoiceFile | null>(null);
	const [form, setForm] = React.useState({
		deal: '', label: '', status: 'Received', due_date: '', comments: ''
	});
	const [file, setFile] = React.useState<File | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		try {
			const [inv, d] = await Promise.all([
				api.get<InvoiceFile[]>('/invoice-files/'),
				api.get<Deal[]>('/deals/'),
			]);
			setInvoices(inv);
			setDeals(d);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => { load(); }, [load]);

	const filtered = React.useMemo(() => {
		const needle = q.trim().toLowerCase();
		return invoices
			.filter((inv) => inv.invoice_type === tab)
			.filter((inv) => {
				if (!needle) return true;
				return (
					inv.creator_name?.toLowerCase().includes(needle) ||
					inv.brand?.toLowerCase().includes(needle) ||
					inv.campaign?.toLowerCase().includes(needle) ||
					inv.label?.toLowerCase().includes(needle)
				);
			})
			.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
	}, [invoices, tab, q]);

	const totals = React.useMemo(() => {
		const items = invoices.filter((inv) => inv.invoice_type === tab);
		const total = items.length;
		const cleared = items.filter((i) => i.status === 'Cleared').length;
		const pending = items.filter((i) => i.status !== 'Cleared').length;
		const overdue = items.filter((i) => i.is_overdue).length;
		const pendingAmount = items
			.filter((i) => i.status !== 'Cleared')
			.reduce((sum, i) => {
				const deal = deals.find((d) => d.id === i.deal);
				if (!deal) return sum;
				return sum + Number(tab === 'creator' ? deal.creator_invoice_amount : deal.client_invoice_amount);
			}, 0);
		return { total, cleared, pending, overdue, pendingAmount };
	}, [invoices, deals, tab]);

	function startAdd() {
		setEditing(null);
		setForm({ deal: '', label: '', status: 'Received', due_date: '', comments: '' });
		setFile(null);
		setOpen(true);
	}

	function startEdit(inv: InvoiceFile) {
		setEditing(inv);
		setForm({
			deal: String(inv.deal),
			label: inv.label,
			status: inv.status,
			due_date: inv.due_date ?? '',
			comments: inv.comments,
		});
		setFile(null);
		setOpen(true);
	}

	async function submit() {
		try {
			if (editing) {
				// PATCH as JSON (no file change needed for edit)
				await api.patch(`/invoice-files/${editing.id}/`, {
					deal: Number(form.deal),
					invoice_type: tab,
					label: form.label,
					status: form.status,
					due_date: form.due_date || null,
					comments: form.comments,
				});
			} else {
				if (!file) { alert('Please select a file'); return; }
				const fd = new FormData();
				fd.append('deal', form.deal);
				fd.append('invoice_type', tab);
				fd.append('file', file);
				fd.append('label', form.label);
				fd.append('status', form.status);
				if (form.due_date) fd.append('due_date', form.due_date);
				fd.append('comments', form.comments);
				await api.upload<InvoiceFile>('/invoice-files/', fd);
			}
			setOpen(false);
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function remove(inv: InvoiceFile) {
		if (!confirm(`Delete invoice "${inv.label || 'untitled'}"?`)) return;
		await api.del(`/invoice-files/${inv.id}/`);
		await load();
	}

	// Deal options for the dropdown
	const dealOptions = deals.map((d) => ({
		value: String(d.id),
		label: `${d.creator_name} · ${d.brand || '(no brand)'} · ${d.campaign || '(no campaign)'}`.slice(0, 80),
	}));

	return (
		<>
			<section className="space-y-6">
				<header className="space-y-2">
					<div
						className="text-[12px] font-medium uppercase"
						style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
					>
						Workspace · Payments
					</div>
					<div className="flex items-end justify-between flex-wrap gap-3">
						<div>
							<h1
								className="page-title text-[40px] leading-[1.15] font-bold"
								style={{ color: 'var(--n-fg)' }}
							>
								Payments
							</h1>
							<p
								className="text-[15px] max-w-[640px] mt-2"
								style={{ color: 'var(--n-fg-muted)' }}
							>
								Upload and track creator invoices (payables) and client invoices
								(receivables) linked to campaigns. Finance can view, download, and
								manage invoice statuses.
							</p>
						</div>
						<Button variant="primary" onClick={startAdd}>
							<Icon name="plus" size={14} /> Upload Invoice
						</Button>
					</div>
				</header>

				<div className="flex flex-wrap items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--n-border)' }}>
					<div className="seg-toggle">
						<button type="button" className={cn(tab === 'creator' && 'active')} onClick={() => setTab('creator')}>
							Creator Invoices
						</button>
						<button type="button" className={cn(tab === 'client' && 'active')} onClick={() => setTab('client')}>
							Client Receivables
						</button>
					</div>
					<div className="relative flex-1 min-w-[220px]">
						<span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--n-fg-subtle)' }}>
							<Icon name="search" size={14} />
						</span>
						<input
							type="text"
							placeholder="Search creator, brand, campaign…"
							className="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
							value={q}
							onChange={(e) => setQ(e.target.value)}
						/>
					</div>
					<Button variant="ghost" onClick={load}>
						<Icon name="refresh" size={14} /> Refresh
					</Button>
				</div>

				{/* Summary cards */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					<div className="rounded p-3" style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}>
						<div className="text-[11.5px] font-medium uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
							Total Invoices
						</div>
						<div className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: 'var(--n-fg)' }}>
							{totals.total}
						</div>
					</div>
					<div className="rounded p-3" style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}>
						<div className="text-[11.5px] font-medium uppercase flex items-center gap-1.5" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
							<span className="h-1.5 w-1.5 rounded-full bg-[#dc6803]" />
							{tab === 'creator' ? 'Booked Unpaid' : 'Outstanding'}
						</div>
						<div className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: totals.pending > 0 ? '#dc6803' : 'var(--n-fg)' }}>
							{totals.pending}
						</div>
						<div className="text-[12px] tabular-nums mt-0.5" style={{ color: 'var(--n-fg-subtle)' }}>
							{inr(totals.pendingAmount)}
						</div>
					</div>
					<div className="rounded p-3" style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}>
						<div className="text-[11.5px] font-medium uppercase flex items-center gap-1.5" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
							<span className="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]" />
							Cleared
						</div>
						<div className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: 'var(--n-fg)' }}>
							{totals.cleared}
						</div>
					</div>
					{tab === 'client' && (
						<div className="rounded p-3" style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}>
							<div className="text-[11.5px] font-medium uppercase flex items-center gap-1.5" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
								<span className="h-1.5 w-1.5 rounded-full bg-[#991b1b]" />
								Overdue
							</div>
							<div className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: totals.overdue > 0 ? '#991b1b' : 'var(--n-fg)' }}>
								{totals.overdue}
							</div>
						</div>
					)}
				</div>

				{/* Invoice table */}
				{loading ? (
					<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>Loading…</div>
				) : error ? (
					<div className="text-[14px] rounded p-3" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
						Error: {error}
					</div>
				) : (
					<div className="tbl-card">
						<div className="scroll-x">
							<table className="grid-table">
								<thead>
									<tr>
										<th>Creator / Brand</th>
										<th>Campaign</th>
										<th>Label</th>
										<th>Status</th>
										{tab === 'client' && <th className="num">Due Date</th>}
										{tab === 'client' && <th className="num">Days</th>}
										<th>File</th>
										<th>Comments</th>
										<th>Uploaded</th>
										<th className="w-[110px]">Actions</th>
									</tr>
								</thead>
								<tbody>
									{filtered.map((inv) => (
										<tr key={inv.id} className={inv.is_overdue ? 'bg-[#fef2f2]' : ''}>
											<td>
												<div className="font-medium" style={{ color: 'var(--n-fg)' }}>{inv.creator_name}</div>
												<div className="text-[12px]" style={{ color: 'var(--n-fg-muted)' }}>{inv.brand}</div>
											</td>
											<td style={{ color: 'var(--n-fg-muted)' }}>{inv.campaign}</td>
											<td style={{ color: 'var(--n-fg)' }}>{inv.label || '—'}</td>
											<td>
												<Tag tone={statusTone(inv.status)}>
													{inv.status === 'NeedsRevision' ? 'Needs Revision' : inv.status}
												</Tag>
												{inv.is_overdue && <Tag tone="no" className="ml-1">Overdue</Tag>}
											</td>
											{tab === 'client' && (
												<td className="num tabular-nums whitespace-nowrap" style={{ color: 'var(--n-fg-muted)' }}>
													{inv.due_date || '—'}
												</td>
											)}
											{tab === 'client' && (
												<td className="num tabular-nums" style={{
													color: inv.days_until_due !== null && inv.days_until_due < 0 ? '#991b1b' :
														inv.days_until_due !== null && inv.days_until_due <= 7 ? '#dc6803' : 'var(--n-fg-muted)'
												}}>
													{inv.status === 'Cleared' ? '—' :
														inv.days_until_due !== null
															? inv.days_until_due < 0
																? `${Math.abs(inv.days_until_due)}d overdue`
																: inv.days_until_due === 0
																	? 'Due today'
																	: `${inv.days_until_due}d`
															: '—'}
												</td>
											)}
											<td>
												{inv.file && (
													<a
														href={inv.file}
														target="_blank"
														rel="noopener noreferrer"
														className="text-[13px] underline"
														style={{ color: 'var(--n-accent)' }}
													>
														Download
													</a>
												)}
											</td>
											<td className="text-[12px]" style={{ color: 'var(--n-fg-muted)' }}>
												{inv.comments ? inv.comments.slice(0, 50) + (inv.comments.length > 50 ? '…' : '') : '—'}
											</td>
											<td className="tabular-nums whitespace-nowrap" style={{ color: 'var(--n-fg-subtle)' }}>
												{inv.uploaded_at?.slice(0, 10)}
											</td>
											<td>
												<div className="flex gap-1">
													<Button variant="ghost" onClick={() => startEdit(inv)}>Edit</Button>
													<Button variant="danger" onClick={() => remove(inv)}>Del</Button>
												</div>
											</td>
										</tr>
									))}
									{filtered.length === 0 && (
										<tr>
											<td colSpan={tab === 'client' ? 10 : 8} className="text-center py-8" style={{ color: 'var(--n-fg-subtle)' }}>
												No {tab === 'creator' ? 'creator' : 'client'} invoices found.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</section>

			<Dialog
				open={open}
				onOpenChange={setOpen}
				title={editing ? 'Edit Invoice' : `Upload ${tab === 'creator' ? 'Creator' : 'Client'} Invoice`}
				className="max-w-2xl"
				footer={<>
					<Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
					<Button variant="primary" onClick={submit}>{editing ? 'Save' : 'Upload'}</Button>
				</>}
			>
				<div className="grid grid-cols-2 gap-3">
					<div className="col-span-2">
						<Label>Campaign</Label>
						<Select
							value={form.deal}
							onChange={(e) => setForm((f) => ({ ...f, deal: e.target.value }))}
							options={dealOptions}
							placeholder="— select campaign —"
						/>
					</div>
					{!editing && (
						<div className="col-span-2">
							<Label>Invoice File</Label>
							<input
								type="file"
								accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
								className="block w-full text-[14px] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[13px] file:font-medium file:bg-[var(--n-bg-soft)] file:text-[var(--n-fg)] hover:file:bg-[var(--n-bg-hover)]"
								onChange={(e) => setFile(e.target.files?.[0] ?? null)}
							/>
						</div>
					)}
					<div>
						<Label>Label</Label>
						<Input
							value={form.label}
							onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
							placeholder="e.g. INV-2026-001"
						/>
					</div>
					<div>
						<Label>Status</Label>
						<Select
							value={form.status}
							onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
							options={STATUS_OPTIONS}
						/>
					</div>
					{tab === 'client' && (
						<div>
							<Label>Due Date</Label>
							<Input
								type="date"
								value={form.due_date}
								onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
							/>
						</div>
					)}
					<div className={tab === 'client' ? '' : 'col-span-2'}>
						<Label>Comments</Label>
						<Textarea
							value={form.comments}
							onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
							placeholder="Notes for finance team…"
						/>
					</div>
				</div>
			</Dialog>
		</>
	);
}
