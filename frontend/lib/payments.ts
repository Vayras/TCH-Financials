import { api, type Deal, type DealDocument, type CreatorInvoice } from '@/lib/api';

// Creator payment cycles map to a number of days added to the base invoice
// date before the Wednesday payment-run rule is applied.
export const CYCLE_DAYS: Record<'' | 'Immediate' | 'Net15' | 'Net30' | 'Net45' | 'Net60', number> = {
	'': 0,
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

// The next Wednesday on or after the given ISO date (Wednesday = UTC day 3).
// TCH runs its creator payment cycle every Wednesday.
export function nextWednesdayOnOrAfter(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	const day = dt.getUTCDay();
	const delta = (3 - day + 7) % 7;
	dt.setUTCDate(dt.getUTCDate() + delta);
	return dt.toISOString().slice(0, 10);
}

// Base date for the payment cycle is the creator invoice date, falling back to
// the date the deal was marked completed. No base date means we can't compute
// a due date yet.
export function paymentDueDate(deal: Deal): string | '' {
	const base = deal.creator_invoice_date || deal.completed_at;
	if (!base) return '';
	const cycleDays = CYCLE_DAYS[deal.creator_payment_cycle] ?? 0;
	return nextWednesdayOnOrAfter(addDaysISO(base, cycleDays));
}

export type PaymentStatus = 'awaiting_invoices' | 'overdue' | 'due' | 'upcoming' | 'cleared';

export function paymentStatusOf(
	deal: Deal,
	docsForDeal: DealDocument[],
	todayISO: string,
	creatorInvoicesForDeal: CreatorInvoice[] = []
): PaymentStatus {
	const cleared = deal.payment_cleared === 'Y' || deal.creator_payment_status === 'Paid';
	const hasClientDoc = docsForDeal.some((d) => d.doc_type === 'ClientInvoice');
	const assignedCreatorIds = deal.creator_shares?.length
		? deal.creator_shares.flatMap((share) => share.creator ? [share.creator] : [])
		: deal.creator ? [deal.creator] : [];
	const structuredCreatorIds = new Set(creatorInvoicesForDeal.map((invoice) => invoice.creator));
	const hasCreatorDoc = assignedCreatorIds.length === 0 || assignedCreatorIds.every((id) => structuredCreatorIds.has(id));
	const invoicesIn = deal.invoice_received === 'Y' || (hasClientDoc && hasCreatorDoc);

	if (cleared) return 'cleared';
	if (!invoicesIn) return 'awaiting_invoices';

	// No invoice/completion date on legacy deals: mirror the backend and treat
	// today as the cycle base, putting them in the upcoming Wednesday run.
	const due = paymentDueDate(deal) || nextWednesdayOnOrAfter(todayISO);
	if (due < todayISO) return 'overdue';
	if (due <= nextWednesdayOnOrAfter(todayISO)) return 'due';
	return 'upcoming';
}

export const STATUS_LABEL: Record<PaymentStatus, string> = {
	awaiting_invoices: 'Awaiting Invoices',
	overdue: 'Overdue',
	due: 'Due This Wednesday',
	upcoming: 'Upcoming',
	cleared: 'Cleared'
};

export const STATUS_TONE: Record<
	PaymentStatus,
	'yes' | 'no' | 'markup' | 'neutral' | 'dropping'
> = {
	cleared: 'yes',
	overdue: 'no',
	due: 'markup',
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
