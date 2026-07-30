'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { type Deal, type DealDocument, type CreatorInvoice } from '@/lib/api';
import Link from 'next/link';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { cn, formatDocDate, inr } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';
import { creatorLabel, creatorNamesOf } from '@/lib/deals';
import {
	paymentDueDate,
	paymentStatusOf,
	STATUS_LABEL,
	STATUS_TONE,
	type PaymentStatus
} from '@/lib/payments';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';
import Label from '@/components/ui/Label';
import Dialog from '@/components/ui/Dialog';
import MetricCard from '@/components/MetricCard';
import DataTable from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';
import FilterToolbar from '@/components/FilterToolbar';
import QueryErrorState from '@/components/QueryErrorState';
import {
	useDealsQuery,
	useDealDocumentsQuery,
	useCreatorInvoicesQuery,
	useMarkPaidMutation,
	useUploadInvoiceMutation
} from './queries';

type StatusFilter = 'all' | PaymentStatus;

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'awaiting_invoices', label: 'Awaiting Invoices' },
	{ key: 'due_soon', label: 'Due Soon' },
	{ key: 'overdue', label: 'Overdue' },
	{ key: 'upcoming', label: 'Upcoming' },
	{ key: 'cleared', label: 'Cleared' }
];

function InvoiceTag({
	label,
	doc,
	fallbackYes
}: {
	label: string;
	doc: DealDocument | undefined;
	fallbackYes: boolean;
}) {
	const yes = !!doc || fallbackYes;
	const tag = (
		<Tag tone={yes ? 'yes' : 'no'} className={doc?.file ? 'cursor-pointer' : undefined}>
			{label}
		</Tag>
	);
	if (doc?.file) {
		return (
			<a href={doc.file} target="_blank" rel="noopener" title={doc.label || label}>
				{tag}
			</a>
		);
	}
	return tag;
}

export default function PaymentsPage() {
	const { fyStart } = useFiscalYear();

	const { data: rows = [], isLoading: dealsLoading, error: dealsError, refetch: refetchDeals } = useDealsQuery(fyStart);
	const { data: docs = [], isLoading: docsLoading } = useDealDocumentsQuery();
	const { data: creatorInvoices = [], isLoading: creatorInvoicesLoading } = useCreatorInvoicesQuery();

	const loading = dealsLoading || docsLoading || creatorInvoicesLoading;
	const error = dealsError ? dealsError.message : null;

	const markPaidMutation = useMarkPaidMutation(fyStart);
	const uploadInvoiceMutation = useUploadInvoiceMutation(fyStart);

	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

	const [uploadOpen, setUploadOpen] = React.useState(false);
	const [uploadDeal, setUploadDeal] = React.useState<Deal | null>(null);
	const [clientFile, setClientFile] = React.useState<File | null>(null);
	const [saving, setSaving] = React.useState(false);
	const [confirmPaidDeal, setConfirmPaidDeal] = React.useState<Deal | null>(null);

	// Completed campaigns are the payments universe — they appear the moment
	// they're marked completed, and stay until every invoice is in and cleared.
	const scoped = React.useMemo(() => rows.filter((r) => r.campaign_over === 'Y'), [rows]);

	const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

	const docsByDeal = React.useMemo(() => {
		const map = new Map<number, DealDocument[]>();
		for (const d of docs) {
			const list = map.get(d.deal) ?? [];
			list.push(d);
			map.set(d.deal, list);
		}
		return map;
	}, [docs]);
	const creatorInvoicesByDeal = React.useMemo(() => {
		const map = new Map<number, CreatorInvoice[]>();
		for (const invoice of creatorInvoices) map.set(invoice.deal, [...(map.get(invoice.deal) ?? []), invoice]);
		return map;
	}, [creatorInvoices]);

	const statusOf = React.useCallback(
		(deal: Deal): PaymentStatus => paymentStatusOf(deal, docsByDeal.get(deal.id) ?? [], today, creatorInvoicesByDeal.get(deal.id) ?? []),
		[docsByDeal, creatorInvoicesByDeal, today]
	);

	const metrics = React.useMemo(() => {
		let dueCount = 0;
		let dueTotal = 0;
		let overdueCount = 0;
		let overdueTotal = 0;
		let awaitingCount = 0;
		let clearedCount = 0;
		for (const r of scoped) {
			const status = statusOf(r);
			const amount = Number(r.creator_invoice_amount || r.creator_fee) || 0;
			if (status === 'due_soon') {
				dueCount += 1;
				dueTotal += amount;
			} else if (status === 'overdue') {
				overdueCount += 1;
				overdueTotal += amount;
			} else if (status === 'awaiting_invoices') {
				awaitingCount += 1;
			} else if (status === 'cleared') {
				clearedCount += 1;
			}
		}
		return { dueCount, dueTotal, overdueCount, overdueTotal, awaitingCount, clearedCount };
	}, [scoped, statusOf]);

	const filtered = React.useMemo(() => {
		if (statusFilter === 'all') return scoped;
		return scoped.filter((r) => statusOf(r) === statusFilter);
	}, [scoped, statusFilter, statusOf]);

	function startUpload(deal: Deal) {
		setUploadDeal(deal);
		setClientFile(null);
		setUploadOpen(true);
	}

	function closeUpload() {
		setUploadOpen(false);
		setUploadDeal(null);
	}

	async function saveUpload() {
		if (!uploadDeal) return;
		if (!clientFile) {
			closeUpload();
			return;
		}
		setSaving(true);
		try {
			await uploadInvoiceMutation.mutateAsync({
				dealId: uploadDeal.id,
				clientFile,
				creatorFile: null
			});
			closeUpload();
			toast.success('Client invoice uploaded.');
		} catch (e) {
			toast.error('Invoice could not be uploaded.', { description: (e as Error).message });
		} finally {
			setSaving(false);
		}
	}

	async function markPaid(deal: Deal) {
		const amount = deal.creator_invoice_amount || deal.creator_fee;
		const creatorName = creatorLabel(creatorNamesOf(deal));
		try {
			await markPaidMutation.mutateAsync({ id: deal.id, version: deal.version });
			setConfirmPaidDeal(null);
			toast.success(`Payment to ${creatorName} marked as paid.`);
		} catch (e) {
			toast.error('Payment could not be updated.', { description: (e as Error).message });
		}
	}

	const columns = React.useMemo<ColumnDef<Deal, unknown>[]>(
		() => [
			{
				id: 'creator',
				header: 'Creator',
				meta: { tdClassName: 'font-medium' },
				accessorFn: (r) => creatorLabel(creatorNamesOf(r)),
				cell: ({ row }) => creatorLabel(creatorNamesOf(row.original)) || '—'
			},
			{
				accessorKey: 'campaign',
				header: 'Campaign',
				cell: ({ row }) => (
					<div>
						<div className="font-medium" style={{ color: 'var(--n-fg)' }}>
							{row.original.campaign || '—'}
						</div>
						{row.original.brand && (
							<div className="text-[12px] truncate max-w-[250px]" style={{ color: 'var(--n-fg-subtle)' }}>
								{row.original.brand}
							</div>
						)}
					</div>
				)
			},
			{
				id: 'amount',
				header: 'Amount',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums' },
				accessorFn: (r) => Number(r.creator_invoice_amount || r.creator_fee) || 0,
				cell: ({ row }) => {
					const amt = row.original.creator_invoice_amount || row.original.creator_fee;
					const formatted = inr(amt);
					return formatted ? `₹${formatted}` : '—';
				}
			},
			{
				id: 'invoices',
				header: 'Invoices',
				enableSorting: false,
				cell: ({ row }) => {
					const deal = row.original;
					const docsForDeal = docsByDeal.get(deal.id) ?? [];
					const clientDoc = docsForDeal.find((d) => d.doc_type === 'ClientInvoice');
					const creatorCount = creatorInvoicesByDeal.get(deal.id)?.length ?? 0;
					const requiredCount = deal.creator_shares?.length || (deal.creator ? 1 : 0);
					const received = deal.invoice_received === 'Y';
					return (
						<div className="flex gap-1">
							<InvoiceTag label="Client" doc={clientDoc} fallbackYes={received} />
							<Tag tone={creatorCount >= requiredCount ? 'yes' : 'no'}>Creators {creatorCount}/{requiredCount}</Tag>
						</div>
					);
				}
			},
			{
				id: 'due',
				header: 'Due',
				meta: { tdClassName: 'whitespace-nowrap', tdStyle: { color: 'var(--n-fg-muted)' } },
				accessorFn: (r) => paymentDueDate(r) || '',
				cell: ({ row }) => {
					const due = paymentDueDate(row.original);
					return due ? formatDocDate(due) : '—';
				}
			},
			{
				id: 'status',
				header: 'Status',
				accessorFn: (r) => statusOf(r),
				cell: ({ row }) => {
					const status = statusOf(row.original);
					return <Tag tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Tag>;
				}
			},
			{
				id: 'actions',
				header: 'Actions',
				enableSorting: false,
				meta: { thClassName: 'w-[140px]', tdClassName: 'text-right' },
				cell: ({ row }) => {
					const deal = row.original;
					const status = statusOf(deal);
					const canMarkPaid = status === 'due_soon' || status === 'overdue' || status === 'upcoming';
					return (
						<div className="flex gap-2 justify-end">
							<Button variant="outline" size="sm" onClick={() => startUpload(deal)} title="Upload invoices">
								<Icon name="upload" size={14} />
							</Button>
							{canMarkPaid && (
								<Button variant="primary" size="sm" onClick={() => setConfirmPaidDeal(deal)} title="Mark as paid">
									<Icon name="check" size={14} />
								</Button>
							)}
						</div>
					);
				}
			}
		],
		[docsByDeal, creatorInvoicesByDeal, statusOf]
	);

	const existingDocs = uploadDeal ? (docsByDeal.get(uploadDeal.id) ?? []) : [];

	return (
		<>
			<section className="space-y-6">
				<PageHeader title="Payments" description="Track invoice readiness, payment deadlines, and cleared campaigns." />

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					<MetricCard
						label="Due Soon"
						value={`${metrics.dueCount} · ₹${inr(metrics.dueTotal) || '0'}`}
					/>
					<div className="rounded-xl p-4 border" style={{ background: metrics.overdueCount > 0 ? '#fff5f5' : 'var(--n-bg)', borderColor: metrics.overdueCount > 0 ? '#ffcdd2' : 'var(--n-border)' }}>
						<p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: metrics.overdueCount > 0 ? '#c62828' : 'var(--n-fg-subtle)' }}>Overdue</p>
						<p className="text-[24px] font-bold tracking-tight tabular-nums" style={{ color: metrics.overdueCount > 0 ? '#b71c1c' : 'var(--n-fg)' }}>
							{metrics.overdueCount} · ₹{inr(metrics.overdueTotal) || '0'}
						</p>
					</div>
					<MetricCard label="Awaiting Invoices" value={metrics.awaitingCount} />
					<MetricCard label="Cleared" value={metrics.clearedCount} />
				</div>

				<div className="flex items-center gap-2 border-b mb-4" style={{ borderColor: 'var(--n-border)' }}>
					<div className="flex-1 flex items-center gap-2">
						{FILTER_OPTIONS.map((f) => {
							const isActive = statusFilter === f.key;
							return (
								<button
									key={f.key}
									onClick={() => setStatusFilter(f.key)}
									className={`px-4 py-2.5 text-[13px] font-medium transition-colors relative`}
									style={{
										color: isActive ? 'var(--n-fg)' : 'var(--n-fg-subtle)',
									}}
								>
									{f.label}
									{isActive && (
										<div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-current rounded-t-sm" />
									)}
								</button>
							);
						})}
					</div>
					<div className="text-[13px] pr-2" style={{ color: 'var(--n-fg-muted)' }}>
						{filtered.length} {filtered.length === 1 ? 'payment' : 'payments'}
					</div>
				</div>

				{error ? (
					<QueryErrorState description="Payment information is temporarily unavailable." onRetry={() => refetchDeals()} />
				) : (
					<DataTable
						data={filtered}
						columns={columns}
						loading={loading}
						emptyMessage="No completed campaigns match."
					/>
				)}
			</section>

			<Dialog
				open={uploadOpen}
				onOpenChange={(o) => {
					if (!o) closeUpload();
				}}
				title={uploadDeal ? `Upload Invoices — ${uploadDeal.brand}` : 'Upload Invoices'}
				description={
					uploadDeal
						? `${creatorLabel(creatorNamesOf(uploadDeal))}${uploadDeal.campaign ? ` · ${uploadDeal.campaign}` : ''}`
						: undefined
				}
				footer={
					<>
						<Button variant="ghost" onClick={closeUpload}>
							Cancel
						</Button>
						<Button
							variant="primary"
							disabled={saving || !clientFile}
							onClick={saveUpload}
						>
							{saving ? 'Uploading…' : 'Upload'}
						</Button>
					</>
				}
			>
				{uploadDeal && (
					<div className="space-y-4">
						<div className="space-y-3">
							<div>
								<Label>Client invoice (TCH → Client)</Label>
								<input
									type="file"
									accept="image/*,application/pdf"
									onChange={(e) => setClientFile(e.target.files?.[0] ?? null)}
									className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
								/>
							</div>
							<p className="text-[12px]" style={{ color: 'var(--n-fg-muted)' }}>
								Creator invoices are uploaded individually on the <Link className="inline-link" href={`/commercial/${uploadDeal.id}`}>campaign page</Link>.
							</p>
						</div>

						{existingDocs.length > 0 && (
							<div>
								<div
									className="text-[12px] font-semibold uppercase mb-1.5"
									style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
								>
									Already uploaded
								</div>
								<ul className="divide-y" style={{ borderColor: 'var(--n-border)' }}>
									{existingDocs.map((d) => (
										<li key={d.id} className="flex items-center gap-2 py-1.5">
											<Tag tone="neutral">{d.doc_type === 'ClientInvoice' ? 'Client' : 'Creator'}</Tag>
											{d.file ? (
												<a
													className="inline-link text-[13px]"
													href={d.file}
													target="_blank"
													rel="noopener"
												>
													{d.label || d.file.split('/').pop()} ↗
												</a>
											) : (
												<span className="text-[13px]" style={{ color: 'var(--n-fg-muted)' }}>
													{d.label || '(no file)'}
												</span>
											)}
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				)}
			</Dialog>
			<ConfirmDialog open={confirmPaidDeal !== null} onOpenChange={(value) => { if (!value) setConfirmPaidDeal(null); }} title="Mark payment as paid?" description={confirmPaidDeal ? `Confirm payment of ₹${inr(confirmPaidDeal.creator_invoice_amount || confirmPaidDeal.creator_fee) || '0'} to ${creatorLabel(creatorNamesOf(confirmPaidDeal))}.` : ''} confirmLabel="Mark paid" pending={markPaidMutation.isPending} onConfirm={() => { if (confirmPaidDeal) return markPaid(confirmPaidDeal); }} />
		</>
	);
}
