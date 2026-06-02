const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
		...init
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`${res.status} ${res.statusText}: ${text}`);
	}
	if (res.status === 204) return undefined as T;
	return res.json();
}

export const api = {
	get: <T,>(path: string) => req<T>(path),
	post: <T,>(path: string, body: unknown) =>
		req<T>(path, { method: 'POST', body: JSON.stringify(body) }),
	patch: <T,>(path: string, body: unknown) =>
		req<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
	put: <T,>(path: string, body: unknown) =>
		req<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
	del: (path: string) => req<void>(path, { method: 'DELETE' }),
	// Multipart upload — the browser sets the Content-Type (with boundary),
	// so we must not send our JSON header here.
	upload: async <T,>(path: string, form: FormData): Promise<T> => {
		const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form });
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`${res.status} ${res.statusText}: ${text}`);
		}
		return res.json() as Promise<T>;
	}
};

export type Creator = {
	id: number;
	name: string;
	category: string;
	source: string;
	stage: string;
	relationship: 'Exclusive' | 'Friend' | 'Dropping' | 'NonTCH';
	status: 'Active' | 'Inactive';
	doj: string | null;
	doj_note: string;
	profile_url: string;
	location: string;
	ops_manager: string;
	notes: string;
};

export type DropOff = {
	id: number;
	creator: number | null;
	creator_name: string;
	creator_name_raw: string;
	drop_off_date: string | null;
	drop_off_date_note: string;
	reason: string;
	learning: string;
	duration: string;
};

export type Contracting = {
	id: number;
	creator: number;
	creator_name: string;
	final_meeting: string;
	agreement_sent: string;
	agreement_signed: string;
	bank_verified: string;
	time_to_sign: string;
	renewal_date: string | null;
	renewal_note: string;
};

export type CreatorShare = {
	id?: number;
	creator: number | null;
	creator_name?: string;
	creator_relationship?: string;
	creator_name_raw: string;
	total_fee: string;
	agency_fee_pct: string;
	agency_fee_inr: string;
	creator_fee: string;
};

export type Deal = {
	id: number;
	confirmation_date: string | null;
	e_invoice_date: string | null;
	creator: number | null;
	creator_name: string;
	creator_name_raw: string;
	creator_relationship: string;
	tch_poc: string;
	agency_commission_agreed: string;
	direction: 'Inbound' | 'Outbound' | 'MarkUp';
	total_fee: string;
	agency_fee_pct: string;
	agency_fee_inr: string;
	creator_fee: string;
	billing_entity: string;
	brand: string;
	brand_poc: string;
	campaign: string;
	deliverables: string;
	ro_number: string;
	campaign_over: string;
	invoice_received: string;
	payment_cleared: string;
	e_invoice_number: string;
	payment_received: string;
	comments: string;
	creator_shares: CreatorShare[];
};

export type CreatorDocument = {
	id: number;
	creator: number;
	creator_name: string;
	doc_type: string;
	label: string;
	file: string;
	uploaded_at: string;
};

export type EmployeeReport = {
	id: number;
	week_ending: string | null;
	employee_name: string;
	new_outreach: number;
	paid_confirmations: string;
	revenue_locked: string;
	profit_locked: string;
	barter_confirmations: string;
	live_campaigns: number;
	action_points: string;
};

export type Overview = {
	fy: string;
	fy_start: number;
	months: { key: string; label: string }[];
	quarters: { key: string; label: string }[];
	bucket_order: string[];
	rows: Record<
		string,
		{ label: string; by_month: Record<string, string>; by_quarter: Record<string, string>; total: string }
	>;
	totals: { by_month: Record<string, string>; by_quarter: Record<string, string>; total: string };
	emw_billing: { by_month: Record<string, string>; by_quarter: Record<string, string>; total: string };
	profits: { by_month: Record<string, string>; by_quarter: Record<string, string>; total: string };
	emw_pct: { by_month: Record<string, string>; by_quarter: Record<string, string>; total: string };
	profit_pct: { by_month: Record<string, string>; by_quarter: Record<string, string>; total: string };
	not_invoiced: { count: number; total_fee: string; profit: string };
};

export type QuarterlyExclusive = {
	creator_id: number;
	creator_name: string;
	quarter: string;
	inbound_count: number;
	inbound_amount: string;
	inbound_creator_fee: string;
	inbound_tch_profit: string;
	outbound_count: number;
	outbound_amount: string;
	outbound_creator_fee: string;
	outbound_tch_profit: string;
	top_brands: string[];
	repeat_brands: string[];
	common_deliverable: string;
};

export type EntityRow = {
	entity: string;
	deal_count: number;
	total_billing: string;
	total_profit: string;
	creator_count: number;
	creators: string[];
	top_brands: string[];
};

export type EntitySummary = {
	fy: string;
	fy_start: number;
	entity_filter: string;
	entities: EntityRow[];
	grand_total_billing: string;
	grand_total_profit: string;
};

export type CreatorInsight = {
	creator_id: number | null;
	creator_name: string;
	relationship: 'Exclusive' | 'Friend' | 'Dropping' | 'NonTCH';
	category: string;
	ops_manager: string;
	total_count: number;
	inbound_count: number;
	outbound_count: number;
	markup_count: number;
	total_billing: string;
	total_profit: string;
	total_creator_fee: string;
	avg_deal_size: string;
	profit_margin: string;
	first_date: string | null;
	last_date: string | null;
	months_active: number;
	brand_count: number;
	top_brands: string[];
	repeat_brands: string[];
	common_deliverable: string;
	top_billing_entity: string;
	paid_count: number;
	over_count: number;
	by_month: Record<string, string>;
};

export type CreatorInsights = {
	fy: string;
	fy_start: number;
	months: { key: string; label: string }[];
	creators: CreatorInsight[];
	grand_total_billing: string;
	grand_total_profit: string;
	grand_total_deals: number;
	creator_count: number;
};

export type AlertSeverity = 'high' | 'med' | 'low';

export type AlertItem = {
	kind: string;
	severity: AlertSeverity;
	title: string;
	detail: string;
	action: string;
	meta: Record<string, string | number | boolean | null>;
};

export type AlertsPayload = {
	generated_at: string;
	thresholds: {
		inactive_creator_days: number;
		invoice_overdue_days: number;
		payment_overdue_days: number;
		brand_dormant_days: number;
		brand_hot_window_days: number;
		renewal_due_days: number;
		qoq_drop_pct: number;
	};
	urgent: AlertItem[];
	bd: AlertItem[];
	health: AlertItem[];
	docs: AlertItem[];
	seasonal: AlertItem[];
	counts: { urgent: number; bd: number; health: number; docs: number; seasonal: number };
};
