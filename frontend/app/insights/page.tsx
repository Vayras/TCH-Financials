'use client';

import * as React from 'react';
import { api, type CreatorInsights, type CreatorInsight } from '@/lib/api';
import { inr } from '@/lib/utils';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';

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
	const [fyStart, setFyStart] = React.useState(2025);
	const [data, setData] = React.useState<CreatorInsights | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [q, setQ] = React.useState('');
	const [relFilter, setRelFilter] = React.useState<RelFilter>('All');

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const fresh = await api.get<CreatorInsights>(`/creator-insights/?fy=${fyStart}`);
			setData(fresh);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, [fyStart]);

	React.useEffect(() => {
		load();
	}, [load]);

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

	return (
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
					<select
						className="h-7 rounded px-2 pr-7 text-[13px] appearance-none bg-no-repeat bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
						style={{
							backgroundImage:
								"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2337352f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
							backgroundPosition: 'right 6px center',
							backgroundSize: '12px 12px'
						}}
						value={fyStart}
						onChange={(e) => setFyStart(Number(e.target.value))}
					>
						<option value={2025}>{fyLabelFor(2025)}</option>
						<option value={2026}>{fyLabelFor(2026)}</option>
						<option value={2027}>{fyLabelFor(2027)}</option>
					</select>
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
								</article>
							);
						})}
					</div>
				)
			) : null}
		</section>
	);
}
