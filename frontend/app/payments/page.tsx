'use client';

import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { type Deal, type DealDocument, type CreatorInvoice } from '@/lib/api';
import { toast } from 'sonner';
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
import PageHeader from '@/components/PageHeader';
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
import { InvoicesTab } from './components/InvoicesTab';
import { UtrTab } from './components/UtrTab';
import { TdsTab } from './components/TdsTab';
import { PaymentModals } from './components/PaymentModals';

type StatusFilter = 'all' | PaymentStatus;
type TabState = 'receivables' | 'payables' | 'utr' | 'tds';

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
				cell: ({ row }: { row: { original: Deal } }) => row.original.brand || '—'
			} : {
				id: 'creator',
				header: 'Creator',
				meta: { tdClassName: 'font-medium' },
				accessorFn: (r: Deal) => creatorLabel(creatorNamesOf(r)),
				cell: ({ row }: { row: { original: Deal } }) => creatorLabel(creatorNamesOf(row.original)) || '—'
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

	return (
		<>
			<section className="space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<PageHeader title="Payments" description="Manage accounts receivable, creator payouts, TDS deductions, and UTR logs." />
					<div className="flex bg-[var(--n-bg-soft)] p-1 rounded-lg border border-[var(--n-border)] mb-4">
						<button
							onClick={() => setActiveTab('receivables')}
							style={{
								fontSize: 12
							}}
							className={`px-4 py-1.5 font-medium rounded-md transition-colors duration-100 ${activeTab === 'receivables' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
						>
							Receivables (Clients)
						</button>
						<button
							onClick={() => setActiveTab('payables')}
							style={{
								fontSize: 12
							}}
							className={`px-4 py-1.5 font-medium rounded-md transition-colors duration-100 ${activeTab === 'payables' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
						>
							Payables (Creators)
						</button>
						<button
							onClick={() => setActiveTab('utr')}
							style={{
								fontSize: 12
							}}
							className={`px-4 py-1.5 font-medium rounded-md transition-colors duration-100 ${activeTab === 'utr' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
						>
							UTR Details
						</button>
						<button
							onClick={() => setActiveTab('tds')}
							style={{
								fontSize: 12
							}}
							className={`px-4 py-1.5 font-medium rounded-md transition-colors duration-100 ${activeTab === 'tds' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
						>
							TDS Dues
						</button>
					</div>
				</div>

				{activeTab !== 'utr' && activeTab !== 'tds' ? (
					<InvoicesTab
						activeTab={activeTab}
						statusFilter={statusFilter}
						setStatusFilter={setStatusFilter}
						filtered={filtered}
						columns={columns}
						loading={loading}
						error={error}
						refetchDeals={refetchDeals}
						metrics={metrics}
					/>
				) : activeTab === 'utr' ? (
					<UtrTab
						utrSearch={utrSearch}
						setUtrSearch={setUtrSearch}
						setUtrPage={setUtrPage}
						setImportOpen={setImportOpen}
						setManualOpen={setManualOpen}
						utrData={utrData}
						utrColumns={utrColumns}
						loading={loading}
						utrPage={utrPage}
					/>
				) : (
					<TdsTab
						tdsStatusFilter={tdsStatusFilter}
						setTdsStatusFilter={setTdsStatusFilter}
						setTdsOpen={setTdsOpen}
						tdsData={tdsData}
						tdsColumns={tdsColumns}
						loading={loading}
					/>
				)}
			</section>

			<PaymentModals
				uploadOpen={uploadOpen}
				setUploadOpen={setUploadOpen}
				closeUpload={closeUpload}
				uploadDeal={uploadDeal}
				clientFile={clientFile}
				setClientFile={setClientFile}
				saving={saving}
				saveUpload={saveUpload}
				existingDocs={existingDocs}

				importOpen={importOpen}
				setImportOpen={setImportOpen}
				excelFile={excelFile}
				setExcelFile={setExcelFile}
				importing={importing}
				submitImport={submitImport}

				manualOpen={manualOpen}
				setManualOpen={setManualOpen}
				isAddingTransaction={addTransactionMutation.isPending}
				submitManualTransaction={submitManualTransaction}
				txDate={txDate} setTxDate={setTxDate}
				txType={txType} setTxType={setTxType}
				txVendor={txVendor} setTxVendor={setTxVendor}
				txUtr={txUtr} setTxUtr={setTxUtr}
				txAmount={txAmount} setTxAmount={setTxAmount}
				txNotes={txNotes} setTxNotes={setTxNotes}

				tdsOpen={tdsOpen}
				setTdsOpen={setTdsOpen}
				isAddingTds={addTdsEntryMutation.isPending}
				submitTdsEntry={submitTdsEntry}
				creators={creators}
				tdsCreatorId={tdsCreatorId} setTdsCreatorId={setTdsCreatorId}
				tdsQuarter={tdsQuarter} setTdsQuarter={setTdsQuarter}
				tdsRate={tdsRate} setTdsRate={setTdsRate}
				tdsGross={tdsGross} setTdsGross={setTdsGross}
				tdsNotes={tdsNotes} setTdsNotes={setTdsNotes}

				tdsRemitOpen={tdsRemitOpen}
				setTdsRemitOpen={setTdsRemitOpen}
				tdsRemitItem={tdsRemitItem}
				isUpdatingRemittance={updateTdsRemittanceMutation.isPending}
				submitTdsRemit={submitTdsRemit}
				tdsRemitDate={tdsRemitDate} setTdsRemitDate={setTdsRemitDate}
				tdsChallan={tdsChallan} setTdsChallan={setTdsChallan}

				confirmPaidDeal={confirmPaidDeal}
				setConfirmPaidDeal={setConfirmPaidDeal}
				activeTab={activeTab}
				markClientPaidPending={markClientPaidMutation.isPending}
				markCreatorPaidPending={markCreatorPaidMutation.isPending}
				markPaid={markPaid}
			/>
		</>
	);
}
