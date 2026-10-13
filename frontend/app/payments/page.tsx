'use client';

import * as React from 'react';
import { type Deal, type DealDocument, type CreatorInvoice } from '@/lib/api';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';
import { creatorLabel, creatorNamesOf } from '@/lib/deals';
import {
	clientPaymentStatusOf,
	creatorPaymentStatusOf,
	type PaymentStatus
} from '@/lib/payments';
import styles from './payments.module.css';
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
	type TdsEntryItem
} from './queries';
import { useCommercialCreatorsQuery } from '../commercial/queries';
import { InvoicesTab } from './components/InvoicesTab';
import { UtrTab } from './components/UtrTab';
import { TdsTab } from './components/TdsTab';
import { PaymentModals } from './components/PaymentModals';
import { usePaymentsColumns } from './hooks/usePaymentsColumns';
import { Tabs } from '@/components/ui/Tabs';

type StatusFilter = 'all' | PaymentStatus;
type TabState = 'receivables' | 'payables' | 'utr' | 'tds';

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
	const { data: utrData, isLoading: utrLoading, refetch: refetchUtr } = usePaymentTransactionsQuery(utrPage, utrSearch, activeTab === 'utr');

	// TDS Tab state
	const [tdsStatusFilter, setTdsStatusFilter] = React.useState<'All' | 'Pending' | 'Remitted'>('All');
	const { data: tdsData = [], isLoading: tdsLoading, refetch: refetchTds } = useTdsEntriesQuery(
		undefined,
		tdsStatusFilter === 'All' ? undefined : tdsStatusFilter,
		activeTab === 'tds'
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

	const safeRows = React.useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
	const safeDocs = React.useMemo(() => (Array.isArray(docs) ? docs : []), [docs]);
	const safeCreatorInvoices = React.useMemo(() => (Array.isArray(creatorInvoices) ? creatorInvoices : []), [creatorInvoices]);

	const scoped = React.useMemo(() => safeRows.filter((r) => r.campaign_over === 'Y'), [safeRows]);
	const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

	const docsByDeal = React.useMemo(() => {
		const map = new Map<number, DealDocument[]>();
		for (const d of safeDocs) {
			const list = map.get(d.deal) ?? [];
			list.push(d);
			map.set(d.deal, list);
		}
		return map;
	}, [safeDocs]);

	const creatorInvoicesByDeal = React.useMemo(() => {
		const map = new Map<number, CreatorInvoice[]>();
		for (const invoice of safeCreatorInvoices) map.set(invoice.deal, [...(map.get(invoice.deal) ?? []), invoice]);
		return map;
	}, [safeCreatorInvoices]);

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
			result = result.filter(r => r.creator || (r.creator_shares && Array.isArray(r.creator_shares) && r.creator_shares.length > 0) || Number(r.creator_fee) > 0);
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

	const { columns, utrColumns, tdsColumns } = usePaymentsColumns({
		activeTab,
		docsByDeal,
		creatorInvoicesByDeal,
		statusOf,
		startUpload,
		setConfirmPaidDeal,
		setTdsRemitItem,
		setTdsRemitOpen
	});

	const existingDocs = uploadDeal ? (docsByDeal.get(uploadDeal.id) ?? []) : [];

	return (
		<>
			<section className={styles.workspace}>
				<div className={styles.header}>
					<div><h1>Payments</h1><p>Track client payments, talent payouts and your payment records.</p></div>
					<Tabs
						value={activeTab}
						onChange={(value) => setActiveTab(value as TabState)}
						items={[
							{ value: 'receivables', label: 'Receivables' },
							{ value: 'payables', label: 'Payables' },
							{ value: 'utr', label: 'UTR details' },
							{ value: 'tds', label: 'TDS dues' }
						]}
						className={styles.navigation}
					/>
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
