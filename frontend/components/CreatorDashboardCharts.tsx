'use client';

import type { CreatorDashboard } from '@/lib/api';
import { inr } from '@/lib/utils';

const COLORS: Record<string, string> = {
	Paid: '#0d9070', Pending: '#d97706', Scheduled: '#2563eb', Overdue: '#dc2626', 'Not set': '#9b9a97'
};
const paymentLabel = (status: string) => status === 'Not set' ? 'Awaiting update' : status;

export function CreatorFinancialTrend({ months }: { months: CreatorDashboard['months'] }) {
	const max = Math.max(1, ...months.flatMap((month) => [Number(month.billing), Number(month.creator_fee)]));
	const barHeight = (value: string) => Number(value) > 0 ? `${Math.max(3, Number(value) / max * 100)}%` : '0%';
	return <section className="rounded-xl border p-5" style={{ borderColor: 'var(--n-border)' }} aria-labelledby="creator-financial-performance">
		<div className="mb-5"><h2 id="creator-financial-performance" className="text-[19px] font-semibold leading-tight">Financial performance</h2><p className="mt-1.5 text-[12px] leading-relaxed text-[var(--n-fg-muted)]">Monthly billing, creator cost, and agency margin.</p></div>
		<div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] font-medium text-[var(--n-fg-muted)]"><span>● Billing</span><span className="text-amber-700">● Creator fee</span><span className="text-emerald-700">● Margin</span></div>
		<div className="overflow-x-auto pb-1"><div className="flex h-56 min-w-[680px] items-end gap-2 border-b" style={{ borderColor: 'var(--n-border)' }}>
			{months.map((month) => <div key={month.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 h-full" title={`${month.label}: Billing ₹${inr(month.billing) || '0'}, Creator fee ₹${inr(month.creator_fee) || '0'}, Margin ₹${inr(month.margin) || '0'}`}>
				<div className="flex w-full max-w-12 items-end justify-center gap-[2px] flex-1">
					<div className="w-2 rounded-t bg-blue-600" style={{ height: barHeight(month.billing) }} />
					<div className="w-2 rounded-t bg-amber-500" style={{ height: barHeight(month.creator_fee) }} />
					<div className="w-2 rounded-t bg-emerald-600" style={{ height: barHeight(month.margin) }} />
				</div><span className="text-[11px] font-medium text-[var(--n-fg-muted)]">{month.label}</span>
			</div>)}
		</div></div>
	</section>;
}

export function CreatorPaymentChart({ rows }: { rows: CreatorDashboard['payment_statuses'] }) {
	const total = rows.reduce((sum, row) => sum + row.count, 0);
	let cursor = 0;
	const gradient = rows.map((row) => { const start = cursor; cursor += total ? row.count / total * 100 : 0; return `${COLORS[row.status] || COLORS['Not set']} ${start}% ${cursor}%`; }).join(', ');
	return <section className="rounded-xl border p-5" style={{ borderColor: 'var(--n-border)' }} aria-labelledby="creator-payment-health">
		<h2 id="creator-payment-health" className="text-[19px] font-semibold leading-tight">Payment health</h2><p className="mt-1.5 text-[12px] leading-relaxed text-[var(--n-fg-muted)]">Creator payment status by campaign.</p>
		<div className="my-5 flex justify-center"><div className="grid h-36 w-36 place-items-center rounded-full" style={{ background: total ? `conic-gradient(${gradient})` : 'var(--n-border)' }}><div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><div><div className="text-2xl font-semibold">{total}</div><div className="text-[10px] text-[var(--n-fg-subtle)]">campaigns</div></div></div></div></div>
		<div className="space-y-2.5">{rows.map((row) => <div key={row.status} className="flex items-center text-[12px]"><span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ background: COLORS[row.status] || COLORS['Not set'] }} /><span>{paymentLabel(row.status)}</span><span className="ml-auto tabular-nums">{row.count} · ₹{inr(row.amount) || '0'}</span></div>)}</div>
	</section>;
}

export function CreatorBrandChart({ rows }: { rows: CreatorDashboard['brands'] }) {
	return <section className="flex h-[910px] flex-col rounded-xl border p-5" style={{ borderColor: 'var(--n-border)' }} aria-labelledby="creator-brand-portfolio">
		<div className="shrink-0"><h2 id="creator-brand-portfolio" className="text-[19px] font-semibold leading-tight">Brand portfolio</h2><p className="mt-1.5 text-[12px] leading-relaxed text-[var(--n-fg-muted)]">Brand contribution, campaign activity, and creator payment health.</p></div>
		{rows.length ? <div className="mt-5 flex-1 overflow-y-auto pr-2 flex flex-col gap-3">{rows.map((row) => {
			const share = Number(row.billing_share) * 100;
			const billing = Number(row.billing);
			const creatorFee = Number(row.creator_fee);
			const margin = Number(row.margin);
			const paidPct = creatorFee > 0 ? Math.min(100, Number(row.paid) / creatorFee * 100) : 0;
			const creatorPct = billing > 0 ? Math.min(100, creatorFee / billing * 100) : 0;
			const marginPct = billing > 0 ? Math.min(100 - creatorPct, margin / billing * 100) : 0;
			const otherPct = Math.max(0, 100 - creatorPct - marginPct);
			const latest = new Date(`${row.last_period}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
			return <article key={row.name} className="relative overflow-hidden rounded-xl border p-5" style={{ borderColor: 'var(--n-border)', background: 'var(--n-bg)' }}>
				<div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0"><h3 className="truncate text-[18px] font-bold" title={row.name}>{row.name}</h3><p className="mt-1 text-[12px] leading-relaxed text-[var(--n-fg-muted)]">{row.count} {row.count === 1 ? 'campaign' : 'campaigns'} · Latest {latest}</p></div>
					<div className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700">{share.toFixed(0)}% share</div>
				</div>
				<div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
					<div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#f59e0b 0 ${creatorPct}%, #0d9070 ${creatorPct}% ${creatorPct + marginPct}%, #d1d5db ${creatorPct + marginPct}% 100%)` }} aria-label={`Financial split: creator payout ${creatorPct.toFixed(0)}%, agency margin ${marginPct.toFixed(0)}%, other ${otherPct.toFixed(0)}%`}>
						<div className="grid h-[82px] w-[82px] place-items-center rounded-full bg-white text-center"><div><div className="text-[15px] font-bold tabular-nums">₹{inr(row.billing) || '0'}</div><div className="text-[9px] font-medium uppercase tracking-wider text-[var(--n-fg-muted)]">Total billing</div></div></div>
					</div>
					<div className="w-full min-w-0 space-y-3 text-[12px]">
						<div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-amber-500" /><span className="truncate text-[var(--n-fg-muted)]">Creator payout</span><span className="ml-auto shrink-0 font-semibold tabular-nums text-[12px]">₹{inr(row.creator_fee) || '0'}</span></div>
						<div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-emerald-700" /><span className="truncate text-[var(--n-fg-muted)]">Agency margin</span><span className="ml-auto shrink-0 font-semibold tabular-nums text-[12px]">₹{inr(row.margin) || '0'}</span></div>
						{otherPct > 0.5 && <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-gray-300" /><span className="truncate text-[var(--n-fg-muted)]">Other allocation</span><span className="ml-auto shrink-0 font-semibold tabular-nums text-[12px]">{otherPct.toFixed(0)}%</span></div>}
					</div>
				</div>
				<div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--n-border)' }}>
					<div className="flex items-center justify-between text-[12px]"><span className="font-medium text-[var(--n-fg-muted)]">Creator payment progress</span><span className="font-bold tabular-nums">{paidPct.toFixed(0)}% paid</span></div>
					<div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${paidPct}%` }} /></div>
					<div className="mt-2 flex justify-between text-[12px]"><span className="text-[var(--n-fg-muted)]">Paid ₹{inr(row.paid) || '0'}</span><span className="font-bold text-amber-700">Outstanding ₹{inr(row.outstanding) || '0'}</span></div>
				</div>
			</article>;
		})}</div> : <div className="mt-5 rounded border border-dashed p-6 text-center text-[12px] text-[var(--n-fg-muted)]">No brand activity in this fiscal year.</div>}
	</section>;
}
