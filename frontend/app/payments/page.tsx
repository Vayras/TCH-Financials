'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { ConflictError, type Deal, type DealDocument } from '@/lib/api';
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
import Tag from '@/components/ui/Tag';
import Label from '@/components/ui/Label';
import Dialog from '@/components/ui/Dialog';
import MetricCard from '@/components/MetricCard';
import DataTable from '@/components/DataTable';
import {
	useDealsQuery,
	useDealDocumentsQuery,
	useMarkPaidMutation,
	useUploadInvoiceMutation
} from './queries';

type StatusFilter = 'all' | PaymentStatus;

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'awaiting_invoices', label: 'Awaiting invoices' },
	{ key: 'due', label: 'Due this Wednesday' },
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

	const { data: rows = [], isLoading: dealsLoading, error: dealsError } = useDealsQuery(fyStart);
	const { data: docs = [], isLoading: docsLoading } = useDealDocumentsQuery();

	const loading = dealsLoading || docsLoading;
	const error = dealsError ? dealsError.message : null;

	const markPaidMutation = useMarkPaidMutation(fyStart);
	const uploadInvoiceMutation = useUploadInvoiceMutation(fyStart);

	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

	const [uploadOpen, setUploadOpen] = React.useState(false);
	const [uploadDeal, setUploadDeal] = React.useState<Deal | null>(null);
	const [clientFile, setClientFile] = React.useState<File | null>(null);
	const [creatorFile, setCreatorFile] = React.useState<File | null>(null);
	const [saving, setSaving] = React.useState(false);

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

	const statusOf = React.useCallback(
		(deal: Deal): PaymentStatus => paymentStatusOf(deal, docsByDeal.get(deal.id) ?? [], today),
		[docsByDeal, today]
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
			if (status === 'due') {
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
		setCreatorFile(null);
		setUploadOpen(true);
	}

	function closeUpload() {
		setUploadOpen(false);
		setUploadDeal(null);
	}

	async function saveUpload() {
		if (!uploadDeal) return;
		if (!clientFile && !creatorFile) {
			closeUpload();
			return;
		}
		setSaving(true);
		try {
			await uploadInvoiceMutation.mutateAsync({
				dealId: uploadDeal.id,
				clientFile,
				creatorFile
			});
			closeUpload();
		} catch (e) {
			alert((e as Error).message);
		} finally {
			setSaving(false);
		}
	}

	async function markPaid(deal: Deal) {
		const amount = deal.creator_invoice_amount || deal.creator_fee;
		const creatorName = creatorLabel(creatorNamesOf(deal));
		if (!confirm(`Mark ₹${inr(amount) || amount || '0'} to ${creatorName} as paid?`)) return;
		try {
			await markPaidMutation.mutateAsync({ id: deal.id, version: deal.version });
		} catch (e) {
			alert((e as Error).message);
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
				accessorKey: 'brand',
				header: 'Brand'
			},
			{
				accessorKey: 'campaign',
				header: 'Campaign',
				cell: ({ row }) => row.original.campaign || '—'
			},
			{
				accessorKey: 'tch_poc',
				header: 'TCH POC',
				meta: { tdStyle: { color: 'var(--n-fg-muted)' } }
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
					const creatorDoc = docsForDeal.find((d) => d.doc_type === 'CreatorInvoice');
					const received = deal.invoice_received === 'Y';
					return (
						<div className="flex gap-1">
							<InvoiceTag label="Client" doc={clientDoc} fallbackYes={received} />
							<InvoiceTag label="Creator" doc={creatorDoc} fallbackYes={received} />
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
				meta: { thClassName: 'w-[190px]' },
				cell: ({ row }) => {
					const deal = row.original;
					const status = statusOf(deal);
					const canMarkPaid = status === 'due' || status === 'overdue' || status === 'upcoming';
					return (
						<div className="flex gap-1">
							<Button variant="outline" onClick={() => startUpload(deal)}>
								Upload
							</Button>
							{canMarkPaid && (
								<Button variant="primary" onClick={() => markPaid(deal)}>
									Mark paid
								</Button>
							)}
						</div>
					);
				}
			}
		],
		[docsByDeal, statusOf]
	);

	const existingDocs = uploadDeal ? (docsByDeal.get(uploadDeal.id) ?? []) : [];

	return (
		<>
			<section className="space-y-6">
				<header className="flex items-end justify-between flex-wrap gap-3">
					<h1 className="page-title text-[28px] leading-[1.2] font-bold" style={{ color: 'var(--n-fg)' }}>
						Payments
					</h1>
				</header>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					<MetricCard
						label="Due this Wednesday"
						value={`${metrics.dueCount} · ₹${inr(metrics.dueTotal) || '0'}`}
					/>
					<MetricCard
						label="Overdue"
						value={`${metrics.overdueCount} · ₹${inr(metrics.overdueTotal) || '0'}`}
						valueColor={metrics.overdueCount > 0 ? '#a4231b' : undefined}
					/>
					<MetricCard label="Awaiting Invoices" value={metrics.awaitingCount} />
					<MetricCard label="Cleared" value={metrics.clearedCount} />
				</div>

				<div className="seg-toggle flex-wrap">
					{FILTER_OPTIONS.map((f) => (
						<button
							key={f.key}
							type="button"
							className={cn(statusFilter === f.key && 'active')}
							onClick={() => setStatusFilter(f.key)}
						>
							{f.label}
						</button>
					))}
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
					<DataTable
						data={filtered}
						columns={columns}
						numbered
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
							disabled={saving || (!clientFile && !creatorFile)}
							onClick={saveUpload}
						>
							{saving ? 'Uploading…' : 'Upload'}
						</Button>
					</>
				}
			>
				{uploadDeal && (
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>Client invoice (TCH → Client)</Label>
								<input
									type="file"
									accept="image/*,application/pdf"
									onChange={(e) => setClientFile(e.target.files?.[0] ?? null)}
									className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
								/>
							</div>
							<div>
								<Label>Creator (influencer) invoice</Label>
								<input
									type="file"
									accept="image/*,application/pdf"
									onChange={(e) => setCreatorFile(e.target.files?.[0] ?? null)}
									className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
								/>
							</div>
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
		</>
	);
}
