'use client';

import * as React from 'react';
import { api, type CreatorInsights, type CreatorInsight, type SocialMediaSnapshot, type EventInvite, type Creator } from '@/lib/api';
import { inr } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import Textarea from '@/components/ui/Textarea';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import { useFiscalYear } from '@/lib/fiscal-year';

type RelFilter = 'All' | 'Exclusive' | 'Friend' | 'Dropping' | 'NonTCH';
const REL_FILTERS: RelFilter[] = ['All', 'Exclusive', 'Friend', 'Dropping', 'NonTCH'];

function fyLabelFor(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

function relTone(rel: string) {
	if (rel === 'Exclusive') return 'exclusive' as const;
	if (rel === 'Dropping') return 'dropping' as const;
	if (rel === 'NonTCH') return 'nontch' as const;
	return 'friend' as const;
}

function pct(s: string): string {
	const n = Number(s);
	if (!Number.isFinite(n) || n === 0) return '0%';
	return `${(n * 100).toFixed(1)}%`;
}

function formatDate(s: string | null): string {
	if (!s) return '—';
	const d = new Date(s);
	return d.toLocaleDateString('en-IN', {
		day: '2-digit',
		month: 'short',
		year: '2-digit'
	});
}

function spanDays(first: string | null, last: string | null): string {
	if (!first || !last) return '—';
	const f = new Date(first).getTime();
	const l = new Date(last).getTime();
	const days = Math.max(0, Math.round((l - f) / (1000 * 60 * 60 * 24)));
	if (days === 0) return 'same day';
	if (days < 30) return `${days} days`;
	if (days < 365) return `${Math.round(days / 30)} mo`;
	return `${(days / 365).toFixed(1)} yr`;
}

function maxMonthly(c: CreatorInsight): number {
	let m = 0;
	for (const v of Object.values(c.by_month)) {
		const n = Number(v);
		if (n > m) m = n;
	}
	return m;
}

export default function InsightsPage() {
	const { fyStart } = useFiscalYear();
	const [data, setData] = React.useState<CreatorInsights | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [q, setQ] = React.useState('');
	const [relFilter, setRelFilter] = React.useState<RelFilter>('All');
	const [creators, setCreators] = React.useState<Creator[]>([]);
	const [expanded, setExpanded] = React.useState<number | string | null>(null);
	const [snapshots, setSnapshots] = React.useState<SocialMediaSnapshot[]>([]);
	const [events, setEvents] = React.useState<EventInvite[]>([]);

	// Snapshot dialog
	const [snapOpen, setSnapOpen] = React.useState(false);
	const [snapForm, setSnapForm] = React.useState({
		creator: '', snapshot_type: 'Quarterly', snapshot_date: '', platform: 'Instagram',
		followers: '', engagement_rate: '', estimated_reach: '', revenue_last_3m: '', notes: ''
	});
	const [snapEditing, setSnapEditing] = React.useState<SocialMediaSnapshot | null>(null);

	// Event dialog
	const [evtOpen, setEvtOpen] = React.useState(false);
	const [evtForm, setEvtForm] = React.useState({
		creator: '', event_name: '', event_date: '', invited_date: '', response: '', notes: ''
	});
	const [evtEditing, setEvtEditing] = React.useState<EventInvite | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const [fresh, crs, snaps, evts] = await Promise.all([
				api.get<CreatorInsights>(`/creator-insights/?fy=${fyStart}`),
				api.get<Creator[]>('/creators/'),
				api.get<SocialMediaSnapshot[]>('/social-snapshots/'),
				api.get<EventInvite[]>('/event-invites/'),
			]);
			setData(fresh);
			setCreators(crs);
			setSnapshots(snaps);
			setEvents(evts);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, [fyStart]);

	React.useEffect(() => {
		load();
	}, [load]);

	// When arriving from the Creator Pipeline (?focus=<name>), pre-filter the
	// table to that creator. Read from window so we don't need a Suspense
	// boundary around useSearchParams at build time.
	React.useEffect(() => {
		const focus = new URLSearchParams(window.location.search).get('focus');
		if (focus) setQ(focus);
	}, []);

	const filtered = React.useMemo(() => {
		if (!data) return [];
		const needle = q.trim().toLowerCase();
		return data.creators.filter((c) => {
			if (relFilter !== 'All' && c.relationship !== relFilter) return false;
			if (!needle) return true;
			return (
				c.creator_name.toLowerCase().includes(needle) ||
				c.category.toLowerCase().includes(needle) ||
				c.top_brands.some((b) => b.toLowerCase().includes(needle))
			);
		});
	}, [data, q, relFilter]);

	function creatorSnaps(creatorId: number | null, name: string) {
		if (creatorId) return snapshots.filter((s) => s.creator === creatorId);
		return snapshots.filter((s) => s.creator_name === name);
	}
	function creatorEvents(creatorId: number | null, name: string) {
		if (creatorId) return events.filter((e) => e.creator === creatorId);
		return events.filter((e) => e.creator_name === name);
	}

	function openSnapAdd(creatorId: number) {
		setSnapEditing(null);
		setSnapForm({
			creator: String(creatorId), snapshot_type: 'Quarterly',
			snapshot_date: new Date().toISOString().slice(0, 10), platform: 'Instagram',
			followers: '', engagement_rate: '', estimated_reach: '', revenue_last_3m: '', notes: ''
		});
		setSnapOpen(true);
	}
	function openSnapEdit(s: SocialMediaSnapshot) {
		setSnapEditing(s);
		setSnapForm({
			creator: String(s.creator), snapshot_type: s.snapshot_type,
			snapshot_date: s.snapshot_date, platform: s.platform,
			followers: String(s.followers), engagement_rate: s.engagement_rate,
			estimated_reach: String(s.estimated_reach), revenue_last_3m: s.revenue_last_3m, notes: s.notes
		});
		setSnapOpen(true);
	}
	async function submitSnap() {
		const payload = {
			...snapForm, creator: Number(snapForm.creator),
			followers: Number(snapForm.followers) || 0,
			estimated_reach: Number(snapForm.estimated_reach) || 0,
			engagement_rate: snapForm.engagement_rate || '0',
			revenue_last_3m: snapForm.revenue_last_3m || '0',
		};
		try {
			if (snapEditing) await api.patch(`/social-snapshots/${snapEditing.id}/`, payload);
			else await api.post('/social-snapshots/', payload);
			setSnapOpen(false);
			await load();
		} catch (e) { alert((e as Error).message); }
	}
	async function deleteSnap(id: number) {
		if (!confirm('Delete this snapshot?')) return;
		await api.del(`/social-snapshots/${id}/`);
		await load();
	}

	function openEvtAdd(creatorId: number) {
		setEvtEditing(null);
		setEvtForm({
			creator: String(creatorId), event_name: '',
			event_date: new Date().toISOString().slice(0, 10), invited_date: '', response: '', notes: ''
		});
		setEvtOpen(true);
	}
	function openEvtEdit(e: EventInvite) {
		setEvtEditing(e);
		setEvtForm({
			creator: String(e.creator), event_name: e.event_name,
			event_date: e.event_date, invited_date: e.invited_date ?? '', response: e.response, notes: e.notes
		});
		setEvtOpen(true);
	}
	async function submitEvt() {
		const payload = {
			...evtForm, creator: Number(evtForm.creator),
			invited_date: evtForm.invited_date || null,
		};
		try {
			if (evtEditing) await api.patch(`/event-invites/${evtEditing.id}/`, payload);
			else await api.post('/event-invites/', payload);
			setEvtOpen(false);
			await load();
		} catch (e) { alert((e as Error).message); }
	}
	async function deleteEvt(id: number) {
		if (!confirm('Delete this event invite?')) return;
		await api.del(`/event-invites/${id}/`);
		await load();
	}

	return (
		<>
		<section className="space-y-6">
			<header className="space-y-2">
				<div
					className="text-[12px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
				>
					Workspace · Creator Insights · {fyLabelFor(fyStart)}
				</div>
				<h1
					className="page-title text-[40px] leading-[1.15] font-bold"
					style={{ color: 'var(--n-fg)' }}
				>
					Per-Creator Campaign Insights
				</h1>
				<p className="text-[15px] max-w-[680px]" style={{ color: 'var(--n-fg-muted)' }}>
					Lifetime-in-FY view per creator: deal mix, billing & profit, brand and deliverable
					patterns, activity timeline. Derived from Commercial Tracking. Sorted by billing.
				</p>
			</header>

			<div
				className="flex flex-wrap items-center gap-2 pb-3"
				style={{ borderBottom: '1px solid var(--n-border)' }}
			>
				<div className="relative flex-1 min-w-[260px]">
					<span
						className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
						style={{ color: 'var(--n-fg-subtle)' }}
					>
						<Icon name="search" size={14} />
					</span>
					<input
						type="text"
						placeholder="Search creator, category, brand…"
						className="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
						value={q}
						onChange={(e) => setQ(e.target.value)}
					/>
				</div>
				<div className="seg-toggle">
					{REL_FILTERS.map((f) => (
						<button
							key={f}
							type="button"
							className={cn(relFilter === f && 'active')}
							onClick={() => setRelFilter(f)}
						>
							{f === 'NonTCH' ? 'Non TCH' : f}
						</button>
					))}
				</div>
				<div className="ml-auto flex items-center gap-2">
					<Button variant="ghost" onClick={load}>
						<Icon name="refresh" size={14} /> Refresh
					</Button>
				</div>
			</div>

			{!loading && !error && data && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Creators
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{filtered.length}
							<span className="text-[14px]" style={{ color: 'var(--n-fg-subtle)' }}>
								&nbsp;/ {data.creator_count}
							</span>
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Deals (FY)
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{data.grand_total_deals}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Total Billing
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							₹ {inr(data.grand_total_billing)}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							<span className="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]" />
							TCH Profit
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							₹ {inr(data.grand_total_profit)}
						</div>
					</div>
				</div>
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
			) : data ? (
				filtered.length === 0 ? (
					<div
						className="rounded p-8 text-center text-[14px]"
						style={{ border: '1px dashed var(--n-border)', color: 'var(--n-fg-subtle)' }}
					>
						No creators match the current filters.
					</div>
				) : (
					<div className="space-y-3">
						{filtered.map((c) => {
							const max = maxMonthly(c);
							return (
								<article
									key={c.creator_id ?? c.creator_name}
									className="rounded-md p-5 border border-[var(--n-border)] bg-[var(--n-bg)] shadow-[0_1px_2px_rgba(15,15,15,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[#a96b50] hover:shadow-[0_4px_18px_rgba(169,107,80,0.12)]"
								>
									<div className="flex items-start justify-between gap-3 flex-wrap">
										<div className="space-y-1 min-w-0">
											<div className="flex items-center gap-2 flex-wrap">
												<h2
													className="page-title text-[22px] font-semibold leading-tight"
													style={{ color: 'var(--n-fg)' }}
												>
													{c.creator_name}
												</h2>
												<Tag tone={relTone(c.relationship)}>
													{c.relationship === 'NonTCH' ? 'Non TCH' : c.relationship}
												</Tag>
											</div>
											<div
												className="text-[13px] flex flex-wrap gap-x-3 gap-y-1"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												{c.category && <span>{c.category}</span>}
												{c.ops_manager && (
													<>
														<span>·</span>
														<span>Ops: {c.ops_manager}</span>
													</>
												)}
												{c.top_billing_entity && (
													<>
														<span>·</span>
														<span>
															Bills mostly via{' '}
															<strong
																style={{ color: 'var(--n-fg-muted)', fontWeight: 500 }}
															>
																{c.top_billing_entity}
															</strong>
														</span>
													</>
												)}
											</div>
										</div>
									</div>

									<div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-3">
										<div>
											<div
												className="text-[11px] font-medium uppercase"
												style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
											>
												Deals
											</div>
											<div
												className="text-[18px] font-semibold tabular-nums mt-0.5"
												style={{ color: 'var(--n-fg)' }}
											>
												{c.total_count}
											</div>
											<div
												className="text-[12px] mt-0.5"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												{c.inbound_count} in · {c.outbound_count} out
												{c.markup_count ? ` · ${c.markup_count} mu` : ''}
											</div>
										</div>

										<div>
											<div
												className="text-[11px] font-medium uppercase"
												style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
											>
												Billing
											</div>
											<div
												className="text-[18px] font-semibold tabular-nums mt-0.5"
												style={{ color: 'var(--n-fg)' }}
											>
												₹ {inr(c.total_billing)}
											</div>
											<div
												className="text-[12px] mt-0.5"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												avg ₹ {inr(c.avg_deal_size)}
											</div>
										</div>

										<div>
											<div
												className="text-[11px] font-medium uppercase flex items-center gap-1"
												style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
											>
												<span className="h-1 w-1 rounded-full bg-[#0f7b6c]" />
												TCH Profit
											</div>
											<div
												className="text-[18px] font-semibold tabular-nums mt-0.5"
												style={{ color: '#1f6f43' }}
											>
												₹ {inr(c.total_profit)}
											</div>
											<div
												className="text-[12px] mt-0.5"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												{pct(c.profit_margin)} margin
											</div>
										</div>

										<div>
											<div
												className="text-[11px] font-medium uppercase"
												style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
											>
												Activity
											</div>
											<div
												className="text-[14px] font-medium tabular-nums mt-0.5"
												style={{ color: 'var(--n-fg)' }}
											>
												{formatDate(c.first_date)} → {formatDate(c.last_date)}
											</div>
											<div
												className="text-[12px] mt-0.5"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												{spanDays(c.first_date, c.last_date)} · {c.months_active} active mo
											</div>
										</div>

										<div>
											<div
												className="text-[11px] font-medium uppercase"
												style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
											>
												Brands
											</div>
											<div
												className="text-[18px] font-semibold tabular-nums mt-0.5"
												style={{ color: 'var(--n-fg)' }}
											>
												{c.brand_count}
											</div>
											<div
												className="text-[12px] mt-0.5"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												{c.repeat_brands.length} repeat
											</div>
										</div>

										<div>
											<div
												className="text-[11px] font-medium uppercase"
												style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
											>
												Status
											</div>
											<div
												className="text-[14px] font-medium tabular-nums mt-0.5"
												style={{ color: 'var(--n-fg)' }}
											>
												{c.over_count}/{c.total_count} done
											</div>
											<div
												className="text-[12px] mt-0.5"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												{c.paid_count} paid
											</div>
										</div>
									</div>

									{data.months.length > 0 && (
										<div className="mt-5">
											<div
												className="text-[11px] font-medium uppercase mb-2 flex items-center justify-between"
												style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
											>
												<span>Monthly billing</span>
												<span
													className="font-normal normal-case"
													style={{ color: 'var(--n-fg-subtle)' }}
												>
													{max > 0 ? `peak ₹ ${inr(String(max))}` : 'no monthly data'}
												</span>
											</div>
											<div className="flex items-end gap-1 h-14">
												{data.months.map((m) => {
													const v = Number(c.by_month[m.key] || 0);
													const h =
														max > 0 ? Math.max(2, Math.round((v / max) * 52) + 2) : 2;
													return (
														<div
															key={m.key}
															className="relative flex-1 group cursor-default"
														>
															<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-md text-white bg-[#8a4a32]">
																{m.label}: {v > 0 ? `₹ ${inr(String(v))}` : '—'}
															</div>
															<div
																className={cn(
																	'w-full rounded-sm transition-[opacity,background-color] duration-150',
																	v > 0
																		? 'opacity-70 bg-[var(--n-fg-muted)] group-hover:opacity-100 group-hover:bg-[#a96b50]'
																		: 'opacity-50 bg-[var(--n-border)] group-hover:opacity-80 group-hover:bg-[#d9c2b3]'
																)}
																style={{ height: `${h}px` }}
															/>
														</div>
													);
												})}
											</div>
											<div className="flex gap-1 mt-1.5">
												{data.months.map((m) => (
													<div
														key={m.key}
														className="flex-1 text-center text-[10px] tabular-nums"
														style={{ color: 'var(--n-fg-subtle)' }}
													>
														{m.label[0]}
													</div>
												))}
											</div>
										</div>
									)}

									{(c.top_brands.length > 0 ||
										c.repeat_brands.length > 0 ||
										c.common_deliverable) && (
										<div
											className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4"
											style={{ borderTop: '1px solid var(--n-border)' }}
										>
											{c.top_brands.length > 0 && (
												<div>
													<div
														className="text-[11px] font-medium uppercase mb-2"
														style={{
															color: 'var(--n-fg-subtle)',
															letterSpacing: '0.04em'
														}}
													>
														Top brands
													</div>
													<div className="flex flex-wrap gap-1.5">
														{c.top_brands.map((b) => (
															<Tag key={b} tone="neutral">
																{b}
															</Tag>
														))}
													</div>
												</div>
											)}

											{c.repeat_brands.length > 0 && (
												<div>
													<div
														className="text-[11px] font-medium uppercase mb-2"
														style={{
															color: 'var(--n-fg-subtle)',
															letterSpacing: '0.04em'
														}}
													>
														Repeat brands
													</div>
													<div className="flex flex-wrap gap-1.5">
														{c.repeat_brands.map((b) => (
															<Tag key={b} tone="accent">
																{b}
															</Tag>
														))}
													</div>
												</div>
											)}

											{c.common_deliverable && (
												<div>
													<div
														className="text-[11px] font-medium uppercase mb-2"
														style={{
															color: 'var(--n-fg-subtle)',
															letterSpacing: '0.04em'
														}}
													>
														Common deliverable
													</div>
													<div
														className="text-[13.5px]"
														style={{ color: 'var(--n-fg-muted)' }}
													>
														{c.common_deliverable}
													</div>
												</div>
											)}
										</div>
									)}
									{/* Expand toggle */}
									<div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--n-border)' }}>
										<button
											type="button"
											className="text-[12px] font-medium uppercase flex items-center gap-1"
											style={{ color: 'var(--n-accent)', letterSpacing: '0.04em' }}
											onClick={() => setExpanded(expanded === (c.creator_id ?? c.creator_name) ? null : (c.creator_id ?? c.creator_name))}
										>
											<Icon name={expanded === (c.creator_id ?? c.creator_name) ? 'chevron-down' : 'chevron-right'} size={14} />
											Social Media &amp; Events
										</button>
									</div>

									{expanded === (c.creator_id ?? c.creator_name) && c.creator_id && (
										<div className="mt-4 space-y-5">
											{/* Social Media Snapshots */}
											<div>
												<div className="flex items-center justify-between mb-2">
													<div className="text-[11px] font-medium uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
														Social Media Snapshots
													</div>
													<Button variant="outline" onClick={() => openSnapAdd(c.creator_id!)}>
														<Icon name="plus" size={13} /> Add Snapshot
													</Button>
												</div>
												{(() => {
													const snaps = creatorSnaps(c.creator_id, c.creator_name);
													if (snaps.length === 0) return (
														<div className="text-[13px] py-3 text-center rounded" style={{ color: 'var(--n-fg-subtle)', border: '1px dashed var(--n-border)' }}>
															No snapshots yet. Add a baseline or quarterly snapshot.
														</div>
													);
													const baseline = snaps.find((s) => s.snapshot_type === 'Baseline');
													const latest = snaps[snaps.length - 1];
													return (
														<div className="space-y-2">
															{baseline && latest && baseline.id !== latest.id && (
																<div className="grid grid-cols-4 gap-2 text-[13px] mb-2 p-2 rounded" style={{ background: 'var(--n-bg-soft)', border: '1px solid var(--n-border)' }}>
																	<div>
																		<div className="text-[10px] uppercase" style={{ color: 'var(--n-fg-subtle)' }}>Follower Growth</div>
																		<div className="font-semibold" style={{ color: latest.followers > baseline.followers ? '#0f7b6c' : '#dc6803' }}>
																			{baseline.followers > 0 ? `${(((latest.followers - baseline.followers) / baseline.followers) * 100).toFixed(1)}%` : '—'}
																		</div>
																	</div>
																	<div>
																		<div className="text-[10px] uppercase" style={{ color: 'var(--n-fg-subtle)' }}>Engagement Chg</div>
																		<div className="font-semibold" style={{ color: Number(latest.engagement_rate) >= Number(baseline.engagement_rate) ? '#0f7b6c' : '#dc6803' }}>
																			{Number(baseline.engagement_rate) > 0 ? `${(Number(latest.engagement_rate) - Number(baseline.engagement_rate)).toFixed(2)}pp` : '—'}
																		</div>
																	</div>
																	<div>
																		<div className="text-[10px] uppercase" style={{ color: 'var(--n-fg-subtle)' }}>Reach Growth</div>
																		<div className="font-semibold" style={{ color: latest.estimated_reach > baseline.estimated_reach ? '#0f7b6c' : '#dc6803' }}>
																			{baseline.estimated_reach > 0 ? `${(((latest.estimated_reach - baseline.estimated_reach) / baseline.estimated_reach) * 100).toFixed(1)}%` : '—'}
																		</div>
																	</div>
																	<div>
																		<div className="text-[10px] uppercase" style={{ color: 'var(--n-fg-subtle)' }}>Since Baseline</div>
																		<div className="font-medium" style={{ color: 'var(--n-fg-muted)' }}>{baseline.snapshot_date} → {latest.snapshot_date}</div>
																	</div>
																</div>
															)}
															<div className="overflow-x-auto">
																<table className="w-full text-[13px]">
																	<thead>
																		<tr style={{ borderBottom: '1px solid var(--n-border)' }}>
																			<th className="text-left py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Type</th>
																			<th className="text-left py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Date</th>
																			<th className="text-right py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Followers</th>
																			<th className="text-right py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Eng. Rate</th>
																			<th className="text-right py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Reach</th>
																			<th className="text-right py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Rev (3m)</th>
																			<th className="text-right py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}></th>
																		</tr>
																	</thead>
																	<tbody>
																		{snaps.map((s) => (
																			<tr key={s.id} style={{ borderBottom: '1px solid var(--n-border)' }}>
																				<td className="py-1.5"><Tag tone={s.snapshot_type === 'Baseline' ? 'accent' : 'neutral'}>{s.snapshot_type}</Tag></td>
																				<td className="py-1.5 tabular-nums">{s.snapshot_date}</td>
																				<td className="py-1.5 text-right tabular-nums">{s.followers.toLocaleString('en-IN')}</td>
																				<td className="py-1.5 text-right tabular-nums">{s.engagement_rate}%</td>
																				<td className="py-1.5 text-right tabular-nums">{s.estimated_reach.toLocaleString('en-IN')}</td>
																				<td className="py-1.5 text-right tabular-nums">{inr(s.revenue_last_3m)}</td>
																				<td className="py-1.5 text-right">
																					<div className="flex gap-1 justify-end">
																						<Button variant="ghost" onClick={() => openSnapEdit(s)}>Edit</Button>
																						<Button variant="danger" onClick={() => deleteSnap(s.id)}>Del</Button>
																					</div>
																				</td>
																			</tr>
																		))}
																	</tbody>
																</table>
															</div>
														</div>
													);
												})()}
											</div>

											{/* Event Invites */}
											<div>
												<div className="flex items-center justify-between mb-2">
													<div className="text-[11px] font-medium uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
														Event Invites
														{c.relationship !== 'Exclusive' && (
															<span className="ml-2 normal-case font-normal text-[11px]" style={{ color: '#dc6803' }}>
																(typically for Exclusives only)
															</span>
														)}
													</div>
													<Button variant="outline" onClick={() => openEvtAdd(c.creator_id!)}>
														<Icon name="plus" size={13} /> Add Event
													</Button>
												</div>
												{(() => {
													const evts = creatorEvents(c.creator_id, c.creator_name);
													if (evts.length === 0) return (
														<div className="text-[13px] py-3 text-center rounded" style={{ color: 'var(--n-fg-subtle)', border: '1px dashed var(--n-border)' }}>
															No event invites logged yet.
														</div>
													);
													const accepted = evts.filter((e) => e.response === 'Accepted').length;
													const declined = evts.filter((e) => e.response === 'Declined').length;
													const noResp = evts.filter((e) => e.response === 'NoResponse' || !e.response).length;
													return (
														<div className="space-y-2">
															<div className="flex gap-3 text-[13px]">
																<span style={{ color: 'var(--n-fg-muted)' }}>Total: <strong>{evts.length}</strong></span>
																<span style={{ color: '#0f7b6c' }}>Accepted: <strong>{accepted}</strong></span>
																<span style={{ color: '#dc6803' }}>Declined: <strong>{declined}</strong></span>
																<span style={{ color: 'var(--n-fg-subtle)' }}>No Response: <strong>{noResp}</strong></span>
															</div>
															<div className="overflow-x-auto">
																<table className="w-full text-[13px]">
																	<thead>
																		<tr style={{ borderBottom: '1px solid var(--n-border)' }}>
																			<th className="text-left py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Event</th>
																			<th className="text-left py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Date</th>
																			<th className="text-left py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}>Response</th>
																			<th className="text-right py-1 font-medium" style={{ color: 'var(--n-fg-subtle)' }}></th>
																		</tr>
																	</thead>
																	<tbody>
																		{evts.map((e) => (
																			<tr key={e.id} style={{ borderBottom: '1px solid var(--n-border)' }}>
																				<td className="py-1.5" style={{ color: 'var(--n-fg)' }}>{e.event_name}</td>
																				<td className="py-1.5 tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>{e.event_date}</td>
																				<td className="py-1.5">
																					{e.response === 'Accepted' ? <Tag tone="yes">Accepted</Tag> :
																					 e.response === 'Declined' ? <Tag tone="no">Declined</Tag> :
																					 <Tag tone="neutral">No Response</Tag>}
																				</td>
																				<td className="py-1.5 text-right">
																					<div className="flex gap-1 justify-end">
																						<Button variant="ghost" onClick={() => openEvtEdit(e)}>Edit</Button>
																						<Button variant="danger" onClick={() => deleteEvt(e.id)}>Del</Button>
																					</div>
																				</td>
																			</tr>
																		))}
																	</tbody>
																</table>
															</div>
														</div>
													);
												})()}
											</div>
										</div>
									)}
								</article>
							);
						})}
					</div>
				)
			) : null}
		</section>

		{/* Snapshot Dialog */}
		<Dialog open={snapOpen} onOpenChange={setSnapOpen} title={snapEditing ? 'Edit Snapshot' : 'Add Social Media Snapshot'} className="max-w-2xl" footer={<>
			<Button variant="outline" onClick={() => setSnapOpen(false)}>Cancel</Button>
			<Button variant="primary" onClick={submitSnap}>{snapEditing ? 'Save' : 'Create'}</Button>
		</>}>
			<div className="grid grid-cols-2 gap-3">
				<div>
					<Label>Snapshot Type</Label>
					<Select value={snapForm.snapshot_type} onChange={(e) => setSnapForm((f) => ({ ...f, snapshot_type: e.target.value }))} options={[{ value: 'Baseline', label: 'Baseline (Day 0)' }, { value: 'Quarterly', label: 'Quarterly' }]} />
				</div>
				<div>
					<Label>Date</Label>
					<Input type="date" value={snapForm.snapshot_date} onChange={(e) => setSnapForm((f) => ({ ...f, snapshot_date: e.target.value }))} />
				</div>
				<div>
					<Label>Platform</Label>
					<Input value={snapForm.platform} onChange={(e) => setSnapForm((f) => ({ ...f, platform: e.target.value }))} />
				</div>
				<div>
					<Label>Followers</Label>
					<Input type="number" value={snapForm.followers} onChange={(e) => setSnapForm((f) => ({ ...f, followers: e.target.value }))} />
				</div>
				<div>
					<Label>Engagement Rate (%)</Label>
					<Input type="number" step="0.01" placeholder="e.g. 3.5" value={snapForm.engagement_rate} onChange={(e) => setSnapForm((f) => ({ ...f, engagement_rate: e.target.value }))} />
				</div>
				<div>
					<Label>Estimated Reach</Label>
					<Input type="number" value={snapForm.estimated_reach} onChange={(e) => setSnapForm((f) => ({ ...f, estimated_reach: e.target.value }))} />
				</div>
				<div className="col-span-2">
					<Label>Revenue (Last 3 months, INR)</Label>
					<Input type="number" step="0.01" value={snapForm.revenue_last_3m} onChange={(e) => setSnapForm((f) => ({ ...f, revenue_last_3m: e.target.value }))} />
				</div>
				<div className="col-span-2">
					<Label>Notes</Label>
					<Textarea value={snapForm.notes} onChange={(e) => setSnapForm((f) => ({ ...f, notes: e.target.value }))} />
				</div>
			</div>
		</Dialog>

		{/* Event Dialog */}
		<Dialog open={evtOpen} onOpenChange={setEvtOpen} title={evtEditing ? 'Edit Event Invite' : 'Add Event Invite'} className="max-w-2xl" footer={<>
			<Button variant="outline" onClick={() => setEvtOpen(false)}>Cancel</Button>
			<Button variant="primary" onClick={submitEvt}>{evtEditing ? 'Save' : 'Create'}</Button>
		</>}>
			<div className="grid grid-cols-2 gap-3">
				<div className="col-span-2">
					<Label>Event Name</Label>
					<Input value={evtForm.event_name} onChange={(e) => setEvtForm((f) => ({ ...f, event_name: e.target.value }))} />
				</div>
				<div>
					<Label>Event Date</Label>
					<Input type="date" value={evtForm.event_date} onChange={(e) => setEvtForm((f) => ({ ...f, event_date: e.target.value }))} />
				</div>
				<div>
					<Label>Invited Date</Label>
					<Input type="date" value={evtForm.invited_date} onChange={(e) => setEvtForm((f) => ({ ...f, invited_date: e.target.value }))} />
				</div>
				<div>
					<Label>Response</Label>
					<Select value={evtForm.response} onChange={(e) => setEvtForm((f) => ({ ...f, response: e.target.value }))} options={[{ value: 'Accepted', label: 'Accepted' }, { value: 'Declined', label: 'Declined' }, { value: 'NoResponse', label: 'No Response' }]} placeholder="—" />
				</div>
				<div>
					<Label>Notes</Label>
					<Input value={evtForm.notes} onChange={(e) => setEvtForm((f) => ({ ...f, notes: e.target.value }))} />
				</div>
			</div>
		</Dialog>
		</>
	);
}
