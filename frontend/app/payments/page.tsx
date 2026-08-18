'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { type Deal, type DealDocument, type CreatorInvoice } from '@/lib/api';
import Link from 'next/link';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { errorMessage, formatDocDate, inr } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';
import { creatorLabel, creatorNamesOf } from '@/lib/deals';
import {
	clientPaymentDueDate,
	creatorPaymentDueDate,
	clientPaymentStatusOf,
	creatorPaymentStatusOf,
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
import QueryErrorState from '@/components/QueryErrorState';
import {
	useDealsQuery,
	useDealDocumentsQuery,
	useCreatorInvoicesQuery,
	useMarkClientPaidMutation,
	useMarkCreatorPaidMutation,
	useUploadInvoiceMutation,
	usePaymentTransactionsQuery,
	useAddPaymentTransactionMutation,
	useImportPaymentTransactionsMutation,
	useTdsEntriesQuery,
	useAddTdsEntryMutation,
	useUpdateTdsRemittanceMutation,
	type PaymentTransactionItem,
	type TdsEntryItem
} from './queries';
import { useCommercialCreatorsQuery } from '../commercial/queries';
import { downloadAuthenticatedFile } from '@/lib/download';

type StatusFilter = 'all' | PaymentStatus;
type TabState = 'receivables' | 'payables' | 'utr' | 'tds';

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
			<button type="button" onClick={() => void downloadAuthenticatedFile(doc.file, doc.label || label)} title={doc.label || label}>
				{tag}
			</button>
		);
	}
	return tag;
}

export default function PaymentsPage() {
	const { fyStart } = useFiscalYear();

	// Tab states
	const [activeTab, setActiveTab] = React.useState<TabState>('receivables');
	const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

	// API queries
	const { data: rows = [], isLoading: dealsLoading, error: dealsError, refetch: refetchDeals } = useDealsQuery(fyStart);
	const { data: docs = [], isLoading: docsLoading } = useDealDocumentsQuery();
	const { data: creatorInvoices = [], isLoading: creatorInvoicesLoading } = useCreatorInvoicesQuery();
	const { data: creators = [] } = useCommercialCreatorsQuery();

	// UTR Tab state
	const [utrPage, setUtrPage] = React.useState(1);
	const [utrSearch, setUtrSearch] = React.useState('');
	const { data: utrData, isLoading: utrLoading, refetch: refetchUtr } = usePaymentTransactionsQuery(utrPage, utrSearch);

	// TDS Tab state
	const [tdsStatusFilter, setTdsStatusFilter] = React.useState<'All' | 'Pending' | 'Remitted'>('All');
	const { data: tdsData = [], isLoading: tdsLoading, refetch: refetchTds } = useTdsEntriesQuery(
		undefined,
		tdsStatusFilter === 'All' ? undefined : tdsStatusFilter
	);

	// Mutations
	const markClientPaidMutation = useMarkClientPaidMutation();
	const markCreatorPaidMutation = useMarkCreatorPaidMutation();
	const uploadInvoiceMutation = useUploadInvoiceMutation();
	const addTransactionMutation = useAddPaymentTransactionMutation();
	const importTransactionsMutation = useImportPaymentTransactionsMutation();
	const addTdsEntryMutation = useAddTdsEntryMutation();
	const updateTdsRemittanceMutation = useUpdateTdsRemittanceMutation();

	// Modal states
	const [uploadOpen, setUploadOpen] = React.useState(false);
	const [uploadDeal, setUploadDeal] = React.useState<Deal | null>(null);
	const [clientFile, setClientFile] = React.useState<File | null>(null);
	const [saving, setSaving] = React.useState(false);
	const [confirmPaidDeal, setConfirmPaidDeal] = React.useState<Deal | null>(null);

	// Excel Import Modal state
	const [importOpen, setImportOpen] = React.useState(false);
	const [excelFile, setExcelFile] = React.useState<File | null>(null);
	const [importing, setImporting] = React.useState(false);

	// Manual Transaction Modal state
	const [manualOpen, setManualOpen] = React.useState(false);
	const [txDate, setTxDate] = React.useState(new Date().toISOString().slice(0, 10));
	const [txVendor, setTxVendor] = React.useState('');
	const [txUtr, setTxUtr] = React.useState('');
	const [txType, setTxType] = React.useState<'debit' | 'credit'>('debit');
	const [txAmount, setTxAmount] = React.useState('');
	const [txNotes, setTxNotes] = React.useState('');

	// Manual TDS Entry Modal state
	const [tdsOpen, setTdsOpen] = React.useState(false);
	const [tdsCreatorId, setTdsCreatorId] = React.useState('');
	const [tdsQuarter, setTdsQuarter] = React.useState('Q1');
	const [tdsRate, setTdsRate] = React.useState('0.10');
	const [tdsGross, setTdsGross] = React.useState('');
	const [tdsNotes, setTdsNotes] = React.useState('');

	// TDS Remittance Modal state
	const [tdsRemitOpen, setTdsRemitOpen] = React.useState(false);
	const [tdsRemitItem, setTdsRemitItem] = React.useState<TdsEntryItem | null>(null);
	const [tdsChallan, setTdsChallan] = React.useState('');
	const [tdsRemitDate, setTdsRemitDate] = React.useState(new Date().toISOString().slice(0, 10));

	const loading = dealsLoading || docsLoading || creatorInvoicesLoading || (activeTab === 'utr' && utrLoading) || (activeTab === 'tds' && tdsLoading);
	const error = dealsError ? dealsError.message : null;

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
		(deal: Deal): PaymentStatus => {
			if (activeTab === 'receivables') {
				return clientPaymentStatusOf(deal, docsByDeal.get(deal.id) ?? [], today);
			} else {
				return creatorPaymentStatusOf(deal, docsByDeal.get(deal.id) ?? [], today, creatorInvoicesByDeal.get(deal.id) ?? []);
			}
		},
		[activeTab, docsByDeal, creatorInvoicesByDeal, today]
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
			const amount = activeTab === 'receivables' 
				? Number(r.client_invoice_amount || r.total_fee) || 0
				: Number(r.creator_invoice_amount || r.creator_fee) || 0;
				
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
	}, [scoped, statusOf, activeTab]);

	const filtered = React.useMemo(() => {
		let result = scoped;
		if (activeTab === 'payables') {
			result = result.filter(r => r.creator || (r.creator_shares && r.creator_shares.length > 0) || Number(r.creator_fee) > 0);
		}
		if (statusFilter !== 'all') {
			result = result.filter((r) => statusOf(r) === statusFilter);
		}
		return result;
	}, [scoped, statusFilter, statusOf, activeTab]);

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
		try {
			if (activeTab === 'receivables') {
				await markClientPaidMutation.mutateAsync({ id: deal.id, version: deal.version });
				toast.success(`Payment from ${deal.brand || 'Client'} marked as received.`);
			} else {
				const creatorName = creatorLabel(creatorNamesOf(deal));
				await markCreatorPaidMutation.mutateAsync({ id: deal.id, version: deal.version });
				toast.success(`Payment to ${creatorName} marked as paid.`);
			}
			setConfirmPaidDeal(null);
		} catch (e) {
			toast.error('Payment could not be updated.', { description: (e as Error).message });
		}
	}

	async function submitManualTransaction(e: React.FormEvent) {
		e.preventDefault();
		if (!txVendor || !txUtr || !txAmount) {
			toast.error('Required fields are missing.');
			return;
		}
		try {
			await addTransactionMutation.mutateAsync({
				transactionDate: txDate,
				vendorName: txVendor,
				utrOrRef: txUtr,
				debitAmount: txType === 'debit' ? Number(txAmount) : 0,
				creditAmount: txType === 'credit' ? Number(txAmount) : 0,
				notes: txNotes
			});
			toast.success('Transaction added.');
			setManualOpen(false);
			setTxVendor('');
			setTxUtr('');
			setTxAmount('');
			setTxNotes('');
			refetchUtr();
		} catch (err: unknown) {
			toast.error('Failed to add transaction.', { description: errorMessage(err) });
		}
	}

	async function submitImport(e: React.FormEvent) {
		e.preventDefault();
		if (!excelFile) {
			toast.error('Please select an Excel file.');
			return;
		}
		setImporting(true);
		try {
			const res = await importTransactionsMutation.mutateAsync(excelFile);
			toast.success('Excel import completed!', {
				description: `Imported ${res.imported_count} records. ${res.skipped.length} skipped.`
			});
			setImportOpen(false);
			setExcelFile(null);
			refetchUtr();
		} catch (err: unknown) {
			toast.error('Import failed.', { description: errorMessage(err) });
		} finally {
			setImporting(false);
		}
	}

	async function submitTdsEntry(e: React.FormEvent) {
		e.preventDefault();
		if (!tdsCreatorId || !tdsGross || !tdsRate) {
			toast.error('Creator, Gross, and Rate are required.');
			return;
		}
		try {
			await addTdsEntryMutation.mutateAsync({
				creatorId: tdsCreatorId,
				quarter: tdsQuarter,
				tdsRate: Number(tdsRate),
				grossAmount: Number(tdsGross),
				notes: tdsNotes
			});
			toast.success('TDS entry recorded successfully.');
			setTdsOpen(false);
			setTdsGross('');
			setTdsNotes('');
			refetchTds();
		} catch (err: unknown) {
			toast.error('Failed to record TDS entry.', { description: errorMessage(err) });
		}
	}

	async function submitTdsRemit(e: React.FormEvent) {
		e.preventDefault();
		if (!tdsRemitItem || !tdsChallan || !tdsRemitDate) {
			toast.error('Challan Number and Remittance Date are required.');
			return;
		}
		try {
			await updateTdsRemittanceMutation.mutateAsync({
				id: tdsRemitItem.id,
				challanNumber: tdsChallan,
				remittanceDate: tdsRemitDate
			});
			toast.success('TDS remittance recorded successfully.');
			setTdsRemitOpen(false);
			setTdsChallan('');
			refetchTds();
		} catch (err: unknown) {
			toast.error('Failed to record remittance.', { description: errorMessage(err) });
		}
	}

	const columns = React.useMemo<ColumnDef<Deal, unknown>[]>(
		() => {
			const entityColumn = activeTab === 'receivables' ? {
				id: 'brand',
				header: 'Brand',
				meta: { tdClassName: 'font-medium' },
				accessorFn: (r: Deal) => r.brand,
				cell: ({ row }: { row: { original: Deal }}) => row.original.brand || '—'
			} : {
				id: 'creator',
				header: 'Creator',
				meta: { tdClassName: 'font-medium' },
				accessorFn: (r: Deal) => creatorLabel(creatorNamesOf(r)),
				cell: ({ row }: { row: { original: Deal }}) => creatorLabel(creatorNamesOf(row.original)) || '—'
			};

			return [
				entityColumn,
				{
					accessorKey: 'campaign',
					header: 'Campaign',
					cell: ({ row }) => (
						<div>
							<div className="font-medium" style={{ color: 'var(--n-fg)' }}>
								{row.original.campaign || '—'}
							</div>
							<div className="text-[12px] truncate max-w-[250px]" style={{ color: 'var(--n-fg-subtle)' }}>
								{activeTab === 'receivables' ? creatorLabel(creatorNamesOf(row.original)) : row.original.brand}
							</div>
						</div>
					)
				},
				{
					id: 'amount',
					header: 'Amount',
					meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums' },
					accessorFn: (r: Deal) => activeTab === 'receivables' 
						? Number(r.client_invoice_amount || r.total_fee) || 0
						: Number(r.creator_invoice_amount || r.creator_fee) || 0,
					cell: ({ row }) => {
						const amt = activeTab === 'receivables'
							? row.original.client_invoice_amount || row.original.total_fee
							: row.original.creator_invoice_amount || row.original.creator_fee;
						const formatted = inr(Number(amt));
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
						
						if (activeTab === 'receivables') {
							return <InvoiceTag label="Client" doc={clientDoc} fallbackYes={received} />;
						} else {
							return (
								<div className="flex gap-1">
									<Tag tone={creatorCount >= requiredCount && requiredCount > 0 ? 'yes' : 'no'}>Creators {creatorCount}/{requiredCount}</Tag>
								</div>
							);
						}
					}
				},
				{
					id: 'due',
					header: 'Due',
					meta: { tdClassName: 'whitespace-nowrap', tdStyle: { color: 'var(--n-fg-muted)' } },
					accessorFn: (r: Deal) => activeTab === 'receivables' ? clientPaymentDueDate(r) : creatorPaymentDueDate(r),
					cell: ({ row }) => {
						const due = activeTab === 'receivables' ? clientPaymentDueDate(row.original) : creatorPaymentDueDate(row.original);
						return due ? formatDocDate(due) : '—';
					}
				},
				{
					id: 'status',
					header: 'Status',
					accessorFn: (r: Deal) => statusOf(r),
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
								{activeTab === 'receivables' && (
									<Button variant="outline" size="sm" onClick={() => startUpload(deal)} title="Upload client invoice">
										<Icon name="upload" size={14} />
									</Button>
								)}
								{canMarkPaid && (
									<Button variant="primary" size="sm" onClick={() => setConfirmPaidDeal(deal)} title={activeTab === 'receivables' ? "Mark client paid" : "Mark creator paid"}>
										<Icon name="check" size={14} />
									</Button>
								)}
							</div>
						);
					}
				}
			];
		},
		[activeTab, docsByDeal, creatorInvoicesByDeal, statusOf]
	);

	const utrColumns = React.useMemo<ColumnDef<PaymentTransactionItem, unknown>[]>(
		() => [
			{
				accessorKey: 'transactionDate',
				header: 'Date',
				cell: ({ row }) => <span className="tabular-nums">{row.original.transactionDate}</span>
			},
			{
				accessorKey: 'vendorName',
				header: 'Vendor / Partner',
				cell: ({ row }) => <span className="font-semibold">{row.original.vendorName}</span>
			},
			{
				accessorKey: 'utrOrRef',
				header: 'UTR / Ref No',
				cell: ({ row }) => <span className="text-[12px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{row.original.utrOrRef}</span>
			},
			{
				accessorKey: 'debitAmount',
				header: 'Debit (Paid Out)',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums' },
				cell: ({ row }) => {
					const val = Number(row.original.debitAmount);
					return val > 0 ? <span className="text-red-600 font-medium">₹{inr(val)}</span> : <span className="text-gray-300">—</span>;
				}
			},
			{
				accessorKey: 'creditAmount',
				header: 'Credit (Received)',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums' },
				cell: ({ row }) => {
					const val = Number(row.original.creditAmount);
					return val > 0 ? <span className="text-green-600 font-medium">₹{inr(val)}</span> : <span className="text-gray-300">—</span>;
				}
			},
			{
				accessorKey: 'notes',
				header: 'Notes',
				cell: ({ row }) => <span className="text-[12px] text-gray-500 truncate max-w-[200px]" title={row.original.notes}>{row.original.notes || '—'}</span>
			}
		],
		[]
	);

	const tdsColumns = React.useMemo<ColumnDef<TdsEntryItem, unknown>[]>(
		() => [
			{
				accessorKey: 'creator.name',
				header: 'Creator Name',
				cell: ({ row }) => <span className="font-semibold">{row.original.creator?.name || '—'}</span>
			},
			{
				accessorKey: 'quarter',
				header: 'Quarter',
				cell: ({ row }) => <span>{row.original.quarter}</span>
			},
			{
				accessorKey: 'grossAmount',
				header: 'Gross Amount',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums font-medium' },
				cell: ({ row }) => `₹${inr(Number(row.original.grossAmount))}`
			},
			{
				accessorKey: 'tdsRate',
				header: 'TDS Rate',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums' },
				cell: ({ row }) => `${(Number(row.original.tdsRate) * 100).toFixed(1)}%`
			},
			{
				accessorKey: 'tdsAmount',
				header: 'TDS Amount',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums text-amber-700 font-medium' },
				cell: ({ row }) => `₹${inr(Number(row.original.tdsAmount))}`
			},
			{
				accessorKey: 'netPayable',
				header: 'Net Payable',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums font-bold' },
				cell: ({ row }) => `₹${inr(Number(row.original.netPayable))}`
			},
			{
				accessorKey: 'status',
				header: 'Status',
				cell: ({ row }) => (
					<Tag tone={row.original.status === 'Remitted' ? 'yes' : 'no'}>
						{row.original.status}
					</Tag>
				)
			},
			{
				accessorKey: 'challanNumber',
				header: 'Challan Info',
				cell: ({ row }) => {
					const item = row.original;
					return item.status === 'Remitted' ? (
						<div className="text-[11.5px] leading-tight">
							<div className="font-medium text-gray-900">{item.challanNumber}</div>
							<div className="text-gray-400">{item.remittanceDate}</div>
						</div>
					) : <span className="text-gray-400">—</span>;
				}
			},
			{
				id: 'actions',
				header: 'Actions',
				meta: { tdClassName: 'text-right' },
				cell: ({ row }) => {
					const item = row.original;
					return item.status === 'Pending' ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setTdsRemitItem(item);
								setTdsRemitOpen(true);
							}}
						>
							<Icon name="check" size={13} /> Remit
						</Button>
					) : null;
				}
			}
		],
		[]
	);

	const existingDocs = uploadDeal ? (docsByDeal.get(uploadDeal.id) ?? []) : [];
	
	const getConfirmModalTitle = () => activeTab === 'receivables' ? 'Confirm Payment Received?' : 'Confirm Payout?';
	const getConfirmModalDescription = () => {
		if (!confirmPaidDeal) return '';
		if (activeTab === 'receivables') {
			return `Are you sure you want to mark the payment of ₹${inr(Number(confirmPaidDeal.client_invoice_amount || confirmPaidDeal.total_fee)) || '0'} from ${confirmPaidDeal.brand || 'Client'} as received? This action will finalize the transaction and cannot be undone.`;
		} else {
			return `Are you sure you want to mark the payment of ₹${inr(Number(confirmPaidDeal.creator_invoice_amount || confirmPaidDeal.creator_fee)) || '0'} to ${creatorLabel(creatorNamesOf(confirmPaidDeal))} as paid? This action will finalize the transaction and cannot be undone.`;
		}
	};
	const getConfirmModalLabel = () => activeTab === 'receivables' ? 'Yes, mark received' : 'Yes, mark paid';

	return (
		<>
			<section className="space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<PageHeader title="Payments" description="Manage accounts receivable, creator payouts, TDS deductions, and UTR logs." />
					<div className="flex bg-[var(--n-bg-soft)] p-1 rounded-lg border border-[var(--n-border)] mb-4">
						<button 
							onClick={() => setActiveTab('receivables')} 
							className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-100 ${activeTab === 'receivables' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
						>
							Receivables (Clients)
						</button>
						<button 
							onClick={() => setActiveTab('payables')} 
							className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-100 ${activeTab === 'payables' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
						>
							Payables (Creators)
						</button>
						<button 
							onClick={() => setActiveTab('utr')} 
							className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-100 ${activeTab === 'utr' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
						>
							UTR Details
						</button>
						<button 
							onClick={() => setActiveTab('tds')} 
							className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-100 ${activeTab === 'tds' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
						>
							TDS Dues
						</button>
					</div>
				</div>

				{activeTab !== 'utr' && activeTab !== 'tds' ? (
					<>
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 anim-fade-up">
							<MetricCard
								label="Due Soon"
								value={`${metrics.dueCount} · ₹${inr(metrics.dueTotal) || '0'}`}
							/>
							<div className="rounded-xl p-4 border" style={{ background: metrics.overdueCount > 0 ? 'var(--color-danger-bg)' : 'var(--n-bg)', borderColor: metrics.overdueCount > 0 ? 'var(--color-danger-border)' : 'var(--n-border)' }}>
								<p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: metrics.overdueCount > 0 ? 'var(--color-danger)' : 'var(--n-fg-subtle)' }}>Overdue</p>
								<p className="text-[24px] font-bold tracking-tight tabular-nums" style={{ color: metrics.overdueCount > 0 ? 'var(--color-danger-muted)' : 'var(--n-fg)' }}>
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
												<div className="absolute bottom-0 left-0 right-0 h-[2px] bg-current rounded-t-sm" />
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
					</>
				) : activeTab === 'utr' ? (
					// UTR Ledger View
					<div className="space-y-4 anim-fade-up">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="relative flex-1 max-w-md">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
									<Icon name="search" size={13} />
								</span>
								<input
									value={utrSearch}
									onChange={(e) => { setUtrSearch(e.target.value); setUtrPage(1); }}
									placeholder="Search by vendor, UTR, or notes…"
									className="h-9 w-full rounded-lg pl-9 pr-3 text-[13.5px] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)]"
									style={{ background: 'var(--n-bg)', color: 'var(--n-fg)' }}
								/>
							</div>

							<div className="flex items-center gap-2">
								<Button variant="outline" onClick={() => setImportOpen(true)}>
									<Icon name="upload" size={14} /> Import Excel
								</Button>
								<Button variant="primary" onClick={() => setManualOpen(true)}>
									<Icon name="plus" size={14} /> Add Transaction
								</Button>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3 mb-2">
							<MetricCard label="Total Outflows (Debits)" value={`₹${inr(Number(utrData?.summary.total_debit || 0))}`} />
							<MetricCard label="Total Inflows (Credits)" value={`₹${inr(Number(utrData?.summary.total_credit || 0))}`} />
						</div>

						<DataTable
							data={utrData?.items ?? []}
							columns={utrColumns}
							loading={loading}
							emptyMessage="No payment transactions logged yet."
						/>

						{utrData && utrData.total_pages > 1 && (
							<div className="flex items-center justify-end gap-2 pt-4">
								<Button
									variant="outline"
									size="sm"
									disabled={utrPage === 1}
									onClick={() => setUtrPage((p) => p - 1)}
								>
									Previous
								</Button>
								<span className="text-[13px] text-gray-500">
									Page {utrPage} of {utrData.total_pages}
								</span>
								<Button
									variant="outline"
									size="sm"
									disabled={utrPage === utrData.total_pages}
									onClick={() => setUtrPage((p) => p + 1)}
								>
									Next
								</Button>
							</div>
						)}
					</div>
				) : (
					// TDS Dues View
					<div className="space-y-4 anim-fade-up">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex bg-[var(--n-bg-soft)] p-1 rounded-lg border border-[var(--n-border)]">
								{(['All', 'Pending', 'Remitted'] as const).map((statusOption) => (
									<button
										key={statusOption}
										onClick={() => setTdsStatusFilter(statusOption)}
										className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors duration-100 ${tdsStatusFilter === statusOption ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
									>
										{statusOption}
									</button>
								))}
							</div>

							<Button variant="primary" onClick={() => setTdsOpen(true)}>
								<Icon name="plus" size={14} /> Add TDS Entry
							</Button>
						</div>

						<DataTable
							data={tdsData}
							columns={tdsColumns}
							loading={loading}
							emptyMessage="No TDS records recorded."
						/>
					</div>
				)}
			</section>

			{/* Client Invoice Upload Dialog */}
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
												<button
													type="button"
													className="inline-link text-[13px]"
													onClick={() => void downloadAuthenticatedFile(d.file, d.label || 'deal-document')}
												>
													{d.label || d.file.split('/').pop()} ↗
												</button>
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

			{/* Excel Import Dialog */}
			<Dialog
				open={importOpen}
				onOpenChange={setImportOpen}
				title="Import UTR Payments from Excel"
				description="Upload bank statement or ledger in Excel format. Columns should match: Transaction Date | Vendor Name | Cheque/UTR or Ref No | Debit Amount | Credit Amount."
				footer={
					<>
						<Button variant="ghost" onClick={() => setImportOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							disabled={importing || !excelFile}
							onClick={submitImport}
						>
							{importing ? 'Importing…' : 'Import'}
						</Button>
					</>
				}
			>
				<form onSubmit={submitImport} className="space-y-4">
					<div>
						<Label>Select Excel File (.xlsx)</Label>
						<input
							type="file"
							required
							accept=".xlsx"
							onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
							className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
						/>
					</div>
				</form>
			</Dialog>

			{/* Manual Add Transaction Dialog */}
			<Dialog
				open={manualOpen}
				onOpenChange={setManualOpen}
				title="Add Payment Transaction"
				description="Manually record a UTR debit or credit transaction entry."
				footer={
					<>
						<Button variant="ghost" onClick={() => setManualOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							disabled={addTransactionMutation.isPending}
							onClick={submitManualTransaction}
						>
							{addTransactionMutation.isPending ? 'Saving…' : 'Add Transaction'}
						</Button>
					</>
				}
			>
				<form onSubmit={submitManualTransaction} className="space-y-4">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label>Transaction Date</Label>
							<input
								type="date"
								required
								value={txDate}
								onChange={(e) => setTxDate(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
							/>
						</div>
						<div>
							<Label>Transaction Type</Label>
							<select
								value={txType}
								onChange={(e) => setTxType(e.target.value as 'debit' | 'credit')}
								className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
							>
								<option value="debit">Debit (Paid Out)</option>
								<option value="credit">Credit (Received)</option>
							</select>
						</div>
					</div>

					<div>
						<Label>Vendor / Partner Name</Label>
						<input
							type="text"
							required
							value={txVendor}
							onChange={(e) => setTxVendor(e.target.value)}
							className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
							placeholder="e.g. Creator ABC or Brand XYZ"
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label>Cheque / UTR Ref No</Label>
							<input
								type="text"
								required
								value={txUtr}
								onChange={(e) => setTxUtr(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
								placeholder="NEFT/IDFC/..."
							/>
						</div>
						<div>
							<Label>Amount (INR)</Label>
							<input
								type="number"
								required
								value={txAmount}
								onChange={(e) => setTxAmount(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
								placeholder="0.00"
							/>
						</div>
					</div>

					<div>
						<Label>Notes / Comments</Label>
						<textarea
							value={txNotes}
							onChange={(e) => setTxNotes(e.target.value)}
							className="w-full h-16 rounded p-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
							placeholder="Optional details..."
						/>
					</div>
				</form>
			</Dialog>

			{/* Manual Add TDS Entry Dialog */}
			<Dialog
				open={tdsOpen}
				onOpenChange={setTdsOpen}
				title="Add TDS Record"
				description="Manually record statutory TDS deducted from creator payments."
				footer={
					<>
						<Button variant="ghost" onClick={() => setTdsOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							disabled={addTdsEntryMutation.isPending}
							onClick={submitTdsEntry}
						>
							{addTdsEntryMutation.isPending ? 'Saving…' : 'Record TDS'}
						</Button>
					</>
				}
			>
				<form onSubmit={submitTdsEntry} className="space-y-4">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label>Creator</Label>
							<select
								value={tdsCreatorId}
								onChange={(e) => setTdsCreatorId(e.target.value)}
								required
								className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
							>
								<option value="">Select Creator</option>
								{creators.map((c) => (
									<option key={c.id} value={c.id}>
										{c.name}
									</option>
								))}
							</select>
						</div>
						<div>
							<Label>Financial Quarter</Label>
							<select
								value={tdsQuarter}
								onChange={(e) => setTdsQuarter(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
							>
								<option value="Q1">Q1 (Apr - Jun)</option>
								<option value="Q2">Q2 (Jul - Sep)</option>
								<option value="Q3">Q3 (Oct - Dec)</option>
								<option value="Q4">Q4 (Jan - Mar)</option>
							</select>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label>TDS Rate</Label>
							<select
								value={tdsRate}
								onChange={(e) => setTdsRate(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
							>
								<option value="0.01">1% (Individual Section 194C)</option>
								<option value="0.02">2% (Company Section 194C)</option>
								<option value="0.075">7.5% (TDS on E-Commerce)</option>
								<option value="0.10">10% (Section 194J Professionals)</option>
							</select>
						</div>
						<div>
							<Label>Gross Billing Amount (INR)</Label>
							<input
								type="number"
								required
								value={tdsGross}
								onChange={(e) => setTdsGross(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
								placeholder="0.00"
							/>
						</div>
					</div>

					<div>
						<Label>Notes / Comments</Label>
						<textarea
							value={tdsNotes}
							onChange={(e) => setTdsNotes(e.target.value)}
							className="w-full h-16 rounded p-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
							placeholder="Optional details..."
						/>
					</div>
				</form>
			</Dialog>

			{/* Record TDS Remittance / Challan Dialog */}
			<Dialog
				open={tdsRemitOpen}
				onOpenChange={setTdsRemitOpen}
				title="Record TDS Remittance"
				description={
					tdsRemitItem
						? `Record tax Challan details for ${tdsRemitItem.creator?.name || 'Creator'} (${tdsRemitItem.quarter}). TDS Amount to remit: ₹${inr(Number(tdsRemitItem.tdsAmount))}.`
						: undefined
				}
				footer={
					<>
						<Button variant="ghost" onClick={() => setTdsRemitOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							disabled={updateTdsRemittanceMutation.isPending}
							onClick={submitTdsRemit}
						>
							{updateTdsRemittanceMutation.isPending ? 'Saving…' : 'Record Remittance'}
						</Button>
					</>
				}
			>
				{tdsRemitItem && (
					<form onSubmit={submitTdsRemit} className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>Remittance Date</Label>
								<input
									type="date"
									required
									value={tdsRemitDate}
									onChange={(e) => setTdsRemitDate(e.target.value)}
									className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
								/>
							</div>
							<div>
								<Label>Challan Number / ITNS 281</Label>
								<input
									type="text"
									required
									value={tdsChallan}
									onChange={(e) => setTdsChallan(e.target.value)}
									className="w-full h-9 rounded px-3 text-[13px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
									placeholder="BSR Code + Challan No"
								/>
							</div>
						</div>
					</form>
				)}
			</Dialog>

			<ConfirmDialog 
				open={confirmPaidDeal !== null} 
				onOpenChange={(value) => { if (!value) setConfirmPaidDeal(null); }} 
				title={getConfirmModalTitle()} 
				description={getConfirmModalDescription()} 
				confirmLabel={getConfirmModalLabel()} 
				pending={activeTab === 'receivables' ? markClientPaidMutation.isPending : markCreatorPaidMutation.isPending} 
				onConfirm={() => { if (confirmPaidDeal) return markPaid(confirmPaidDeal); }} 
			/>
		</>
	);
}
