'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Collapse from '@mui/material/Collapse';
import MuiDialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MuiButton from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { api, ConflictError, type Deal, type Creator, type Campaign } from '@/lib/api';
import { inr } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import { useFiscalYear } from '@/lib/fiscal-year';

const DIRECTION = [
	{ value: 'Inbound', label: 'Inbound' },
	{ value: 'Outbound', label: 'Outbound' },
	{ value: 'MarkUp', label: 'Mark Up' }
];
const YN = [
	{ value: 'Y', label: 'Yes' },
	{ value: 'N', label: 'No' }
];

const CLIENT_PAY_STATUS = [
	{ value: 'Pending', label: 'Pending' },
	{ value: 'Partial', label: 'Partial' },
	{ value: 'Received', label: 'Received' },
	{ value: 'Overdue', label: 'Overdue' }
];
const CREATOR_PAY_STATUS = [
	{ value: 'Pending', label: 'Pending' },
	{ value: 'Scheduled', label: 'Scheduled' },
	{ value: 'Paid', label: 'Paid' },
	{ value: 'Overdue', label: 'Overdue' }
];
const PAY_CYCLES = [
	{ value: 'Immediate', label: 'Immediate' },
	{ value: 'Net15', label: 'Net 15' },
	{ value: 'Net30', label: 'Net 30' },
	{ value: 'Net45', label: 'Net 45' },
	{ value: 'Net60', label: 'Net 60' }
];

type ColumnKey =
	| 'direction'
	| 'total_fee'
	| 'agency_fee_pct'
	| 'agency_fee_inr'
	| 'creator_fee'
	| 'billing_entity'
	| 'brand'
	| 'campaign'
	| 'deliverables'
	| 'ro_number'
	| 'client_invoice_number'
	| 'client_invoice_date'
	| 'client_invoice_amount'
	| 'client_payment_status'
	| 'client_payment_received_amount'
	| 'client_payment_date'
	| 'creator_invoice_number'
	| 'creator_invoice_date'
	| 'creator_invoice_amount'
	| 'creator_payment_status'
	| 'creator_payment_cycle'
	| 'creator_payment_date'
	| 'campaign_over'
	| 'invoice_received'
	| 'payment_cleared'
	| 'e_invoice_number'
	| 'payment_received';

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
	{ key: 'direction', label: 'Direction' },
	{ key: 'total_fee', label: 'Total Fee' },
	{ key: 'agency_fee_pct', label: 'Agency Fee %' },
	{ key: 'agency_fee_inr', label: 'Agency Fee' },
	{ key: 'creator_fee', label: 'Creator Fee' },
	{ key: 'billing_entity', label: 'Billing Entity' },
	{ key: 'brand', label: 'Brand' },
	{ key: 'campaign', label: 'Campaign' },
	{ key: 'deliverables', label: 'Deliverables' },
	{ key: 'ro_number', label: 'RO #' },
	{ key: 'client_invoice_number', label: 'Client Inv #' },
	{ key: 'client_invoice_date', label: 'Client Inv Date' },
	{ key: 'client_invoice_amount', label: 'Client Inv Amt' },
	{ key: 'client_payment_status', label: 'Client Status' },
	{ key: 'client_payment_received_amount', label: 'Client Received' },
	{ key: 'client_payment_date', label: 'Client Pay Date' },
	{ key: 'creator_invoice_number', label: 'Creator Inv #' },
	{ key: 'creator_invoice_date', label: 'Creator Inv Date' },
	{ key: 'creator_invoice_amount', label: 'Creator Inv Amt' },
	{ key: 'creator_payment_status', label: 'Creator Status' },
	{ key: 'creator_payment_cycle', label: 'Pay Cycle' },
	{ key: 'creator_payment_date', label: 'Creator Pay Date' },
	{ key: 'campaign_over', label: 'Campaign Over' },
	{ key: 'invoice_received', label: 'Invoice Received' },
	{ key: 'payment_cleared', label: 'Payment Cleared' },
	{ key: 'e_invoice_number', label: 'E-Invoice #' },
	{ key: 'payment_received', label: 'Payment Received' }
];

function MetricCard({ label, value, dotColor, valueColor }: { label: string; value: React.ReactNode; dotColor?: string; valueColor?: string }) {
	return (
		<Card variant="outlined" sx={{ bgcolor: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
			<CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					{dotColor && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor }} />}
					<Typography variant="overline" sx={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em', lineHeight: 1.2 }}>
						{label}
					</Typography>
				</Box>
				<Typography sx={{ color: valueColor ?? 'var(--n-fg)', fontSize: 22, fontWeight: 600, mt: 1, fontVariantNumeric: 'tabular-nums' }}>
					{value}
				</Typography>
			</CardContent>
		</Card>
	);
}

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
function DetailSection({ title }: { title: string }) {
	return (
		<div className="col-span-full border-t pt-3 mt-1" style={{ borderColor: 'var(--n-border)' }}>
			<div className="text-[12px] font-semibold uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}>{title}</div>
		</div>
	);
}

type DealForm = {
	confirmation_date: string;
	e_invoice_date: string;
	creator: string;
	tch_poc: string;
	direction: string;
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
	client_invoice_number: string;
	client_invoice_date: string;
	client_invoice_amount: string;
	client_payment_status: string;
	client_payment_received_amount: string;
	client_payment_date: string;
	creator_invoice_number: string;
	creator_invoice_date: string;
	creator_invoice_amount: string;
	creator_payment_status: string;
	creator_payment_cycle: string;
	creator_payment_date: string;
	comments: string;
};

const EMPTY_FORM: DealForm = {
	confirmation_date: '',
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
	campaign_over: '',
	invoice_received: '',
	payment_cleared: '',
	e_invoice_number: '',
	payment_received: '',
	client_invoice_number: '',
	client_invoice_date: '',
	client_invoice_amount: '',
	client_payment_status: '',
	client_payment_received_amount: '',
	client_payment_date: '',
	creator_invoice_number: '',
	creator_invoice_date: '',
	creator_invoice_amount: '',
	creator_payment_status: '',
	creator_payment_cycle: '',
	creator_payment_date: '',
	comments: ''
};

// One extra creator on a multi-creator campaign. The first/primary creator
// lives in the main form fields; these are the additional split rows.
type ShareForm = {
	creator: string;
	total_fee: string;
	agency_fee_inr: string;
};
const EMPTY_SHARE: ShareForm = {
	creator: '',
	total_fee: '',
	agency_fee_inr: ''
};

// Build a CreatorShare payload row, deriving % and creator fee from totals.
function buildShare(creator: string, total: string, inr: string) {
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

function relTone(rel?: string) {
	if (rel === 'Exclusive') return 'exclusive' as const;
	if (rel === 'Dropping') return 'dropping' as const;
	if (rel === 'NonTCH') return 'nontch' as const;
	return 'friend' as const;
}
function dirTone(dir: string) {
	if (dir === 'Inbound') return 'inbound' as const;
	if (dir === 'Outbound') return 'outbound' as const;
	return 'markup' as const;
}
function isEmw(billing: string) {
	const b = (billing || '').toUpperCase();
	return b.includes('EMW') || b.includes('ELEMENTS MEDIAWORK');
}
function normalisePctValue(p: string): number {
	const n = Number(p);
	if (!Number.isFinite(n) || n <= 0) return 0;
	// Historical/prod rows sometimes stored "15" for 15% instead of "0.15".
	return n > 1 ? n / 100 : n;
}
function normalisePctString(p: string): string {
	const n = normalisePctValue(p);
	return n > 0 ? n.toFixed(4) : '0';
}
function pctText(p: string): string {
	const n = normalisePctValue(p);
	if (!n) return '';
	return `${(n * 100).toFixed(0)}%`;
}

// Indian fiscal year runs Apr → Mar. These mirror the backend aggregation so
// client-side period filtering lines up with Current Overview / Entity Summary.
function fyStartOf(iso: string): number {
	const [y, m] = iso.split('-').map(Number);
	return m >= 4 ? y : y - 1;
}
function fyLabelShort(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Month number ("04") → fiscal quarter. Indian FY: Q1 Apr-Jun, Q2 Jul-Sep,
// Q3 Oct-Dec, Q4 Jan-Mar — mirrors the backend / Entity Summary buckets.
function quarterOfMonth(mm: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
	const n = Number(mm);
	if (n >= 4 && n <= 6) return 'Q1';
	if (n >= 7 && n <= 9) return 'Q2';
	if (n >= 10 && n <= 12) return 'Q3';
	return 'Q4';
}
function monthYearLabel(iso?: string | null): string {
	if (!iso) return 'No date';
	const [y, m] = iso.split('-');
	return `${MONTH_NAMES[Number(m)] ?? m} ${y}`;
}

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
const QUARTER_LABELS: Record<Quarter, string> = {
	Q1: 'Q1 (Apr-Jun)',
	Q2: 'Q2 (Jul-Sep)',
	Q3: 'Q3 (Oct-Dec)',
	Q4: 'Q4 (Jan-Mar)'
};
// Months (as "MM") that fall inside each fiscal quarter, in FY order.
const QUARTER_MONTHS: Record<Quarter, string[]> = {
	Q1: ['04', '05', '06'],
	Q2: ['07', '08', '09'],
	Q3: ['10', '11', '12'],
	Q4: ['01', '02', '03']
};
const FY_MONTH_ORDER = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];
// Calendar year a fiscal-month belongs to: Apr–Dec sit in fyStart, Jan–Mar roll
// into fyStart + 1.
function calYearOfMonth(mm: string, fyStart: number): number {
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
function billingPeriodOf(r: Deal): string | null {
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

type DirFilter = 'All' | 'Inbound' | 'Outbound' | 'MarkUp';
type ViewMode = 'table' | 'cards';
// Card grouping: one card per campaign (default), or rolled up by creator / brand.
type CardGroupBy = 'campaign' | 'creator' | 'brand';

// The full set of creator display names on a deal (primary + any split rows).
function creatorNamesOf(r: Deal): string[] {
	if (r.creator_shares && r.creator_shares.length > 0) {
		return r.creator_shares
			.map((s) => s.creator_name || s.creator_name_raw)
			.filter(Boolean);
	}
	const single = r.creator_name || r.creator_name_raw;
	return single ? [single] : [];
}
// Compact creator label for cards: all names if ≤2, else "First +N more".
function creatorLabel(names: string[]): string {
	if (names.length === 0) return '—';
	if (names.length <= 2) return names.join(', ');
	return `${names[0]} +${names.length - 1} more`;
}

export default function CommercialPage() {
	const [rows, setRows] = React.useState<Deal[]>([]);
	const [creators, setCreators] = React.useState<Creator[]>([]);
	const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Deal | null>(null);
	const [formError, setFormError] = React.useState<string | null>(null);
	const [validationAttempted, setValidationAttempted] = React.useState(false);
	const [q, setQ] = React.useState('');
	const [dirFilter, setDirFilter] = React.useState<DirFilter>('All');
	const [quarter, setQuarter] = React.useState<'All' | Quarter>('All');
	const [month, setMonth] = React.useState('All');
	const { fyStart } = useFiscalYear();
	const [entityFilter, setEntityFilter] = React.useState('All');
	const [creatorFilter, setCreatorFilter] = React.useState('All');
	// Which date attributes a deal to a period: the billing/invoice date
	// (default, matches the Overview) or the confirmation date (issue #7).
	const [dateBasis, setDateBasis] = React.useState<'invoice' | 'confirmation'>('invoice');
	const [form, setForm] = React.useState<DealForm>(EMPTY_FORM);
	// Default to the campaign card/grid layout (issue #7); table is opt-in.
	const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
		if (typeof window === 'undefined') return 'cards';
		const saved = window.localStorage.getItem('commercial-view-mode');
		return saved === 'cards' || saved === 'table' ? saved : 'cards';
	});
	const [groupBy, setGroupBy] = React.useState<CardGroupBy>(() => {
		if (typeof window === 'undefined') return 'campaign';
		const saved = window.localStorage.getItem('commercial-card-group');
		return saved === 'campaign' || saved === 'creator' || saved === 'brand' ? saved : 'campaign';
	});
	const [visibleCols, setVisibleCols] = React.useState<Record<ColumnKey, boolean>>(() => {
		const hiddenByDefault: ColumnKey[] = [
			'client_invoice_number',
			'client_invoice_date',
			'client_invoice_amount',
			'client_payment_status',
			'client_payment_received_amount',
			'client_payment_date',
			'creator_invoice_number',
			'creator_invoice_date',
			'creator_invoice_amount',
			'creator_payment_status',
			'creator_payment_cycle',
			'creator_payment_date'
		];
		return Object.fromEntries(
			COLUMN_OPTIONS.map(({ key }) => [key, !hiddenByDefault.includes(key)])
		) as Record<ColumnKey, boolean>;
	});
	const [columnsMenuAnchor, setColumnsMenuAnchor] = React.useState<null | HTMLElement>(null);
	const [expandedCards, setExpandedCards] = React.useState<Record<string, boolean>>({});
	const [detail, setDetail] = React.useState<Deal | null>(null);
	const toggleCol = (key: ColumnKey) => setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
	const selectedColumnCount = COLUMN_OPTIONS.filter(({ key }) => visibleCols[key]).length;
	const colGroups = {
		deal: ['direction', 'total_fee', 'agency_fee_pct', 'agency_fee_inr', 'creator_fee', 'billing_entity', 'brand', 'campaign', 'deliverables', 'ro_number'].some((key) => visibleCols[key as ColumnKey]),
		finance_client: ['client_invoice_number', 'client_invoice_date', 'client_invoice_amount', 'client_payment_status', 'client_payment_received_amount', 'client_payment_date'].some((key) => visibleCols[key as ColumnKey]),
		finance_creator: ['creator_invoice_number', 'creator_invoice_date', 'creator_invoice_amount', 'creator_payment_status', 'creator_payment_cycle', 'creator_payment_date'].some((key) => visibleCols[key as ColumnKey]),
		status: ['campaign_over', 'invoice_received', 'payment_cleared', 'e_invoice_number', 'payment_received'].some((key) => visibleCols[key as ColumnKey])
	};
	const columnsMenuOpen = Boolean(columnsMenuAnchor);
	const [shares, setShares] = React.useState<ShareForm[]>([]);

	const load = React.useCallback(async () => {
		setLoading(true);
		let shown = false;
		try {
			// fy scopes the payload server-side to the selected fiscal year
			// (plus not-yet-invoiced deals for the backfill banner) — the page
			// never shows other years, so don't download them. Each feed
			// renders from cache instantly and updates when the network lands.
			await Promise.all([
				api.getSWR<Deal[]>(`/deals/?fy=${fyStart}`, (d) => {
					shown = true;
					setRows(d);
					setLoading(false);
				}),
				api.getSWR<Creator[]>('/creators/', setCreators),
				api.getSWR<Campaign[]>('/campaigns/', setCampaigns)
			]);
		} catch (e) {
			if (!shown) setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, [fyStart]);

	React.useEffect(() => {
		load();
	}, [load]);

	React.useEffect(() => {
		window.localStorage.setItem('commercial-view-mode', viewMode);
	}, [viewMode]);

	React.useEffect(() => {
		window.localStorage.setItem('commercial-card-group', groupBy);
	}, [groupBy]);

	// Agency fee % and Agency fee (INR) are kept in sync both ways: editing the
	// % derives the INR, editing the INR derives the %. feeBasis remembers which
	// one the user drove last so changing Total Fee recomputes the right one.
	const feeBasis = React.useRef<'pct' | 'inr'>('pct');
	function recomputeFees(next: DealForm): DealForm {
		const total = Number(next.total_fee);
		if (!Number.isFinite(total) || total <= 0) return next;
		if (feeBasis.current === 'inr') {
			const inr = Number(next.agency_fee_inr);
			if (!Number.isFinite(inr) || inr <= 0) return next;
			return {
				...next,
				agency_fee_pct: (inr / total).toFixed(4),
				creator_fee: (total - inr).toFixed(2)
			};
		}
		const p = Number(next.agency_fee_pct);
		if (!Number.isFinite(p) || p <= 0) return next;
		const pct = p <= 1 ? p : p / 100;
		const inr = total * pct;
		return { ...next, agency_fee_inr: inr.toFixed(2), creator_fee: (total - inr).toFixed(2) };
	}

	// Mark Up deals can't be on exclusive creators — clear a now-hidden pick.
	React.useEffect(() => {
		if (form.direction === 'MarkUp' && form.creator) {
			const c = creators.find((x) => String(x.id) === form.creator);
			if (c && c.relationship === 'Exclusive') setForm((f) => ({ ...f, creator: '' }));
		}
	}, [form.direction, form.creator, creators]);

	function startAdd() {
		setEditing(null);
		setFormError(null);
		setValidationAttempted(false);
		setForm({
			...EMPTY_FORM,
			confirmation_date: new Date().toISOString().slice(0, 10)
		});
		setShares([]);
		setOpen(true);
	}

	function startEdit(d: Deal) {
		setEditing(d);
		setFormError(null);
		setValidationAttempted(false);
		const cs = d.creator_shares ?? [];
		// When the campaign has splits, the first share fills the primary fields
		// and the rest become additional rows.
		const primary = cs[0];
		setForm({
			confirmation_date: d.confirmation_date ?? '',
			e_invoice_date: d.e_invoice_date ?? '',
			creator: primary
				? primary.creator
					? String(primary.creator)
					: ''
				: d.creator
					? String(d.creator)
					: '',
			tch_poc: d.tch_poc ?? '',
			direction: d.direction,
			total_fee: primary ? primary.total_fee : d.total_fee,
			agency_fee_pct: primary ? primary.agency_fee_pct : d.agency_fee_pct,
			agency_fee_inr: primary ? primary.agency_fee_inr : d.agency_fee_inr,
			creator_fee: primary ? primary.creator_fee : d.creator_fee,
			billing_entity: d.billing_entity,
			brand: d.brand,
			brand_poc: d.brand_poc ?? '',
			campaign: d.campaign ?? '',
			deliverables: d.deliverables,
			ro_number: d.ro_number,
			campaign_over: d.campaign_over,
			invoice_received: d.invoice_received,
			payment_cleared: d.payment_cleared,
			e_invoice_number: d.e_invoice_number,
			payment_received: d.payment_received,
			client_invoice_number: d.client_invoice_number ?? '',
			client_invoice_date: d.client_invoice_date ?? '',
			client_invoice_amount: d.client_invoice_amount ?? '',
			client_payment_status: d.client_payment_status ?? '',
			client_payment_received_amount: d.client_payment_received_amount ?? '',
			client_payment_date: d.client_payment_date ?? '',
			creator_invoice_number: d.creator_invoice_number ?? '',
			creator_invoice_date: d.creator_invoice_date ?? '',
			creator_invoice_amount: d.creator_invoice_amount ?? '',
			creator_payment_status: d.creator_payment_status ?? '',
			creator_payment_cycle: d.creator_payment_cycle ?? '',
			creator_payment_date: d.creator_payment_date ?? '',
			comments: d.comments
		});
		setShares(
			cs.slice(1).map((s) => ({
				creator: s.creator ? String(s.creator) : '',
				total_fee: s.total_fee,
				agency_fee_inr: s.agency_fee_inr
			}))
		);
		setOpen(true);
	}

	function requiredCampaignFields(): string[] {
		const required: { label: string; value: string }[] = [
			{ label: 'Confirmation Date', value: form.confirmation_date },
			{ label: 'Direction', value: form.direction },
			{ label: 'Creator', value: form.creator },
			{ label: 'TCH POC', value: form.tch_poc },
			{ label: 'Total Fee', value: form.total_fee },
			{ label: 'Agency Fee %', value: form.agency_fee_pct },
			{ label: 'Agency Fee (INR)', value: form.agency_fee_inr },
			{ label: 'Creator Fee', value: form.creator_fee },
			{ label: 'Billing Entity', value: form.billing_entity },
			{ label: 'Brand', value: form.brand },
			{ label: 'Brand POC', value: form.brand_poc },
			{ label: 'Campaign', value: form.campaign },
			{ label: 'Deliverables', value: form.deliverables },
			{ label: 'RO Number', value: form.ro_number },
			{ label: 'Campaign Over', value: form.campaign_over },
			{ label: 'Invoice Received', value: form.invoice_received },
			{ label: 'Payment Cleared by TCH', value: form.payment_cleared },
			{ label: 'E-Invoice #', value: form.e_invoice_number },
			{ label: 'Payment Received by TCH', value: form.payment_received }
		];
		const missing = required.filter((f) => !String(f.value ?? '').trim()).map((f) => f.label);
		shares.forEach((s, i) => {
			if (!s.creator) missing.push(`Split creator ${i + 2}`);
			if (!String(s.total_fee ?? '').trim()) missing.push(`Split creator ${i + 2} fee`);
			if (!String(s.agency_fee_inr ?? '').trim()) missing.push(`Split creator ${i + 2} agency fee`);
		});
		return missing;
	}

	async function submit() {
		setValidationAttempted(true);
		const missing = requiredCampaignFields();
		if (missing.length > 0) {
			setFormError(`${missing.length} required field${missing.length === 1 ? '' : 's'} missing. Fields marked in red are required. Client Invoice and Creator Invoice sections are optional.`);
			return;
		}
		setFormError(null);
		setValidationAttempted(false);
		// A campaign is "split" when extra creators are added. We then send the
		// full creator_shares set (primary + additions) and roll the campaign
		// totals up from the shares. With no extra creators we send an empty
		// set so any previous split is cleared and the single creator is used.
		const hasSplit = shares.length > 0;
		const shareRows = hasSplit
			? [
					buildShare(form.creator, form.total_fee, form.agency_fee_inr),
					...shares.map((s) =>
						buildShare(s.creator, s.total_fee, s.agency_fee_inr)
					)
				]
			: [];
		const sum = (k: 'total_fee' | 'agency_fee_inr' | 'creator_fee') =>
			shareRows.reduce((n, s) => n + (Number(s[k]) || 0), 0).toFixed(2);
		const payload = {
			...form,
			creator: form.creator ? Number(form.creator) : null,
			creator_name_raw: '',
			confirmation_date: form.confirmation_date || null,
			e_invoice_date: form.e_invoice_date || null,
			total_fee: hasSplit ? sum('total_fee') : form.total_fee || '0',
			agency_fee_pct: normalisePctString(form.agency_fee_pct),
			agency_fee_inr: hasSplit ? sum('agency_fee_inr') : form.agency_fee_inr || '0',
			creator_fee: hasSplit ? sum('creator_fee') : form.creator_fee || '0',
			creator_shares: shareRows,
			client_invoice_date: form.client_invoice_date || null,
			client_invoice_amount: form.client_invoice_amount || '0',
			client_payment_received_amount: form.client_payment_received_amount || '0',
			client_payment_date: form.client_payment_date || null,
			creator_invoice_date: form.creator_invoice_date || null,
			creator_invoice_amount: form.creator_invoice_amount || '0',
			creator_payment_date: form.creator_payment_date || null,
		};
		try {
			if (editing) {
				await api.patch(`/deals/${editing.id}/`, { ...payload, version: editing.version });
			} else {
				await api.post('/deals/', payload);
			}
			setOpen(false);
			await load();
		} catch (e) {
			alert((e as Error).message);
			if (e instanceof ConflictError) {
				setOpen(false);
				await load();
			}
		}
	}

	async function remove(d: Deal) {
		if (!confirm(`Delete campaign for "${d.creator_name}" / brand "${d.brand}"?`)) return;
		await api.del(`/deals/${d.id}/`);
		await load();
	}

	// Distinct creator names across the loaded deals (primary + split rows) —
	// powers the creator filter; a multi-creator deal appears under every name.
	const creatorNames = React.useMemo(() => {
		const set = new Set<string>();
		for (const r of rows) for (const n of creatorNamesOf(r)) if (n.trim()) set.add(n.trim());
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	}, [rows]);

	// Distinct billing entities across all deals — powers the entity filter and
	// the Add/Edit Deal dropdown so billing under one company stays consistent.
	const entities = React.useMemo(() => {
		const set = new Set<string>();
		for (const r of rows) {
			const be = r.billing_entity?.trim();
			if (be) set.add(be);
		}
		return Array.from(set).sort((a, b) => a.localeCompare(b));
	}, [rows]);

	const filtersActive =
		entityFilter !== 'All' || creatorFilter !== 'All' || quarter !== 'All' || month !== 'All' || dirFilter !== 'All' || q.trim() !== '';

	// Periods are offered only once they've started: a quarter/month appears in
	// the dropdowns when its calendar position is in the past or is the running
	// one for the selected fiscal year. Future periods are hidden entirely.
	const { availQuarters, monthsForQuarter } = React.useMemo(() => {
		const now = new Date();
		const curY = now.getFullYear();
		const curM = now.getMonth() + 1;
		const hasStarted = (mm: string) => {
			const y = calYearOfMonth(mm, fyStart);
			return y < curY || (y === curY && Number(mm) <= curM);
		};
		const startedMonths = FY_MONTH_ORDER.filter(hasStarted);
		const quarters = (Object.keys(QUARTER_MONTHS) as Quarter[]).filter((qk) =>
			QUARTER_MONTHS[qk].some(hasStarted)
		);
		const forQuarter = (qk: 'All' | Quarter) =>
			qk === 'All' ? startedMonths : QUARTER_MONTHS[qk].filter(hasStarted);
		return { availQuarters: quarters, monthsForQuarter: forQuarter };
	}, [fyStart]);

	// Switching fiscal year can invalidate the chosen quarter/month (e.g. a future
	// FY where that period hasn't started) — fall back to the broader scope.
	React.useEffect(() => {
		if (quarter !== 'All' && !availQuarters.includes(quarter)) {
			setQuarter('All');
			setMonth('All');
		} else if (month !== 'All' && !monthsForQuarter(quarter).includes(month)) {
			setMonth('All');
		}
	}, [availQuarters, monthsForQuarter, quarter, month]);

	// The date a deal is tracked on. Default is the billing month (E-Invoice
	// No, falling back to invoice date) — the same rule the Overview uses, so
	// the two pages always agree. The confirmation-date lens re-buckets every
	// period filter and total by when the deal was confirmed instead.
	const trackDate = React.useCallback(
		(r: Deal) => (dateBasis === 'invoice' ? billingPeriodOf(r) : r.confirmation_date || null),
		[dateBasis]
	);

	// Deals that can't be placed in a fiscal year because they lack the tracking
	// date — surfaced for ops to backfill rather than silently dropped.
	const missingDate = React.useMemo(() => {
		return rows.filter((r) => {
			if (dirFilter !== 'All' && r.direction !== dirFilter) return false;
			if (entityFilter !== 'All' && (r.billing_entity || '').trim() !== entityFilter) return false;
			if (creatorFilter !== 'All' && !creatorNamesOf(r).includes(creatorFilter)) return false;
			return !trackDate(r);
		});
	}, [rows, dirFilter, entityFilter, creatorFilter, trackDate]);

	// Non-period filters (direction, entity, creator, search) — shared between
	// the visible list and the invoiced/confirmed billing summary so the two
	// always describe the same slice of deals.
	const matchesFacets = React.useCallback(
		(r: Deal) => {
			if (dirFilter !== 'All' && r.direction !== dirFilter) return false;
			if (entityFilter !== 'All' && (r.billing_entity || '').trim() !== entityFilter) return false;
			if (creatorFilter !== 'All' && !creatorNamesOf(r).includes(creatorFilter)) return false;
			const needle = q.trim().toLowerCase();
			if (!needle) return true;
			return (
				creatorNamesOf(r).some((n) => n.toLowerCase().includes(needle)) ||
				r.brand?.toLowerCase().includes(needle) ||
				r.campaign?.toLowerCase().includes(needle) ||
				r.billing_entity?.toLowerCase().includes(needle) ||
				r.ro_number?.toLowerCase().includes(needle)
			);
		},
		[dirFilter, entityFilter, creatorFilter, q]
	);

	// Does a date fall inside the selected FY + quarter/month scope?
	const inPeriod = React.useCallback(
		(d: string | null) => {
			if (!d || fyStartOf(d) !== fyStart) return false;
			const mm = d.split('-')[1];
			if (month !== 'All') return mm === month;
			if (quarter !== 'All') return quarterOfMonth(mm) === quarter;
			return true;
		},
		[fyStart, quarter, month]
	);

	const filtered = React.useMemo(() => {
		const list = rows.filter((r) => {
			if (!matchesFacets(r)) return false;
			// Scope strictly to the selected period by the tracking date. Rows
			// with no such date can't be attributed to a fiscal year and are
			// hidden (see the backfill banner for the count).
			return inPeriod(trackDate(r));
		});
		return list.slice().sort((a, b) => {
			const ad = trackDate(a);
			const bd = trackDate(b);
			if (!ad && !bd) return 0;
			if (!ad) return 1;
			if (!bd) return -1;
			return bd.localeCompare(ad);
		});
	}, [rows, matchesFacets, inPeriod, trackDate]);

	// Headline billing pair: "Total Billing" is every deal *confirmed* in the
	// selected period (committed pipeline, invoiced or not); "Invoiced Billing"
	// is every deal *invoiced* in it (recognized revenue). A deal can appear in
	// both, or in just one when confirmation and invoice fall in different
	// periods.
	const billingSummary = React.useMemo(() => {
		let invoiced = 0;
		let confirmed = 0;
		for (const r of rows) {
			if (!matchesFacets(r)) continue;
			const fee = Number(r.total_fee) || 0;
			if (inPeriod(billingPeriodOf(r))) invoiced += fee;
			if (inPeriod(r.confirmation_date || null)) confirmed += fee;
		}
		return { invoiced, confirmed };
	}, [rows, matchesFacets, inPeriod]);

	function resetFilters() {
		setEntityFilter('All');
		setCreatorFilter('All');
		setQuarter('All');
		setMonth('All');
		setDirFilter('All');
		setQ('');
	}

	const totals = React.useMemo(() => {
		let total = 0;
		let profit = 0;
		let clientOutstanding = 0;
		let clientReceived = 0;
		let creatorPending = 0;
		for (const r of filtered) {
			total += Number(r.total_fee || 0);
			profit += Number(r.agency_fee_inr || 0);
			const cInvAmt = Number(r.client_invoice_amount || 0);
			const cRecvAmt = Number(r.client_payment_received_amount || 0);
			clientReceived += cRecvAmt;
			if (cInvAmt > 0) clientOutstanding += cInvAmt - cRecvAmt;
			if (r.creator_payment_status && r.creator_payment_status !== 'Paid') {
				creatorPending += Number(r.creator_invoice_amount || 0);
			}
		}
		const count = filtered.length;
		// Distinct campaigns, excluding deals without one — same definition as the
		// Overview's "Campaigns this FY" so the two headlines agree.
		const campaignCount = new Set(
			filtered.map((r) => r.campaign?.trim()).filter(Boolean)
		).size;
		return {
			total,
			profit,
			count,
			campaignCount,
			avg: count > 0 ? total / count : 0,
			clientOutstanding,
			clientReceived,
			creatorPending
		};
	}, [filtered]);

	const set = <K extends keyof DealForm>(k: K, v: DealForm[K]) => {
		setFormError(null);
		setForm((f) => ({ ...f, [k]: v }));
	};
	const isMissing = (k: keyof DealForm) =>
		validationAttempted && !String(form[k] ?? '').trim();
	const reqHelper = (k: keyof DealForm) => (isMissing(k) ? 'Required' : ' ');
	const muiInputSx = {
		'& .MuiInputBase-root': { bgcolor: 'var(--n-bg-soft)', fontSize: 14 },
		'& .MuiFormHelperText-root': { minHeight: 18, m: '2px 0 0' }
	};

	// Suggested campaign name following the Brand + Creator + Month/Year convention.
	const suggestedCampaignName = React.useMemo(() => {
		const creatorName = creators.find((c) => String(c.id) === form.creator)?.name || '';
		const date = form.e_invoice_date || form.confirmation_date;
		const parts = [form.brand.trim(), creatorName, date ? monthYearLabel(date) : ''].filter(Boolean);
		return parts.join(' · ');
	}, [creators, form.creator, form.brand, form.e_invoice_date, form.confirmation_date]);

	const updateShare = (i: number, k: keyof ShareForm, v: string) => {
		setFormError(null);
		setShares((arr) => arr.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
	};
	const removeShare = (i: number) =>
		setShares((arr) => arr.filter((_, idx) => idx !== i));

	// Creator options, filtered to exclude exclusives on Mark Up campaigns.
	const creatorOptions = creators
		.filter((c) => form.direction !== 'MarkUp' || c.relationship !== 'Exclusive')
		.map((c) => ({ value: String(c.id), label: `${c.name} · ${c.relationship}` }));

	// Campaign total when splitting (primary share + additional shares).
	const splitTotal =
		shares.length > 0
			? (Number(form.total_fee) || 0) +
				shares.reduce((n, s) => n + (Number(s.total_fee) || 0), 0)
			: 0;

	// Rolled-up groups for the Creator / Brand card layouts. A deal with multiple
	// creators contributes to each of its creators' groups (so filtering by a
	// creator surfaces every campaign they appear in), splitting fee/profit by
	// the per-creator share where available.
	const cardGroups = React.useMemo(() => {
		const map = new Map<string, { key: string; name: string; relationship?: string; deals: Deal[]; total: number; profit: number }>();
		const add = (rawName: string, relationship: string | undefined, r: Deal, total: number, profit: number) => {
			const name = rawName || '—';
			const key = name.toLowerCase();
			const group = map.get(key) ?? { key, name, relationship, deals: [], total: 0, profit: 0 };
			group.deals.push(r);
			group.total += total;
			group.profit += profit;
			if (!group.relationship) group.relationship = relationship;
			map.set(key, group);
		};
		for (const r of filtered) {
			if (groupBy === 'brand') {
				add(r.brand, undefined, r, Number(r.total_fee) || 0, Number(r.agency_fee_inr) || 0);
			} else if (r.creator_shares && r.creator_shares.length > 0) {
				for (const s of r.creator_shares) {
					add(
						s.creator_name || s.creator_name_raw,
						s.creator_relationship,
						r,
						Number(s.total_fee) || 0,
						Number(s.agency_fee_inr) || 0
					);
				}
			} else {
				add(r.creator_name || r.creator_name_raw, r.creator_relationship, r, Number(r.total_fee) || 0, Number(r.agency_fee_inr) || 0);
			}
		}
		return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [filtered, groupBy]);

	// Table grouping keeps one row per deal (no fee splitting / duplication): each
	// deal sits under a single brand or combined-creator heading with a subtotal.
	const tableGroups = React.useMemo(() => {
		if (groupBy === 'campaign') return null;
		const map = new Map<string, { key: string; name: string; deals: Deal[]; total: number; profit: number }>();
		for (const r of filtered) {
			const name = (groupBy === 'brand' ? r.brand : creatorNamesOf(r).join(', ')) || '—';
			const key = name.toLowerCase();
			const group = map.get(key) ?? { key, name, deals: [], total: 0, profit: 0 };
			group.deals.push(r);
			group.total += Number(r.total_fee) || 0;
			group.profit += Number(r.agency_fee_inr) || 0;
			map.set(key, group);
		}
		return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [filtered, groupBy]);

	// Flattened render list for the table body: a header marker before each group
	// (when grouping), otherwise just the deal rows in order.
	type TableItem =
		| { kind: 'header'; key: string; name: string; count: number; total: number; profit: number }
		| { kind: 'row'; r: Deal };
	const tableItems = React.useMemo<TableItem[]>(() => {
		if (!tableGroups) return filtered.map((r) => ({ kind: 'row', r }));
		const out: TableItem[] = [];
		for (const g of tableGroups) {
			out.push({ kind: 'header', key: g.key, name: g.name, count: g.deals.length, total: g.total, profit: g.profit });
			for (const r of g.deals) out.push({ kind: 'row', r });
		}
		return out;
	}, [tableGroups, filtered]);

	const stickyLabel = groupBy === 'brand' ? 'Brand' : groupBy === 'campaign' ? 'Campaign' : 'Creator';
	const renderStickyGroupCell = (r: Deal) => {
		if (groupBy === 'brand') {
			return (
				<>
					<div className="font-medium truncate" title={r.brand || undefined} style={{ color: 'var(--n-fg)' }}>{r.brand || '—'}</div>
					{r.campaign && <div className="text-[12px] truncate" style={{ color: 'var(--n-fg-muted)' }}>{r.campaign}</div>}
				</>
			);
		}
		if (groupBy === 'campaign') {
			return (
				<>
					<div className="font-medium truncate" title={r.campaign || undefined} style={{ color: 'var(--n-fg)' }}>{r.campaign || '—'}</div>
					{r.brand && <div className="text-[12px] truncate" style={{ color: 'var(--n-fg-muted)' }}>{r.brand}</div>}
				</>
			);
		}
		return (
			<>
				<div className="font-medium truncate" style={{ color: 'var(--n-fg)' }}>
					{r.creator_shares && r.creator_shares.length > 0
						? r.creator_shares
								.map((s) => s.creator_name || s.creator_name_raw)
								.filter(Boolean)
								.join(', ')
						: r.creator_name || '—'}
				</div>
				{r.creator_shares && r.creator_shares.length > 1 ? (
					<Tag tone="markup" className="mt-0.5">{r.creator_shares.length} creators</Tag>
				) : (
					r.creator_relationship && (
						<Tag tone={relTone(r.creator_relationship)} className="mt-0.5">
							{r.creator_relationship === 'NonTCH' ? 'Non TCH' : r.creator_relationship}
						</Tag>
					)
				)}
			</>
		);
	};

	return (
		<>
			<Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
				<Box component="header">
					<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
						<Typography component="h1" className="page-title" sx={{ color: 'var(--n-fg)', fontSize: 40, lineHeight: 1.15, fontWeight: 700 }}>
							Campaign Tracking
						</Typography>
						<MuiButton variant="contained" onClick={startAdd} startIcon={<Icon name="plus" size={14} />} sx={{ bgcolor: 'var(--n-accent)', textTransform: 'none', '&:hover': { bgcolor: '#380e44' } }}>
							Add Campaign
						</MuiButton>
					</Box>
				</Box>

				<Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 1 }}>
					<MetricCard label="Invoiced Billing" value={`₹ ${inr(billingSummary.invoiced)}`} />
					<MetricCard label="Total Billing" value={`₹ ${inr(billingSummary.confirmed)}`} />
					<MetricCard label="Avg Deal Size" value={totals.count > 0 ? `₹ ${inr(totals.avg)}` : '—'} />
					<MetricCard label="TCH Profit" value={`₹ ${inr(totals.profit)}`} dotColor="#0f7b6c" />
					<MetricCard label="Profit Ratio" value={totals.total > 0 ? `${((totals.profit / totals.total) * 100).toFixed(1)}%` : '—'} />
				</Box>

				<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
					<TextField
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search creator, brand, campaign…"
						size="small"
						sx={{ flex: '1 1 260px', minWidth: 220 }}
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<Icon name="search" size={14} />
									</InputAdornment>
								)
							}
						}}
					/>
					<TextField
						select
						size="small"
						label="Deal Type"
						value={dirFilter}
						onChange={(e) => setDirFilter(e.target.value as DirFilter)}
						sx={{ flex: '0 1 140px', minWidth: 120 }}
					>
						{(['All', 'Inbound', 'Outbound', 'MarkUp'] as DirFilter[]).map((d) => (
							<MenuItem key={d} value={d}>
								{d === 'MarkUp' ? 'Mark Up' : d}
							</MenuItem>
						))}
					</TextField>
					<TextField
						select
						size="small"
						label="Creator"
						value={creatorFilter}
						onChange={(e) => setCreatorFilter(e.target.value)}
						sx={{ flex: '0 1 200px', minWidth: 150 }}
					>
						<MenuItem value="All">All creators</MenuItem>
						{creatorNames.map((n) => (
							<MenuItem key={n} value={n}>{n}</MenuItem>
						))}
					</TextField>
					<TextField
						select
						size="small"
						label="Billing Entity"
						value={entityFilter}
						onChange={(e) => setEntityFilter(e.target.value)}
						sx={{ flex: '0 1 220px', minWidth: 160 }}
					>
						<MenuItem value="All">All billing entities</MenuItem>
						{entities.map((e) => (
							<MenuItem key={e} value={e}>{e}</MenuItem>
						))}
					</TextField>
					<TextField
						select
						size="small"
						label="Track by"
						value={dateBasis}
						onChange={(e) => setDateBasis(e.target.value as 'invoice' | 'confirmation')}
						sx={{ flex: '0 1 170px', minWidth: 150 }}
					>
						<MenuItem value="invoice">Invoice date</MenuItem>
						<MenuItem value="confirmation">Confirmation date</MenuItem>
					</TextField>
					<TextField
						select
						size="small"
						label="Quarter"
						value={quarter}
						onChange={(e) => {
							setQuarter(e.target.value as 'All' | Quarter);
							setMonth('All');
						}}
						sx={{ flex: '0 1 150px', minWidth: 130 }}
					>
						<MenuItem value="All">Full Year</MenuItem>
						{availQuarters.map((qk) => (
							<MenuItem key={qk} value={qk}>{QUARTER_LABELS[qk]}</MenuItem>
						))}
					</TextField>
					<TextField
						select
						size="small"
						label="Month"
						value={month}
						onChange={(e) => setMonth(e.target.value)}
						sx={{ flex: '0 1 140px', minWidth: 120 }}
					>
						<MenuItem value="All">{quarter === 'All' ? 'All months' : 'Whole quarter'}</MenuItem>
						{monthsForQuarter(quarter).map((mm) => (
							<MenuItem key={mm} value={mm}>{MONTH_NAMES[Number(mm)]}</MenuItem>
						))}
					</TextField>
					<TextField
						select
						size="small"
						label="View"
						value={viewMode}
						onChange={(e) => setViewMode(e.target.value as ViewMode)}
						sx={{ flex: '0 1 120px', minWidth: 110 }}
					>
						<MenuItem value="cards">Cards</MenuItem>
						<MenuItem value="table">Table</MenuItem>
					</TextField>
					<TextField
						select
						size="small"
						label="Group by"
						value={groupBy}
						onChange={(e) => setGroupBy(e.target.value as CardGroupBy)}
						sx={{ flex: '0 1 140px', minWidth: 120 }}
					>
						<MenuItem value="campaign">Campaign</MenuItem>
						<MenuItem value="creator">Creator</MenuItem>
						<MenuItem value="brand">Brand</MenuItem>
					</TextField>
					{viewMode === 'table' && (
						<>
							<MuiButton
								variant="outlined"
								size="medium"
								onClick={(event) => setColumnsMenuAnchor(event.currentTarget)}
								sx={{
									height: 40,
									minWidth: 0,
									px: 1.75,
									borderColor: 'var(--n-border)',
									color: 'var(--n-fg)',
									fontSize: 14,
									fontWeight: 400,
									letterSpacing: 0,
									textTransform: 'none',
									'&:hover': {
										borderColor: 'var(--n-border-strong)',
										backgroundColor: 'var(--n-bg-soft)'
									}
								}}
							>
								View Columns
							</MuiButton>
							<Menu
								anchorEl={columnsMenuAnchor}
								open={columnsMenuOpen}
								onClose={() => setColumnsMenuAnchor(null)}
							>
								{COLUMN_OPTIONS.map(({ key, label }) => (
									<MenuItem key={key} onClick={() => toggleCol(key)} dense>
										<Checkbox checked={visibleCols[key]} size="small" />
										{label}
									</MenuItem>
								))}
							</Menu>
						</>
					)}
					{filtersActive && (
						<MuiButton variant="text" onClick={resetFilters} sx={{ height: 40, textTransform: 'none' }}>
							Reset filters
						</MuiButton>
					)}
				</Box>

				{missingDate.length > 0 && (
					<Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: 13 } }}>
						{missingDate.length} deal{missingDate.length === 1 ? '' : 's'} {missingDate.length === 1 ? 'has' : 'have'} no{' '}
						{dateBasis === 'invoice' ? 'E-Invoice No or invoice date' : 'confirmation date'} and{' '}
						{missingDate.length === 1 ? "isn't" : "aren't"} counted in any
						period — backfill {missingDate.length === 1 ? 'it' : 'them'} to include {missingDate.length === 1 ? 'it' : 'them'} in billing totals.
					</Alert>
				)}

				{loading ? (
					<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
						Loading…
					</div>
				) : error ? (
					<div
						className="text-[14px] rounded p-3"
						style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
					>
						Error: {error}
					</div>
				) : viewMode === 'cards' && groupBy === 'campaign' ? (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{filtered.map((r) => {
								const names = creatorNamesOf(r);
								return (
									<div
										key={r.id}
										role="button"
										tabIndex={0}
										onClick={() => setDetail(r)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												setDetail(r);
											}
										}}
										className="text-left rounded-lg p-4 space-y-3 cursor-pointer border border-[var(--n-border)] transition-colors duration-150 hover:border-[var(--n-accent)] focus:outline-none focus-visible:border-[var(--n-accent)]"
										style={{ background: 'var(--n-bg)' }}
									>
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<div className="font-semibold text-[15px] truncate" style={{ color: 'var(--n-fg)' }}>{r.brand || '—'}</div>
												<div className="text-[13px] mt-0.5 truncate" style={{ color: 'var(--n-fg-muted)' }}>{creatorLabel(names)}</div>
											</div>
											<Tag tone={dirTone(r.direction)}>{r.direction}</Tag>
										</div>
										{r.campaign && (
											<div className="flex items-center gap-2 min-w-0">
												<div className="text-[13px] truncate" style={{ color: 'var(--n-fg-muted)' }}>{r.campaign}</div>
												{r.campaign_status && (
													<Tag tone={r.campaign_status === 'Over' ? 'neutral' : 'yes'}>{r.campaign_status}</Tag>
												)}
											</div>
										)}
										<div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
											<div>
												<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>Total Fee</div>
												<div className="font-semibold tabular-nums" style={{ color: 'var(--n-fg)' }}>{inr(r.total_fee)}</div>
											</div>
											<div>
												<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>TCH Profit</div>
												<div className="font-semibold tabular-nums" style={{ color: '#1f6f43' }}>{inr(r.agency_fee_inr)}</div>
											</div>
										</div>
										<div className="flex items-center justify-between gap-2 pt-1">
											<Tag tone="markup">{monthYearLabel(trackDate(r))}</Tag>
											{names.length > 1 && <Tag tone="markup">{names.length} creators</Tag>}
										</div>
									</div>
								);
							})}
						</div>
						{filtered.length === 0 && (
							<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
								No campaigns match the current filters.
							</div>
						)}
					</>
				) : viewMode === 'cards' ? (
					<>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{cardGroups.map((group) => {
								const expanded = expandedCards[group.key] ?? false;
								return (
									<div
										key={group.key}
										className="rounded-lg p-4 space-y-3 border border-[var(--n-border)] transition-colors duration-150 hover:border-[var(--n-accent)]"
										style={{ background: 'var(--n-bg)' }}
									>
										<div className="flex items-start justify-between gap-2">
											<div>
												<div className="font-semibold text-[15px]" style={{ color: 'var(--n-fg)' }}>{group.name}</div>
												<div className="text-[13px] mt-0.5" style={{ color: 'var(--n-fg-muted)' }}>
													{group.deals.length} deal{group.deals.length === 1 ? '' : 's'}
												</div>
											</div>
											<div className="flex items-center gap-2">
												{group.relationship && <Tag tone={relTone(group.relationship)}>{group.relationship === 'NonTCH' ? 'Non TCH' : group.relationship}</Tag>}
												<button
													type="button"
													aria-label={expanded ? 'Collapse deals' : 'Expand deals'}
													onClick={() => setExpandedCards((prev) => ({ ...prev, [group.key]: !expanded }))}
													className="h-5 w-5 inline-flex items-center justify-center rounded-[3px] border border-[var(--n-border)] text-[var(--n-fg-muted)] hover:bg-[var(--n-accent)] hover:border-[var(--n-accent)] hover:text-white transition-colors"
												>
													<Icon name="chevron-right" size={13} className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
												</button>
											</div>
										</div>
										<div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
											<div>
												<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>Total Fee</div>
												<div className="font-semibold tabular-nums" style={{ color: 'var(--n-fg)' }}>{inr(group.total)}</div>
											</div>
											<div>
												<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>TCH Profit</div>
												<div className="font-semibold tabular-nums" style={{ color: '#1f6f43' }}>{inr(group.profit)}</div>
											</div>
										</div>
										<Collapse in={expanded} timeout="auto" unmountOnExit>
											<div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--n-border)' }}>
												{group.deals.map((r) => {
													const headline = groupBy === 'brand' ? creatorLabel(creatorNamesOf(r)) : (r.brand || '—');
													return (
														<div key={r.id} className="flex items-center gap-2 text-[13px]">
															<div className="min-w-0 flex-1">
																<div className="font-medium truncate" style={{ color: 'var(--n-fg)' }}>{headline}{r.campaign ? ` · ${r.campaign}` : ''}</div>
																<div className="tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>{inr(r.total_fee)} · {monthYearLabel(trackDate(r))}</div>
															</div>
															<Tag tone={dirTone(r.direction)}>{r.direction}</Tag>
															<Button variant="primary" onClick={() => setDetail(r)}>View</Button>
														</div>
													);
												})}
											</div>
										</Collapse>
									</div>
								);
							})}
						</div>
						{filtered.length === 0 && (
							<div
								className="text-[14px] py-8 text-center"
								style={{ color: 'var(--n-fg-subtle)' }}
							>
								No deals match the current filters.
							</div>
						)}
					</>
				) : (
					<>
						<TableContainer className="ct-wrap">
							<Table stickyHeader className="ct-table">
								<TableHead>
									<TableRow>
										<TableCell className="ct-sticky-l1 ct-head w-[100px]">Conf Date</TableCell>
										<TableCell className="ct-sticky-l2 ct-head w-[200px]">{stickyLabel}</TableCell>
										{colGroups.deal && <>
											{visibleCols.direction && <TableCell className="ct-head w-[110px]">Direction</TableCell>}
											{visibleCols.total_fee && <TableCell className="ct-head w-[120px] num">Total Fee</TableCell>}
											{visibleCols.agency_fee_pct && <TableCell className="ct-head w-[60px] num">%</TableCell>}
											{visibleCols.agency_fee_inr && <TableCell className="ct-head w-[120px] num">Agency Fee</TableCell>}
											{visibleCols.creator_fee && <TableCell className="ct-head w-[120px] num">Creator Fee</TableCell>}
											{visibleCols.billing_entity && <TableCell className="ct-head w-[200px]">Billing Entity</TableCell>}
											{visibleCols.brand && <TableCell className="ct-head w-[160px]">Brand</TableCell>}
											{visibleCols.campaign && <TableCell className="ct-head w-[200px]">Campaign</TableCell>}
											{visibleCols.deliverables && <TableCell className="ct-head w-[160px]">Deliverables</TableCell>}
											{visibleCols.ro_number && <TableCell className="ct-head w-[140px]">RO #</TableCell>}
										</>}
										{colGroups.finance_client && <>
											{visibleCols.client_invoice_number && <TableCell className="ct-head w-[130px]">Client Inv #</TableCell>}
											{visibleCols.client_invoice_date && <TableCell className="ct-head w-[100px]">Client Inv Date</TableCell>}
											{visibleCols.client_invoice_amount && <TableCell className="ct-head w-[120px] num">Client Inv Amt</TableCell>}
											{visibleCols.client_payment_status && <TableCell className="ct-head w-[90px]">Client Status</TableCell>}
											{visibleCols.client_payment_received_amount && <TableCell className="ct-head w-[120px] num">Client Recv</TableCell>}
											{visibleCols.client_payment_date && <TableCell className="ct-head w-[100px]">Client Pay Date</TableCell>}
										</>}
										{colGroups.finance_creator && <>
											{visibleCols.creator_invoice_number && <TableCell className="ct-head w-[130px]">Creator Inv #</TableCell>}
											{visibleCols.creator_invoice_date && <TableCell className="ct-head w-[100px]">Creator Inv Date</TableCell>}
											{visibleCols.creator_invoice_amount && <TableCell className="ct-head w-[120px] num">Creator Inv Amt</TableCell>}
											{visibleCols.creator_payment_status && <TableCell className="ct-head w-[90px]">Creator Status</TableCell>}
											{visibleCols.creator_payment_cycle && <TableCell className="ct-head w-[90px]">Pay Cycle</TableCell>}
											{visibleCols.creator_payment_date && <TableCell className="ct-head w-[100px]">Creator Pay Date</TableCell>}
										</>}
										{colGroups.status && <>
											{visibleCols.campaign_over && <TableCell className="ct-head w-[60px]" title="Campaign Over">Over</TableCell>}
											{visibleCols.invoice_received && <TableCell className="ct-head w-[70px]" title="Invoice Received">Inv</TableCell>}
											{visibleCols.payment_cleared && <TableCell className="ct-head w-[70px]" title="Payment Cleared by TCH">Pay Clr</TableCell>}
											{visibleCols.e_invoice_number && <TableCell className="ct-head w-[140px]">E-Invoice #</TableCell>}
											{visibleCols.payment_received && <TableCell className="ct-head w-[80px]" title="Payment Received by TCH">Pay Recv</TableCell>}
										</>}
										<TableCell className="ct-sticky-r ct-head w-[130px]">Actions</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{tableItems.map((item) => {
										if (item.kind === 'header') {
											return (
												<TableRow key={`grp-${item.key}`}>
													<TableCell colSpan={99} className="ct-cell" style={{ background: 'var(--n-bg-soft)', borderTop: '2px solid var(--n-border)' }}>
														<span className="font-semibold" style={{ color: 'var(--n-fg)' }}>{item.name}</span>
														<span className="ml-2 text-[12px]" style={{ color: 'var(--n-fg-muted)' }}>
															{item.count} deal{item.count === 1 ? '' : 's'} · Total ₹ {inr(item.total)} · Profit ₹ {inr(item.profit)}
														</span>
													</TableCell>
												</TableRow>
											);
										}
										const r = item.r;
										return (
											<TableRow key={r.id} className="ct-row">
											<TableCell className="ct-sticky-l1 ct-cell whitespace-nowrap">
												{r.confirmation_date ? (
													<span className="tabular-nums" style={{ color: 'var(--n-fg)' }}>
														{r.confirmation_date}
													</span>
												) : (
													<Tag tone="markup">no date</Tag>
												)}
											</TableCell>
											<TableCell className="ct-sticky-l2 ct-cell clip">
												{renderStickyGroupCell(r)}
											</TableCell>
											{colGroups.deal && <>
											{visibleCols.direction && (
											<TableCell className="ct-cell">
												<Tag tone={dirTone(r.direction)}>{r.direction}</Tag>
											</TableCell>
											)}
											{visibleCols.total_fee && (
											<TableCell
												className="ct-cell num font-semibold tabular-nums"
												style={{ color: 'var(--n-fg)' }}
											>
												{inr(r.total_fee)}
											</TableCell>
											)}
											{visibleCols.agency_fee_pct && (
											<TableCell className="ct-cell num" style={{ color: 'var(--n-fg-muted)' }}>
												{pctText(r.agency_fee_pct)}
											</TableCell>
											)}
											{visibleCols.agency_fee_inr && (
											<TableCell className="ct-cell num tabular-nums" style={{ color: '#1f6f43' }}>
												{inr(r.agency_fee_inr)}
											</TableCell>
											)}
											{visibleCols.creator_fee && (
											<TableCell
												className="ct-cell num tabular-nums"
												style={{ color: 'var(--n-fg-muted)' }}
											>
												{inr(r.creator_fee)}
											</TableCell>
											)}
											{visibleCols.billing_entity && (
											<TableCell className="ct-cell clip" title={r.billing_entity || undefined}>
												<span style={{ color: 'var(--n-fg)' }}>{r.billing_entity}</span>
												{r.billing_entity && isEmw(r.billing_entity) && (
													<Tag tone="emw" className="ml-1">
														EMW
													</Tag>
												)}
											</TableCell>
											)}
											{visibleCols.brand && (
											<TableCell className="ct-cell clip" title={r.brand || undefined} style={{ color: 'var(--n-fg)' }}>
												{r.brand}
											</TableCell>
											)}
											{visibleCols.campaign && (
											<TableCell className="ct-cell clip" title={r.campaign || undefined} style={{ color: 'var(--n-fg-muted)' }}>
												{r.campaign}
											</TableCell>
											)}
											{visibleCols.deliverables && (
											<TableCell className="ct-cell clip" title={r.deliverables || undefined} style={{ color: 'var(--n-fg-muted)' }}>
												{r.deliverables}
											</TableCell>
											)}
											{visibleCols.ro_number && (
											<TableCell
												className="ct-cell clip tabular-nums whitespace-nowrap"
												title={r.ro_number || undefined}
												style={{ color: 'var(--n-fg-muted)' }}
											>
												{r.ro_number}
											</TableCell>
											)}
										</>}
										{colGroups.finance_client && <>
											<TableCell className="ct-cell clip whitespace-nowrap" title={r.client_invoice_number || undefined} style={{ color: 'var(--n-fg-muted)' }}>
												{r.client_invoice_number}
											</TableCell>
											<TableCell className="ct-cell whitespace-nowrap tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
												{r.client_invoice_date}
											</TableCell>
											<TableCell className="ct-cell num tabular-nums" style={{ color: 'var(--n-fg)' }}>
												{Number(r.client_invoice_amount) > 0 ? inr(r.client_invoice_amount) : ''}
											</TableCell>
											<TableCell className="ct-cell">
												{r.client_payment_status === 'Received' ? (
													<Tag tone="yes">{r.client_payment_status}</Tag>
												) : r.client_payment_status === 'Overdue' ? (
													<Tag tone="no">{r.client_payment_status}</Tag>
												) : r.client_payment_status ? (
													<Tag tone="neutral">{r.client_payment_status}</Tag>
												) : null}
											</TableCell>
											<TableCell className="ct-cell num tabular-nums" style={{ color: '#0f7b6c' }}>
												{Number(r.client_payment_received_amount) > 0 ? inr(r.client_payment_received_amount) : ''}
											</TableCell>
											<TableCell className="ct-cell whitespace-nowrap tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
												{r.client_payment_date}
											</TableCell>
										</>}
										{colGroups.finance_creator && <>
											<TableCell className="ct-cell clip whitespace-nowrap" title={r.creator_invoice_number || undefined} style={{ color: 'var(--n-fg-muted)' }}>
												{r.creator_invoice_number}
											</TableCell>
											<TableCell className="ct-cell whitespace-nowrap tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
												{r.creator_invoice_date}
											</TableCell>
											<TableCell className="ct-cell num tabular-nums" style={{ color: 'var(--n-fg)' }}>
												{Number(r.creator_invoice_amount) > 0 ? inr(r.creator_invoice_amount) : ''}
											</TableCell>
											<TableCell className="ct-cell">
												{r.creator_payment_status === 'Paid' ? (
													<Tag tone="yes">{r.creator_payment_status}</Tag>
												) : r.creator_payment_status === 'Overdue' ? (
													<Tag tone="no">{r.creator_payment_status}</Tag>
												) : r.creator_payment_status ? (
													<Tag tone="neutral">{r.creator_payment_status}</Tag>
												) : null}
											</TableCell>
											<TableCell className="ct-cell" style={{ color: 'var(--n-fg-muted)' }}>
												{r.creator_payment_cycle ? r.creator_payment_cycle.replace('Net', 'Net ') : ''}
											</TableCell>
											<TableCell className="ct-cell whitespace-nowrap tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
												{r.creator_payment_date}
											</TableCell>
										</>}
										{colGroups.status && <>
											<TableCell className="ct-cell text-center">
												{r.campaign_over === 'Y' ? (
													<Tag tone="yes">Yes</Tag>
												) : r.campaign_over === 'N' ? (
													<Tag tone="no">No</Tag>
												) : null}
											</TableCell>
											<TableCell className="ct-cell text-center">
												{r.invoice_received === 'Y' ? (
													<Tag tone="yes">Yes</Tag>
												) : r.invoice_received === 'N' ? (
													<Tag tone="no">No</Tag>
												) : null}
											</TableCell>
											<TableCell className="ct-cell text-center">
												{r.payment_cleared === 'Y' ? (
													<Tag tone="yes">Yes</Tag>
												) : r.payment_cleared === 'N' ? (
													<Tag tone="no">No</Tag>
												) : null}
											</TableCell>
											<TableCell
												className="ct-cell clip tabular-nums whitespace-nowrap"
												title={r.e_invoice_number || undefined}
												style={{ color: 'var(--n-fg-muted)' }}
											>
												{r.e_invoice_number}
											</TableCell>
											<TableCell className="ct-cell text-center">
												{r.payment_received === 'Y' ? (
													<Tag tone="yes">Yes</Tag>
												) : r.payment_received === 'N' ? (
													<Tag tone="no">No</Tag>
												) : null}
											</TableCell>
										</>}
											<TableCell className="ct-sticky-r ct-cell">
												<div className="flex gap-1">
													<Button variant="primary" onClick={() => startEdit(r)}>
														Edit
													</Button>
													<Button variant="danger" onClick={() => remove(r)}>
														Del
													</Button>
												</div>
											</TableCell>
										</TableRow>
										);
									})}
									{filtered.length === 0 && (
										<TableRow>
											<TableCell
												className="ct-cell text-center py-6"
												style={{ color: 'var(--n-fg-subtle)' }}
												colSpan={99}
											>
												No campaigns match the current filters.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</TableContainer>
						<div className="tbl-caption">
							<span>
								Tip · Actions stay fixed on the right. Scroll horizontally to see more columns.
							</span>
						</div>
					</>
				)}
			</Box>

			<MuiDialog open={detail !== null} onClose={() => setDetail(null)} fullWidth maxWidth="md">
				<DialogTitle>
					{detail ? `${detail.brand || 'Campaign'}${detail.campaign ? ` · ${detail.campaign}` : ''}` : 'Campaign'}
				</DialogTitle>
				<DialogContent dividers>
					{detail && (
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
							<DetailField label="Brand" value={detail.brand} />
							<DetailField label="Brand POC" value={detail.brand_poc} />
							<DetailField label="Direction" value={detail.direction} />
							<DetailField label="Creators" value={creatorNamesOf(detail).join(', ') || '—'} />
							<DetailField label="TCH POC" value={detail.tch_poc} />
							<DetailField label="Billing Entity" value={detail.billing_entity} />
							<DetailField label="Total Fee" value={`₹ ${inr(detail.total_fee)}`} />
							<DetailField label="Agency Fee" value={`₹ ${inr(detail.agency_fee_inr)}`} />
							<DetailField label="Creator Fee" value={`₹ ${inr(detail.creator_fee)}`} />
							<DetailField label="Confirmation Date" value={detail.confirmation_date} />
							<DetailField label="Invoice Date" value={detail.e_invoice_date} />
							<DetailField label="E-Invoice #" value={detail.e_invoice_number} />
							<DetailField label="Campaign" value={detail.campaign} />
							<DetailField label="Campaign Status" value={detail.campaign_status} />
							<DetailField label="Deliverables" value={detail.deliverables} />
							<DetailField label="RO #" value={detail.ro_number} />

							{detail.creator_shares && detail.creator_shares.length > 1 && (
								<>
									<DetailSection title="Creator split" />
									{detail.creator_shares.map((s, i) => (
										<DetailField
											key={s.id ?? i}
											label={s.creator_name || s.creator_name_raw || `Creator ${i + 1}`}
											value={`Fee ₹ ${inr(s.total_fee)} · Agency ₹ ${inr(s.agency_fee_inr)}`}
										/>
									))}
								</>
							)}

							<DetailSection title="Client Invoice (TCH → Client)" />
							<DetailField label="Invoice #" value={detail.client_invoice_number} />
							<DetailField label="Invoice Date" value={detail.client_invoice_date} />
							<DetailField label="Invoice Amount" value={Number(detail.client_invoice_amount) > 0 ? `₹ ${inr(detail.client_invoice_amount)}` : '—'} />
							<DetailField label="Payment Status" value={detail.client_payment_status} />
							<DetailField label="Amount Received" value={Number(detail.client_payment_received_amount) > 0 ? `₹ ${inr(detail.client_payment_received_amount)}` : '—'} />
							<DetailField label="Payment Date" value={detail.client_payment_date} />

							<DetailSection title="Creator Invoice (Creator → TCH)" />
							<DetailField label="Invoice #" value={detail.creator_invoice_number} />
							<DetailField label="Invoice Date" value={detail.creator_invoice_date} />
							<DetailField label="Invoice Amount" value={Number(detail.creator_invoice_amount) > 0 ? `₹ ${inr(detail.creator_invoice_amount)}` : '—'} />
							<DetailField label="Payment Status" value={detail.creator_payment_status} />
							<DetailField label="Payment Cycle" value={detail.creator_payment_cycle ? detail.creator_payment_cycle.replace('Net', 'Net ') : ''} />
							<DetailField label="Payment Date" value={detail.creator_payment_date} />

							<DetailSection title="Status" />
							<DetailField label="Campaign Over" value={detail.campaign_over === 'Y' ? 'Yes' : detail.campaign_over === 'N' ? 'No' : '—'} />
							<DetailField label="Invoice Received" value={detail.invoice_received === 'Y' ? 'Yes' : detail.invoice_received === 'N' ? 'No' : '—'} />
							<DetailField label="Payment Cleared" value={detail.payment_cleared === 'Y' ? 'Yes' : detail.payment_cleared === 'N' ? 'No' : '—'} />
							<DetailField label="Payment Received" value={detail.payment_received === 'Y' ? 'Yes' : detail.payment_received === 'N' ? 'No' : '—'} />

							{detail.comments && (
								<>
									<DetailSection title="Comments" />
									<div className="col-span-full text-[14px]" style={{ color: 'var(--n-fg)' }}>{detail.comments}</div>
								</>
							)}
						</div>
					)}
				</DialogContent>
				<DialogActions>
					<MuiButton
						variant="outlined"
						color="error"
						onClick={() => {
							const d = detail;
							setDetail(null);
							if (d) remove(d);
						}}
						sx={{ textTransform: 'none', mr: 'auto' }}
					>
						Delete
					</MuiButton>
					<MuiButton variant="outlined" onClick={() => setDetail(null)} sx={{ textTransform: 'none' }}>
						Close
					</MuiButton>
					<MuiButton
						variant="contained"
						onClick={() => {
							const d = detail;
							setDetail(null);
							if (d) startEdit(d);
						}}
						sx={{ bgcolor: 'var(--n-accent)', textTransform: 'none', '&:hover': { bgcolor: '#380e44' } }}
					>
						Edit
					</MuiButton>
				</DialogActions>
			</MuiDialog>

			<MuiDialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
				<DialogTitle>{editing ? 'Edit Campaign' : 'Add Campaign'}</DialogTitle>
				<DialogContent dividers>
					{formError && (
						<Alert severity="error" sx={{ mb: 2, '& .MuiAlert-message': { fontSize: 13 } }}>
							{formError}
						</Alert>
					)}
					<div className="grid grid-cols-3 gap-3">
					<div>
						<TextField label="Confirmation Date" type="date" size="small" fullWidth value={form.confirmation_date} onChange={(e) => set('confirmation_date', e.target.value)} error={isMissing('confirmation_date')} helperText={reqHelper('confirmation_date')} sx={muiInputSx} slotProps={{ inputLabel: { shrink: true } }} />
					</div>
					<div>
						<TextField label="E-Invoice Date" type="date" size="small" fullWidth value={form.e_invoice_date} onChange={(e) => set('e_invoice_date', e.target.value)} helperText=" " sx={muiInputSx} slotProps={{ inputLabel: { shrink: true } }} />
					</div>
					<div>
						<TextField select label="Direction" size="small" fullWidth value={form.direction} onChange={(e) => {
							const dir = e.target.value;
							feeBasis.current = dir === 'MarkUp' ? 'inr' : 'pct';
							setForm((f) => recomputeFees({ ...f, direction: dir }));
						}} error={isMissing('direction')} helperText={reqHelper('direction')} sx={muiInputSx}>
							{DIRECTION.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
						</TextField>
					</div>

					<div className="col-span-3">
						<TextField select label="Creator (pick from master)" size="small" fullWidth value={form.creator} onChange={(e) => set('creator', e.target.value)} error={isMissing('creator')} helperText={reqHelper('creator')} sx={muiInputSx}>
							<MenuItem value="">— pick creator —</MenuItem>
							{creatorOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
						</TextField>
					</div>
					<div className="col-span-2">
						<TextField label="TCH POC (who worked on this)" size="small" fullWidth value={form.tch_poc} onChange={(e) => set('tch_poc', e.target.value)} placeholder="TCH person handling this deal" error={isMissing('tch_poc')} helperText={reqHelper('tch_poc')} sx={muiInputSx} />
					</div>
					<div />

					<div>
						<TextField label="Total Fee (INR)" type="number" size="small" fullWidth value={form.total_fee} onChange={(e) => { setFormError(null); setForm((f) => recomputeFees({ ...f, total_fee: e.target.value })); }} error={isMissing('total_fee')} helperText={reqHelper('total_fee')} sx={muiInputSx} slotProps={{ htmlInput: { step: '0.01' } }} />
					</div>
					<div>
						<TextField label="Agency Fee %" type="number" size="small" fullWidth placeholder="20 or 0.20 = 20%" value={form.agency_fee_pct} onChange={(e) => { setFormError(null); feeBasis.current = 'pct'; setForm((f) => recomputeFees({ ...f, agency_fee_pct: e.target.value })); }} error={isMissing('agency_fee_pct')} helperText={reqHelper('agency_fee_pct')} sx={muiInputSx} slotProps={{ htmlInput: { step: '0.0001' } }} />
					</div>
					<div>
						<TextField label="Agency Fee (INR)" type="number" size="small" fullWidth value={form.agency_fee_inr} onChange={(e) => { setFormError(null); feeBasis.current = 'inr'; setForm((f) => recomputeFees({ ...f, agency_fee_inr: e.target.value })); }} error={isMissing('agency_fee_inr')} helperText={reqHelper('agency_fee_inr')} sx={muiInputSx} slotProps={{ htmlInput: { step: '0.01' } }} />
					</div>
					<div className="col-span-2">
						<TextField label="Creator Fee (INR) — auto" type="number" size="small" fullWidth value={form.creator_fee} onChange={(e) => set('creator_fee', e.target.value)} error={isMissing('creator_fee')} helperText={reqHelper('creator_fee')} sx={muiInputSx} slotProps={{ htmlInput: { step: '0.01' } }} />
					</div>

					<div
						className="col-span-3 mt-1 pt-3"
						style={{ borderTop: '1px solid var(--n-border)' }}
					>
						<div className="flex items-center justify-between mb-2">
							<Label>
								Additional creators (split billing)
								{shares.length > 0 && (
									<span className="ml-2 font-normal" style={{ color: 'var(--n-fg-muted)' }}>
										Campaign total ₹ {inr(splitTotal)} · fields above are the 1st creator&apos;s
										share
									</span>
								)}
							</Label>
							<Button
								variant="outline"
								onClick={() => setShares((s) => [...s, { ...EMPTY_SHARE }])}
							>
								<Icon name="plus" size={13} /> Add creator
							</Button>
						</div>
						{shares.length === 0 ? (
							<p className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
								Single creator. Add creators here to split this campaign&apos;s billing across
								several people — each keeps their own fee, profit, and reporting.
							</p>
						) : (
							<div className="space-y-2">
								{shares.map((s, i) => (
									<div key={i} className="grid grid-cols-12 gap-2 items-center">
										<div className="col-span-6">
											<Select
												value={s.creator}
												onChange={(e) => updateShare(i, 'creator', e.target.value)}
												options={creatorOptions}
												placeholder="— pick creator —"
											/>
										</div>
										<div className="col-span-3">
											<Input
												type="number"
												step="0.01"
												placeholder="Their fee"
												value={s.total_fee}
												onChange={(e) => updateShare(i, 'total_fee', e.target.value)}
											/>
										</div>
										<div className="col-span-2">
											<Input
												type="number"
												step="0.01"
												placeholder="Agency ₹"
												value={s.agency_fee_inr}
												onChange={(e) => updateShare(i, 'agency_fee_inr', e.target.value)}
											/>
										</div>
										<div className="col-span-1 flex justify-end">
											<Button variant="danger" onClick={() => removeShare(i)}>
												×
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					<div>
						<TextField label="Billing Entity" size="small" fullWidth value={form.billing_entity} onChange={(e) => set('billing_entity', e.target.value)} placeholder="Pick or type — EMW / MSL Group / …" error={isMissing('billing_entity')} helperText={reqHelper('billing_entity')} sx={muiInputSx} />
					</div>
					<div>
						<TextField label="Brand" size="small" fullWidth value={form.brand} onChange={(e) => set('brand', e.target.value)} error={isMissing('brand')} helperText={reqHelper('brand')} sx={muiInputSx} />
					</div>
					<div>
						<TextField label="Brand POC" size="small" fullWidth value={form.brand_poc} onChange={(e) => set('brand_poc', e.target.value)} placeholder="Brand-side contact" error={isMissing('brand_poc')} helperText={reqHelper('brand_poc')} sx={muiInputSx} />
					</div>
					<div>
						<Autocomplete
							freeSolo
							size="small"
							options={campaigns.map((c) => c.name)}
							value={form.campaign}
							onInputChange={(_, value) => set('campaign', value)}
							renderInput={(params) => (
								<TextField
									{...params}
									label="Campaign (pick or create)"
									error={isMissing('campaign')}
									helperText={reqHelper('campaign')}
									sx={muiInputSx}
								/>
							)}
						/>
						{suggestedCampaignName && suggestedCampaignName !== form.campaign && (
							<button
								type="button"
								onClick={() => set('campaign', suggestedCampaignName)}
								className="mt-1 text-[12px] underline decoration-dotted hover:no-underline"
								style={{ color: 'var(--n-accent)' }}
							>
								Use suggested: {suggestedCampaignName}
							</button>
						)}
					</div>

					<div className="col-span-2">
						<TextField label="Deliverables" size="small" fullWidth value={form.deliverables} onChange={(e) => set('deliverables', e.target.value)} error={isMissing('deliverables')} helperText={reqHelper('deliverables')} sx={muiInputSx} />
					</div>
					<div>
						<TextField label="RO Number" size="small" fullWidth value={form.ro_number} onChange={(e) => set('ro_number', e.target.value)} error={isMissing('ro_number')} helperText={reqHelper('ro_number')} sx={muiInputSx} />
					</div>

					<div>
						<TextField select label="Campaign Over" size="small" fullWidth value={form.campaign_over} onChange={(e) => set('campaign_over', e.target.value)} error={isMissing('campaign_over')} helperText={reqHelper('campaign_over')} sx={muiInputSx}>
							<MenuItem value="">—</MenuItem>{YN.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
						</TextField>
					</div>
					<div>
						<TextField select label="Invoice Received" size="small" fullWidth value={form.invoice_received} onChange={(e) => set('invoice_received', e.target.value)} error={isMissing('invoice_received')} helperText={reqHelper('invoice_received')} sx={muiInputSx}>
							<MenuItem value="">—</MenuItem>{YN.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
						</TextField>
					</div>
					<div>
						<TextField select label="Payment Cleared by TCH" size="small" fullWidth value={form.payment_cleared} onChange={(e) => set('payment_cleared', e.target.value)} error={isMissing('payment_cleared')} helperText={reqHelper('payment_cleared')} sx={muiInputSx}>
							<MenuItem value="">—</MenuItem>{YN.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
						</TextField>
					</div>
					<div>
						<TextField label="E-Invoice # (TCH to Client)" size="small" fullWidth value={form.e_invoice_number} onChange={(e) => set('e_invoice_number', e.target.value)} error={isMissing('e_invoice_number')} helperText={reqHelper('e_invoice_number')} sx={muiInputSx} />
					</div>
					<div>
						<TextField select label="Payment Received by TCH" size="small" fullWidth value={form.payment_received} onChange={(e) => set('payment_received', e.target.value)} error={isMissing('payment_received')} helperText={reqHelper('payment_received')} sx={muiInputSx}>
							<MenuItem value="">—</MenuItem>{YN.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
						</TextField>
					</div>
					<div />

					<div className="col-span-3 border-t pt-3 mt-1" style={{ borderColor: 'var(--n-border)' }}>
						<div className="text-[12px] font-semibold uppercase mb-2" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}>
							Client Invoice (TCH → Client)
						</div>
					</div>
					<div>
						<Label>Invoice Number</Label>
						<Input
							value={form.client_invoice_number}
							onChange={(e) => set('client_invoice_number', e.target.value)}
						/>
					</div>
					<div>
						<Label>Invoice Date</Label>
						<Input
							type="date"
							value={form.client_invoice_date}
							onChange={(e) => set('client_invoice_date', e.target.value)}
						/>
					</div>
					<div>
						<Label>Invoice Amount (INR)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.client_invoice_amount}
							onChange={(e) => set('client_invoice_amount', e.target.value)}
						/>
					</div>
					<div>
						<Label>Payment Status</Label>
						<Select
							value={form.client_payment_status}
							onChange={(e) => set('client_payment_status', e.target.value)}
							options={CLIENT_PAY_STATUS}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Amount Received (INR)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.client_payment_received_amount}
							onChange={(e) => set('client_payment_received_amount', e.target.value)}
						/>
					</div>
					<div>
						<Label>Payment Date</Label>
						<Input
							type="date"
							value={form.client_payment_date}
							onChange={(e) => set('client_payment_date', e.target.value)}
						/>
					</div>

					<div className="col-span-3 border-t pt-3 mt-1" style={{ borderColor: 'var(--n-border)' }}>
						<div className="text-[12px] font-semibold uppercase mb-2" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}>
							Creator Invoice (Creator → TCH)
						</div>
					</div>
					<div>
						<Label>Invoice Number</Label>
						<Input
							value={form.creator_invoice_number}
							onChange={(e) => set('creator_invoice_number', e.target.value)}
						/>
					</div>
					<div>
						<Label>Invoice Date</Label>
						<Input
							type="date"
							value={form.creator_invoice_date}
							onChange={(e) => set('creator_invoice_date', e.target.value)}
						/>
					</div>
					<div>
						<Label>Invoice Amount (INR)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.creator_invoice_amount}
							onChange={(e) => set('creator_invoice_amount', e.target.value)}
						/>
					</div>
					<div>
						<Label>Payment Status</Label>
						<Select
							value={form.creator_payment_status}
							onChange={(e) => set('creator_payment_status', e.target.value)}
							options={CREATOR_PAY_STATUS}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Payment Cycle</Label>
						<Select
							value={form.creator_payment_cycle}
							onChange={(e) => set('creator_payment_cycle', e.target.value)}
							options={PAY_CYCLES}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Payment Date</Label>
						<Input
							type="date"
							value={form.creator_payment_date}
							onChange={(e) => set('creator_payment_date', e.target.value)}
						/>
					</div>

					<div className="col-span-3">
						<Label>Comments</Label>
						<Textarea
							value={form.comments}
							onChange={(e) => set('comments', e.target.value)}
						/>
					</div>
					</div>
				</DialogContent>
				<DialogActions>
					<MuiButton variant="outlined" onClick={() => setOpen(false)} sx={{ textTransform: 'none' }}>
						Cancel
					</MuiButton>
					<MuiButton variant="contained" onClick={submit} sx={{ bgcolor: 'var(--n-accent)', textTransform: 'none', '&:hover': { bgcolor: '#380e44' } }}>
						{editing ? 'Save' : 'Create'}
					</MuiButton>
				</DialogActions>
			</MuiDialog>
		</>
	);
}
