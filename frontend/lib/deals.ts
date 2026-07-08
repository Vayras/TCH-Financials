import type { Deal } from '@/lib/api';
import type { DealForm, ShareForm } from '@/types/deal';

export const DIRECTION = [
	{ value: 'Inbound', label: 'Inbound' },
	{ value: 'Outbound', label: 'Outbound' }
];

export const EMPTY_DEAL_FORM: DealForm = {
	confirmation_date: '',
	e_invoice_number: '',
	e_invoice_date: '',
	creator: '',
	tch_poc: '',
	direction: 'Outbound',
	total_fee: '',
	agency_fee_pct: '',
	agency_fee_inr: '',
	creator_fee: '',
	billing_entity: '',
	brand: '',
	brand_poc: '',
	campaign: '',
	deliverables: '',
	ro_number: '',
	comments: ''
};

export const EMPTY_SHARE: ShareForm = {
	creator: '',
	total_fee: '',
	agency_fee_inr: ''
};

// Build a CreatorShare payload row, deriving % and creator fee from totals.
export function buildShare(creator: string, total: string, inr: string) {
	const t = Number(total) || 0;
	const a = Number(inr) || 0;
	return {
		creator: creator ? Number(creator) : null,
		creator_name_raw: '',
		total_fee: total || '0',
		agency_fee_inr: inr || '0',
		agency_fee_pct: t > 0 ? (a / t).toFixed(4) : '0',
		creator_fee: (t - a).toFixed(2)
	};
}

export function relTone(rel?: string) {
	if (rel === 'Exclusive') return 'exclusive' as const;
	if (rel === 'Dropping') return 'dropping' as const;
	if (rel === 'NonTCH') return 'nontch' as const;
	return 'friend' as const;
}

export function dirTone(dir: string) {
	if (dir === 'Inbound') return 'inbound' as const;
	if (dir === 'Outbound') return 'outbound' as const;
	return 'markup' as const;
}

export function normalisePctValue(p: string): number {
	const n = Number(p);
	if (!Number.isFinite(n) || n <= 0) return 0;
	// Historical/prod rows sometimes stored "15" for 15% instead of "0.15".
	return n > 1 ? n / 100 : n;
}

export function normalisePctString(p: string): string {
	const n = normalisePctValue(p);
	return n > 0 ? n.toFixed(4) : '0';
}

// Indian fiscal year runs Apr → Mar. These mirror the backend aggregation so
// client-side period filtering lines up with Current Overview / Entity Summary.
export function fyStartOf(iso: string): number {
	const [y, m] = iso.split('-').map(Number);
	return m >= 4 ? y : y - 1;
}

export const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthYearLabel(iso?: string | null): string {
	if (!iso) return 'No date';
	const [y, m] = iso.split('-');
	return `${MONTH_NAMES[Number(m)] ?? m} ${y}`;
}

export const FY_MONTH_ORDER = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];

// Calendar year a fiscal-month belongs to: Apr–Dec sit in fyStart, Jan–Mar roll
// into fyStart + 1.
export function calYearOfMonth(mm: string, fyStart: number): number {
	return Number(mm) >= 4 ? fyStart : fyStart + 1;
}

// Mirrors backend billing_period (tch/aggregation.py): the E-Invoice No (e.g.
// "TCH/2627/Apr06") is authoritative for the billing month — it wins when it
// disagrees with e_invoice_date — with e_invoice_date as the fallback when the
// number is blank or unparseable. Keeping the two in lockstep is what makes
// this page's headline match the Overview's "Campaigns this FY".
const INVOICE_NO_RE = /(\d{2})(\d{2})\s*\/\s*([A-Za-z]{3,9})/;
const MONTH_NUM: Record<string, number> = {
	jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
	jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};
export function billingPeriodOf(r: Deal): string | null {
	const m = INVOICE_NO_RE.exec((r.e_invoice_number || '').replace(/\s+/g, ' '));
	if (m) {
		const fy = 2000 + Number(m[1]);
		const month = MONTH_NUM[m[3].slice(0, 3).toLowerCase()];
		if (month) {
			const year = month >= 4 ? fy : fy + 1;
			return `${year}-${String(month).padStart(2, '0')}-01`;
		}
	}
	return r.e_invoice_date || null;
}

// The full set of creator display names on a deal (primary + any split rows).
export function creatorNamesOf(r: Deal): string[] {
	if (r.creator_shares && r.creator_shares.length > 0) {
		return r.creator_shares
			.map((s) => s.creator_name || s.creator_name_raw)
			.filter(Boolean);
	}
	const single = r.creator_name || r.creator_name_raw;
	return single ? [single] : [];
}

// Compact creator label for cards: all names if ≤2, else "First +N more".
export function creatorLabel(names: string[]): string {
	if (names.length === 0) return '—';
	if (names.length <= 2) return names.join(', ');
	return `${names[0]} +${names.length - 1} more`;
}
