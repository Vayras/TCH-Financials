'use client';

import * as React from 'react';
import type { Deal } from '@/lib/api';
import { creatorNamesOf } from '@/lib/deals';
import { inr } from '@/lib/utils';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';

// One label/value pair in the read-only campaign detail modal.
function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
	const display = value === '' || value === null || value === undefined ? '—' : value;
	return (
		<div>
			<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>{label}</div>
			<div className="text-[14px] mt-0.5 break-words" style={{ color: 'var(--n-fg)' }}>{display}</div>
		</div>
	);
}

// Y/N status flag as a tick: green check for yes, muted cross for no.
function StatusTick({ flag }: { flag: string }) {
	if (flag === 'Y') return <Icon name="check" size={16} className="text-[#15803d]" />;
	if (flag === 'N') return <Icon name="x" size={16} className="text-[var(--n-fg-subtle)]" />;
	return <>—</>;
}

function DetailSection({ title }: { title: string }) {
	return (
		<div className="col-span-full border-t pt-3 mt-1" style={{ borderColor: 'var(--n-border)' }}>
			<div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}>{title}</div>
		</div>
	);
}

export interface CampaignDetailModalProps {
	deal: Deal | null;
	onClose: () => void;
	onEdit: (d: Deal) => void;
	onDelete: (d: Deal) => void;
}

export function CampaignDetailModal({ deal, onClose, onEdit, onDelete }: CampaignDetailModalProps) {
	return (
		<Dialog
			open={deal !== null}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={deal ? `${deal.brand || 'Campaign'}${deal.campaign ? ` · ${deal.campaign}` : ''}` : 'Campaign'}
			className="max-w-4xl"
			footer={
				<>
					<Button
						variant="danger"
						className="mr-auto"
						onClick={() => {
							if (deal) {
								onClose();
								onDelete(deal);
							}
						}}
					>
						Delete
					</Button>
					<Button variant="outline" onClick={onClose}>Close</Button>
					<Button
						variant="primary"
						onClick={() => {
							if (deal) {
								onClose();
								onEdit(deal);
							}
						}}
					>
						Edit
					</Button>
				</>
			}
		>
			{deal && (
				<div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
					<DetailField label="Brand" value={deal.brand} />
					<DetailField label="POC Email" value={deal.brand_poc} />
					<DetailField label="Direction" value={deal.direction} />
					<DetailField label="Creators" value={creatorNamesOf(deal).join(', ') || '—'} />
					<DetailField label="TCH POC" value={deal.tch_poc} />
					<DetailField label="Total Fee" value={inr(deal.total_fee) ? `₹ ${inr(deal.total_fee)}` : '—'} />
					<DetailField label="Agency Fee" value={inr(deal.agency_fee_inr) ? `₹ ${inr(deal.agency_fee_inr)}` : '—'} />
					<DetailField label="Creator Fee" value={inr(deal.creator_fee) ? `₹ ${inr(deal.creator_fee)}` : '—'} />
					<DetailField label="Confirmation Date" value={deal.confirmation_date} />
					<DetailField label="Invoice Date" value={deal.e_invoice_date} />
					<DetailField label="E-Invoice #" value={deal.e_invoice_number} />
					<DetailField label="Campaign" value={deal.campaign} />
					<DetailField label="Campaign Status" value={deal.campaign_status} />
					<DetailField label="Deliverables" value={deal.deliverables} />
					<DetailField label="RO #" value={deal.ro_number} />

					{deal.creator_shares && deal.creator_shares.length > 1 && (
						<>
							<DetailSection title="Creator split" />
							{deal.creator_shares.map((s, i) => (
								<DetailField key={s.id ?? i} label={s.creator_name || s.creator_name_raw || `Creator ${i + 1}`} value={`Fee ₹ ${inr(s.total_fee)} · Agency ₹ ${inr(s.agency_fee_inr)}`} />
							))}
						</>
					)}

					<DetailSection title="Status" />
					<DetailField label="Campaign Over" value={<StatusTick flag={deal.campaign_over} />} />
					<DetailField label="Payment Cleared" value={<StatusTick flag={deal.payment_cleared} />} />

					{deal.comments && (
						<>
							<DetailSection title="Comments" />
							<div className="col-span-full text-[14px]" style={{ color: 'var(--n-fg)' }}>{deal.comments}</div>
						</>
					)}
				</div>
			)}
		</Dialog>
	);
}

export default CampaignDetailModal;
