import React from 'react';
import Link from 'next/link';
import { type Deal, type DealDocument } from '@/lib/api';
import { creatorLabel, creatorNamesOf } from '@/lib/deals';
import { inr } from '@/lib/utils';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';
import Tag from '@/components/ui/Tag';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { type TdsEntryItem } from '../queries';
import { downloadAuthenticatedFile } from '@/lib/download';

interface PaymentModalsProps {
	// Client Invoice Upload Modal
	uploadOpen: boolean;
	setUploadOpen: (open: boolean) => void;
	closeUpload: () => void;
	uploadDeal: Deal | null;
	clientFile: File | null;
	setClientFile: (f: File | null) => void;
	saving: boolean;
	saveUpload: () => void;
	existingDocs: DealDocument[];

	// Excel Import Modal
	importOpen: boolean;
	setImportOpen: (open: boolean) => void;
	excelFile: File | null;
	setExcelFile: (f: File | null) => void;
	importing: boolean;
	submitImport: (e: React.FormEvent) => void;

	// Manual Transaction Modal
	manualOpen: boolean;
	setManualOpen: (open: boolean) => void;
	isAddingTransaction: boolean;
	submitManualTransaction: (e: React.FormEvent) => void;
	txDate: string; setTxDate: (v: string) => void;
	txType: 'debit' | 'credit'; setTxType: (v: 'debit' | 'credit') => void;
	txVendor: string; setTxVendor: (v: string) => void;
	txUtr: string; setTxUtr: (v: string) => void;
	txAmount: string; setTxAmount: (v: string) => void;
	txNotes: string; setTxNotes: (v: string) => void;

	// Manual TDS Entry Modal
	tdsOpen: boolean;
	setTdsOpen: (open: boolean) => void;
	isAddingTds: boolean;
	submitTdsEntry: (e: React.FormEvent) => void;
	creators: { id: number; name: string }[];
	tdsCreatorId: string; setTdsCreatorId: (v: string) => void;
	tdsQuarter: string; setTdsQuarter: (v: string) => void;
	tdsRate: string; setTdsRate: (v: string) => void;
	tdsGross: string; setTdsGross: (v: string) => void;
	tdsNotes: string; setTdsNotes: (v: string) => void;

	// Record TDS Remittance Modal
	tdsRemitOpen: boolean;
	setTdsRemitOpen: (open: boolean) => void;
	tdsRemitItem: TdsEntryItem | null;
	isUpdatingRemittance: boolean;
	submitTdsRemit: (e: React.FormEvent) => void;
	tdsRemitDate: string; setTdsRemitDate: (v: string) => void;
	tdsChallan: string; setTdsChallan: (v: string) => void;

	// Confirm Paid Modal
	confirmPaidDeal: Deal | null;
	setConfirmPaidDeal: (d: Deal | null) => void;
	activeTab: 'receivables' | 'payables' | 'utr' | 'tds';
	markClientPaidPending: boolean;
	markCreatorPaidPending: boolean;
	markPaid: (d: Deal) => void;
}

export function PaymentModals({
	uploadOpen, setUploadOpen, closeUpload, uploadDeal, clientFile, setClientFile, saving, saveUpload, existingDocs,
	importOpen, setImportOpen, excelFile, setExcelFile, importing, submitImport,
	manualOpen, setManualOpen, isAddingTransaction, submitManualTransaction, txDate, setTxDate, txType, setTxType, txVendor, setTxVendor, txUtr, setTxUtr, txAmount, setTxAmount, txNotes, setTxNotes,
	tdsOpen, setTdsOpen, isAddingTds, submitTdsEntry, creators, tdsCreatorId, setTdsCreatorId, tdsQuarter, setTdsQuarter, tdsRate, setTdsRate, tdsGross, setTdsGross, tdsNotes, setTdsNotes,
	tdsRemitOpen, setTdsRemitOpen, tdsRemitItem, isUpdatingRemittance, submitTdsRemit, tdsRemitDate, setTdsRemitDate, tdsChallan, setTdsChallan,
	confirmPaidDeal, setConfirmPaidDeal, activeTab, markClientPaidPending, markCreatorPaidPending, markPaid
}: PaymentModalsProps) {
	
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
									className="block w-full text-[12px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[12px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
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
													className="inline-link text-[12px]"
													onClick={() => void downloadAuthenticatedFile(d.file, d.label || 'deal-document')}
												>
													{d.label || d.file.split('/').pop()} ↗
												</button>
											) : (
												<span className="text-[12px]" style={{ color: 'var(--n-fg-muted)' }}>
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
							className="block w-full text-[12px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[12px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
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
							disabled={isAddingTransaction}
							onClick={submitManualTransaction}
						>
							{isAddingTransaction ? 'Saving…' : 'Add Transaction'}
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
								className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
							/>
						</div>
						<div>
							<Label>Transaction Type</Label>
							<select
								value={txType}
								onChange={(e) => setTxType(e.target.value as 'debit' | 'credit')}
								className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
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
							className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
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
								className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
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
								className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
								placeholder="0.00"
							/>
						</div>
					</div>

					<div>
						<Label>Notes / Comments</Label>
						<textarea
							value={txNotes}
							onChange={(e) => setTxNotes(e.target.value)}
							className="w-full h-16 rounded p-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
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
							disabled={isAddingTds}
							onClick={submitTdsEntry}
						>
							{isAddingTds ? 'Saving…' : 'Record TDS'}
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
								className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
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
								className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
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
								className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
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
								className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
								placeholder="0.00"
							/>
						</div>
					</div>

					<div>
						<Label>Notes / Comments</Label>
						<textarea
							value={tdsNotes}
							onChange={(e) => setTdsNotes(e.target.value)}
							className="w-full h-16 rounded p-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
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
							disabled={isUpdatingRemittance}
							onClick={submitTdsRemit}
						>
							{isUpdatingRemittance ? 'Saving…' : 'Record Remittance'}
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
									className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
								/>
							</div>
							<div>
								<Label>Challan Number / ITNS 281</Label>
								<input
									type="text"
									required
									value={tdsChallan}
									onChange={(e) => setTdsChallan(e.target.value)}
									className="w-full h-9 rounded px-3 text-[12px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none"
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
				pending={activeTab === 'receivables' ? markClientPaidPending : markCreatorPaidPending} 
				onConfirm={() => { if (confirmPaidDeal) return markPaid(confirmPaidDeal); }} 
			/>
		</>
	);
}
