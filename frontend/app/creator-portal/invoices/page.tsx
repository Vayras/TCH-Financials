'use client';

import * as React from 'react';
import { useCreatorPortalInvoicesQuery, useCreatorPortalDealsQuery, useSubmitCreatorInvoiceMutation } from '../queries';
import { inr } from '@/lib/utils';
import Tag from '@/components/ui/Tag';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import PageHeader from '@/components/PageHeader';
import QueryErrorState from '@/components/QueryErrorState';
import { toast } from 'sonner';
import { downloadAuthenticatedFile } from '@/lib/download';

export default function CreatorInvoicesPage() {
	const { data: invoices = [], isLoading: invLoading, error: invError, refetch: refetchInvoices } = useCreatorPortalInvoicesQuery();
	const { data: deals = [], isLoading: dealsLoading } = useCreatorPortalDealsQuery();
	const submitInvoiceMutation = useSubmitCreatorInvoiceMutation();

	// Modal state
	const [open, setOpen] = React.useState(false);
	const [dealId, setDealId] = React.useState('');
	const [invNo, setInvNo] = React.useState('');
	const [invDate, setInvDate] = React.useState(new Date().toISOString().slice(0, 10));
	const [invAmt, setInvAmt] = React.useState('');
	const [file, setFile] = React.useState<File | null>(null);
	const [submitting, setSubmitting] = React.useState(false);

	const loading = invLoading || dealsLoading;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!dealId || !invNo || !invDate || !invAmt || !file) {
			toast.error('Please fill out all required fields and upload the invoice file.');
			return;
		}

		setSubmitting(true);
		try {
			await submitInvoiceMutation.mutateAsync({
				dealId,
				invoiceNumber: invNo,
				invoiceDate: invDate,
				invoiceAmount: Number(invAmt),
				file
			});
			toast.success('Invoice submitted successfully.');
			setOpen(false);
			setInvNo('');
			setInvAmt('');
			setFile(null);
			refetchInvoices();
		} catch (err: any) {
			toast.error('Failed to submit invoice.', { description: err.message });
		} finally {
			setSubmitting(false);
		}
	}

	const pendingDeals = React.useMemo(() => {
		// Filter deals where creator hasn't uploaded an invoice yet
		const invoiceDealIds = new Set(invoices.map((inv) => inv.deal));
		return deals.filter((deal) => !invoiceDealIds.has(deal.id));
	}, [deals, invoices]);

	if (loading) {
		return (
			<div className="flex items-center justify-center gap-3 py-16 text-gray-500">
				<svg className="animate-spin h-5 w-5" style={{ willChange: 'transform' }} viewBox="0 0 24 24" fill="none">
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
				</svg>
				<span className="text-[14px]">Loading invoices…</span>
			</div>
		);
	}

	if (invError) {
		return <QueryErrorState description="Unable to load invoices." onRetry={refetchInvoices} />;
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<PageHeader title="My Invoices" description="Submit and track your campaign billing invoices." />
				<Button variant="primary" onClick={() => setOpen(true)} disabled={pendingDeals.length === 0}>
					<span className="text-[13px]">Submit New Invoice</span>
				</Button>
			</div>

			{invoices.length === 0 ? (
				<div className="text-center py-20 rounded-xl bg-white" style={{ border: '1px solid var(--n-border)' }}>
					<div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 text-gray-400">
						<Icon name="file-text" size={20} />
					</div>
					<h3 className="text-[15px] font-bold text-gray-950 mb-1">No invoices yet</h3>
					<p className="text-[13px] text-gray-500 max-w-[280px] mx-auto">
						Your submitted invoices will appear here once you upload them.
					</p>
					<p className="text-[11.5px] text-gray-400 mt-3 max-w-[240px] mx-auto">
						Use the <strong className="font-semibold text-gray-500">Submit New Invoice</strong> button above to get started.
					</p>
				</div>
			) : (
				<div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
					<table className="w-full border-collapse text-[13px]">
						<thead>
							<tr className="border-b text-gray-400 bg-gray-50/50">
								<th className="px-4 py-3 text-left font-semibold">Invoice No</th>
								<th className="px-4 py-3 text-left font-semibold">Campaign</th>
								<th className="px-4 py-3 text-left font-semibold">Billing Date</th>
								<th className="px-4 py-3 text-right font-semibold">Amount</th>
								<th className="px-4 py-3 text-left font-semibold">Payment Status</th>
								<th className="px-4 py-3 text-left font-semibold">File</th>
							</tr>
						</thead>
						<tbody>
							{invoices.map((inv) => (
								<tr key={inv.id} className="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
									<td className="px-4 py-3.5 font-medium text-gray-800">{inv.invoice_number}</td>
									<td className="px-4 py-3.5 text-gray-600 font-medium">{inv.campaign_name || '—'}</td>
									<td className="px-4 py-3.5 text-gray-500 tabular-nums">{inv.invoice_date || '—'}</td>
									<td className="px-4 py-3.5 text-right font-bold text-gray-850 tabular-nums">₹{inr(Number(inv.invoice_amount))}</td>
									<td className="px-4 py-3.5">
										<Tag tone={inv.payment_status === 'Paid' ? 'yes' : inv.payment_status === 'Scheduled' ? 'neutral' : 'markup'}>
											{inv.payment_status || 'Pending'}
										</Tag>
									</td>
									<td className="px-4 py-3.5">
										{inv.file ? (
											<button type="button" onClick={() => void downloadAuthenticatedFile(inv.file, inv.label || 'creator-invoice')} className="font-medium hover:underline flex items-center gap-1" style={{ color: 'var(--n-accent)' }}>
												View Invoice ↗
											</button>
										) : '—'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Submit Invoice Dialog */}
			<Dialog
				open={open}
				onOpenChange={setOpen}
				title="Submit Creator Invoice"
				description="Upload invoice detailing your payout fee for completed deliverables."
				footer={
					<>
						<Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
						<Button variant="primary" disabled={submitting || !file} onClick={handleSubmit}>
							{submitting ? 'Submitting…' : 'Submit Invoice'}
						</Button>
					</>
				}
			>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Label>Select Active Campaign</Label>
						<select
							value={dealId}
							onChange={(e) => {
								const dId = e.target.value;
								setDealId(dId);
								const selectedDeal = pendingDeals.find((d) => String(d.id) === dId);
								if (selectedDeal) {
									setInvAmt(selectedDeal.creator_fee);
								}
							}}
							required
							className="w-full h-9 rounded px-3 text-[13px] bg-white border border-gray-300 focus:outline-none focus:ring-1" style={{ '--tw-ring-color': 'var(--n-accent)' } as React.CSSProperties}
						>
							<option value="">Choose Campaign</option>
							{pendingDeals.map((d) => (
								<option key={d.id} value={d.id}>
									{d.brand} · {d.campaign || 'Untitled Campaign'}
								</option>
							))}
						</select>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label>Invoice Number</Label>
							<input
								type="text"
								required
								value={invNo}
								onChange={(e) => setInvNo(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13px] bg-white border border-gray-300 focus:outline-none focus:ring-1" style={{ '--tw-ring-color': 'var(--n-accent)' } as React.CSSProperties}
								placeholder="INV-001"
							/>
						</div>
						<div>
							<Label>Invoice Date</Label>
							<input
								type="date"
								required
								value={invDate}
								onChange={(e) => setInvDate(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13px] bg-white border border-gray-300 focus:outline-none focus:ring-1" style={{ '--tw-ring-color': 'var(--n-accent)' } as React.CSSProperties}
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label>Invoice Amount (INR)</Label>
							<input
								type="number"
								required
								value={invAmt}
								onChange={(e) => setInvAmt(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13px] bg-white border border-gray-300 focus:outline-none focus:ring-1" style={{ '--tw-ring-color': 'var(--n-accent)' } as React.CSSProperties}
								placeholder="0.00"
							/>
						</div>
						<div>
							<Label>Upload PDF / Image File</Label>
							<input
								type="file"
								required
								accept="application/pdf,image/*"
								onChange={(e) => setFile(e.target.files?.[0] ?? null)}
								className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-gray-200 file:bg-gray-50 file:px-3 file:py-1 file:text-[13px] file:text-gray-700 hover:file:border-gray-300"
							/>
						</div>
					</div>
				</form>
			</Dialog>
		</div>
	);
}
