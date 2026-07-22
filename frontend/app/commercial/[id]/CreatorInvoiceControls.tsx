'use client';

import * as React from 'react';
import type { CreatorInvoice, DealDocument } from '@/lib/api';
import { formatDocDate } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import {
	useCreatorInvoicesQuery,
	useDeleteCreatorInvoiceMutation,
	useSaveCreatorInvoiceMutation
} from '../queries';

export function InvoiceReadinessSummary({ dealId, creatorCount, documents }: { dealId: number; creatorCount: number; documents: DealDocument[] }) {
	const { data: invoices = [], isLoading, isError } = useCreatorInvoicesQuery(dealId);
	const clientReceived = documents.some((document) => document.doc_type === 'ClientInvoice');
	return (
		<div className="flex flex-wrap items-center gap-2 text-[12px]">
			<Tag tone={clientReceived ? 'yes' : 'neutral'}>Client {clientReceived ? 'received' : 'missing'}</Tag>
			<Tag tone={invoices.length >= creatorCount ? 'yes' : 'neutral'}>
				Creator invoices {isLoading ? '…' : `${invoices.length}/${creatorCount}`}
			</Tag>
			{isError && <span className="text-amber-700">Status temporarily unavailable</span>}
		</div>
	);
}

export default function CreatorInvoiceControls({ dealId, creatorId, pendingAssignment = false }: { dealId: number; creatorId: number | null; pendingAssignment?: boolean }) {
	const { data: invoices = [], isLoading, isError } = useCreatorInvoicesQuery(dealId);
	const saveMutation = useSaveCreatorInvoiceMutation();
	const deleteMutation = useDeleteCreatorInvoiceMutation();
	const [message, setMessage] = React.useState<string | null>(null);
	const [pendingReplacement, setPendingReplacement] = React.useState<File | null>(null);
	const [removeOpen, setRemoveOpen] = React.useState(false);
	const invoice = invoices.find((item) => item.creator === creatorId);
	const busy = saveMutation.isPending || deleteMutation.isPending;

	async function upload(file?: File) {
		if (!file || !creatorId) return;
		setMessage(null);
		try {
			await saveMutation.mutateAsync({ dealId, creatorId, file, existing: invoice });
			toast.success(invoice ? 'Creator invoice replaced.' : 'Creator invoice uploaded.');
			setPendingReplacement(null);
		} catch {
			setMessage('Upload failed. Check the file and try again.');
		}
	}

	async function remove(current: CreatorInvoice) {
		setMessage(null);
		try {
			await deleteMutation.mutateAsync(current);
			setRemoveOpen(false);
			toast.success('Creator invoice removed.');
		} catch {
			setMessage('Could not remove the invoice. Refresh and try again.');
		}
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'var(--n-border)' }}>
			<div>
				<div className="flex items-center gap-2 text-[12px] font-medium">
					Creator invoice
					<Tag tone={invoice ? 'yes' : 'neutral'}>{isLoading ? 'Loading…' : invoice ? 'Received' : 'Required'}</Tag>
				</div>
				{invoice && <p className="mt-1 text-[11px]" style={{ color: 'var(--n-fg-subtle)' }}>Uploaded {formatDocDate(invoice.uploaded_at)}</p>}
				{pendingAssignment && <p className="mt-1 text-[11px] text-amber-700">Save this creator assignment before uploading an invoice.</p>}
				{isError && <p className="mt-1 text-[11px] text-amber-700">Status temporarily unavailable</p>}
				{message && <p className="mt-1 text-[11px] text-red-700">{message}</p>}
			</div>
			<div className="flex items-center gap-2">
				{invoice?.file && <a href={invoice.file} target="_blank" rel="noopener"><Button type="button" variant="outline"><Icon name="external-link" size={12} className="mr-1" />View</Button></a>}
				<label className={`inline-flex h-9 cursor-pointer items-center rounded-md px-3 text-[12px] font-medium text-white ${busy || !creatorId || pendingAssignment ? 'pointer-events-none opacity-50' : ''}`} style={{ background: 'var(--n-accent)' }}>
					{busy ? 'Working…' : invoice ? 'Replace' : 'Upload'}
					<input className="sr-only" type="file" accept="application/pdf,image/*" disabled={busy || !creatorId || pendingAssignment} onChange={(event) => {
						const file = event.target.files?.[0];
						if (invoice && file) setPendingReplacement(file);
						else void upload(file);
						event.currentTarget.value = '';
					}} />
				</label>
				{invoice && <Button type="button" variant="outline" disabled={busy} onClick={() => setRemoveOpen(true)}>Remove</Button>}
			</div>
			<ConfirmDialog
				open={!!pendingReplacement}
				onOpenChange={(open) => { if (!open) setPendingReplacement(null); }}
				title="Replace creator invoice?"
				description="The currently uploaded invoice will be replaced with the selected file."
				confirmLabel="Replace invoice"
				pending={saveMutation.isPending}
				onConfirm={() => upload(pendingReplacement ?? undefined)}
			/>
			<ConfirmDialog
				open={removeOpen}
				onOpenChange={setRemoveOpen}
				title="Remove creator invoice?"
				description="The campaign will return to awaiting invoices until another invoice is uploaded."
				confirmLabel="Remove invoice"
				confirmVariant="danger"
				pending={deleteMutation.isPending}
				onConfirm={() => invoice && remove(invoice)}
			/>
		</div>
	);
}
