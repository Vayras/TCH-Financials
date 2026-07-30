import { api, type Deal, type DealDocument, type CreatorInvoice } from '@/lib/api';

// Creator payment cycles map to a number of days added to the base invoice
// date before the Wednesday payment-run rule is applied.
export const CYCLE_DAYS: Record<'' | 'Immediate' | 'Net15' | 'Net30' | 'Net45' | 'Net60', number> = {
	'': 30, // Default to a 30 day cycle
	Immediate: 0,
	Net15: 15,
	Net30: 30,
	Net45: 45,
	Net60: 60
};

// Add `days` to an ISO (yyyy-mm-dd) date, UTC-safe (no local-timezone drift).
export function addDaysISO(iso: string, days: number): string {
	const [y, m, d] = iso.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	dt.setUTCDate(dt.getUTCDate() + days);
	return dt.toISOString().slice(0, 10);
}



// CLIENT LOGIC
export type PaymentStatus = 'awaiting_invoices' | 'overdue' | 'due_soon' | 'upcoming' | 'cleared';

export function clientPaymentDueDate(deal: Deal): string | '' {
	const base = deal.client_invoice_date || deal.completed_at;
	if (!base) return '';
	const cycleDays = 30; // 30 is default for client
	return addDaysISO(base, cycleDays);
}

export function clientPaymentStatusOf(
	deal: Deal,
	docsForDeal: DealDocument[],
	todayISO: string
): PaymentStatus {
	const cleared = deal.payment_cleared === 'Y';
	const hasClientDoc = docsForDeal.some((d) => d.doc_type === 'ClientInvoice');

	if (cleared) return 'cleared';
	if (!hasClientDoc && deal.invoice_received !== 'Y') return 'awaiting_invoices';

	const due = clientPaymentDueDate(deal) || addDaysISO(todayISO, 30);
	if (due < todayISO) return 'overdue';
	if (due <= addDaysISO(todayISO, 7)) return 'due_soon';
	return 'upcoming';
}

// CREATOR LOGIC
export function creatorPaymentDueDate(deal: Deal): string | '' {
	const base = deal.creator_invoice_date || deal.completed_at;
	if (!base) return '';
	const cycleDays = CYCLE_DAYS[deal.creator_payment_cycle] ?? 30;
	return addDaysISO(base, cycleDays);
}

export function creatorPaymentStatusOf(
	deal: Deal,
	docsForDeal: DealDocument[],
	todayISO: string,
	creatorInvoicesForDeal: CreatorInvoice[] = []
): PaymentStatus {
	const cleared = deal.creator_payment_status === 'Paid';
	
	const assignedCreatorIds = deal.creator_shares?.length
		? deal.creator_shares.flatMap((share) => share.creator ? [share.creator] : [])
		: deal.creator ? [deal.creator] : [];
	const structuredCreatorIds = new Set(creatorInvoicesForDeal.map((invoice) => invoice.creator));
	const hasCreatorDoc = assignedCreatorIds.length === 0 || assignedCreatorIds.every((id) => structuredCreatorIds.has(id));

	if (cleared) return 'cleared';
	if (!hasCreatorDoc && deal.invoice_received !== 'Y') return 'awaiting_invoices';

	const due = creatorPaymentDueDate(deal) || addDaysISO(todayISO, 30);
	if (due < todayISO) return 'overdue';
	if (due <= addDaysISO(todayISO, 7)) return 'due_soon';
	return 'upcoming';
}

export const STATUS_LABEL: Record<PaymentStatus, string> = {
	awaiting_invoices: 'Awaiting Invoices',
	overdue: 'Overdue',
	due_soon: 'Due Soon',
	upcoming: 'Upcoming',
	cleared: 'Cleared'
};

export const STATUS_TONE: Record<
	PaymentStatus,
	'yes' | 'no' | 'markup' | 'neutral' | 'dropping'
> = {
	cleared: 'yes',
	overdue: 'no',
	due_soon: 'markup',
	upcoming: 'neutral',
	awaiting_invoices: 'dropping'
};

export async function uploadDealInvoice(
	dealId: number,
	docType: 'ClientInvoice' | 'CreatorInvoice',
	file: File
): Promise<DealDocument> {
	const fd = new FormData();
	fd.append('file', file);
	fd.append('deal', String(dealId));
	fd.append('doc_type', docType);
	fd.append('label', `${docType === 'ClientInvoice' ? 'Client' : 'Creator'} Invoice — ${file.name}`);
	return api.upload<DealDocument>('/deal-documents/', fd);
}
