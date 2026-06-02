'use client';

import * as React from 'react';
import { api, type AlertsPayload, type AlertItem, type AlertSeverity } from '@/lib/api';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';

type State =
	| { kind: 'loading' }
	| { kind: 'error'; message: string }
	| { kind: 'ok'; data: AlertsPayload };
type SectionKey = 'urgent' | 'bd' | 'health' | 'seasonal';
type FilterKey = 'all' | SectionKey;

function sevTone(s: AlertSeverity): 'no' | 'markup' | 'neutral' {
	if (s === 'high') return 'no';
	if (s === 'med') return 'markup';
	return 'neutral';
}
function sevLabel(s: AlertSeverity): string {
	return s === 'high' ? 'High' : s === 'med' ? 'Med' : 'Low';
}

const SECTION_META: Record<
	SectionKey,
	{ title: string; subtitle: string; icon: string; accent: string; accentBg: string }
> = {
	urgent: {
		title: 'Urgent — Action Today',
		subtitle: 'Inactive creators, overdue invoices/payments, renewals due',
		icon: 'alert-triangle',
		accent: '#c0432e',
		accentBg: '#fbe9e4'
	},
	bd: {
		title: 'BD Opportunities',
		subtitle: 'Dormant brands worth re-engaging, hot brands worth pitching more',
		icon: 'target',
		accent: '#19567c',
		accentBg: '#dde8f6'
	},
	health: {
		title: 'Creator Health Warnings',
		subtitle: 'Exclusive creators whose billing dropped quarter-over-quarter',
		icon: 'activity',
		accent: '#8a6a18',
		accentBg: '#fcf2cf'
	},
	seasonal: {
		title: 'Upcoming Seasonal Moments',
		subtitle: 'Cultural / retail moments to plan campaigns around',
		icon: 'calendar-clock',
		accent: '#52298f',
		accentBg: '#e6dbf6'
	}
};

const ORDER: SectionKey[] = ['urgent', 'bd', 'health', 'seasonal'];
const FILTERS: FilterKey[] = ['all', 'urgent', 'bd', 'health', 'seasonal'];

function filterLabel(f: FilterKey): string {
	if (f === 'all') return 'All';
	if (f === 'bd') return 'BD';
	if (f === 'urgent') return 'Urgent';
	if (f === 'health') return 'Health';
	return 'Seasonal';
}

export default function AlertsPage() {
	const [pageState, setPageState] = React.useState<State>({ kind: 'loading' });
	const [activeSection, setActiveSection] = React.useState<FilterKey>('all');

	const load = React.useCallback(async () => {
		setPageState({ kind: 'loading' });
		try {
			const fresh = await api.get<AlertsPayload>('/alerts/');
			setPageState({ kind: 'ok', data: fresh });
		} catch (e) {
			setPageState({ kind: 'error', message: (e as Error).message });
		}
	}, []);

	React.useEffect(() => {
		load();
	}, [load]);

	const alerts = pageState.kind === 'ok' ? pageState.data : null;

	function listFor(key: SectionKey): AlertItem[] {
		if (!alerts) return [];
		return alerts[key] ?? [];
	}
	function shouldShow(key: SectionKey): boolean {
		if (activeSection === 'all') return true;
		return activeSection === key;
	}

	return (
		<section className="space-y-6">
			<header className="space-y-2">
				<div
					className="text-[12px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
				>
					Workspace · Alerts
				</div>
				<h1
					className="page-title text-[40px] leading-[1.15] font-bold"
					style={{ color: 'var(--n-fg)' }}
				>
					Intelligence Alerts
				</h1>
				<p className="text-[15px] max-w-[720px]" style={{ color: 'var(--n-fg-muted)' }}>
					Formula-derived signals from Commercial Tracking, Creators, and Contracting. No AI — just
					thresholds applied to the live database, recomputed on every load.
				</p>
			</header>

			<div
				className="flex flex-wrap items-center gap-2 pb-3"
				style={{ borderBottom: '1px solid var(--n-border)' }}
			>
				<div className="seg-toggle">
					{FILTERS.map((f) => (
						<button
							key={f}
							type="button"
							className={cn(activeSection === f && 'active')}
							onClick={() => setActiveSection(f)}
						>
							{filterLabel(f)}
							{alerts && (
								<span className="ml-1 text-[11px]" style={{ color: 'var(--n-fg-subtle)' }}>
									{f === 'all'
										? alerts.counts.urgent +
											alerts.counts.bd +
											alerts.counts.health +
											alerts.counts.seasonal
										: alerts.counts[f]}
								</span>
							)}
						</button>
					))}
				</div>
				<div className="ml-auto flex items-center gap-2">
					{alerts && (
						<span className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
							Generated {alerts.generated_at}
						</span>
					)}
					<Button variant="ghost" onClick={load}>
						<Icon name="refresh" size={14} /> Refresh
					</Button>
				</div>
			</div>

			{pageState.kind === 'loading' ? (
				<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
					Loading…
				</div>
			) : pageState.kind === 'error' ? (
				<div
					className="text-[14px] rounded p-3"
					style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
				>
					Error: {pageState.message}
				</div>
			) : (
				(() => {
					const payload = pageState.data;
					const totalCount =
						payload.counts.urgent +
						payload.counts.bd +
						payload.counts.health +
						payload.counts.seasonal;
					return (
						<>
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
								{ORDER.map((key) => {
									const meta = SECTION_META[key];
									return (
										<button
											key={key}
											type="button"
											className="rounded p-3 text-left transition-colors"
											style={{
												border: '1px solid var(--n-border)',
												background: 'var(--n-bg)'
											}}
											onClick={() => setActiveSection(key)}
											onMouseEnter={(e) =>
												(e.currentTarget.style.borderColor = meta.accent)
											}
											onMouseLeave={(e) =>
												(e.currentTarget.style.borderColor = 'var(--n-border)')
											}
										>
											<div
												className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
												style={{
													color: 'var(--n-fg-subtle)',
													letterSpacing: '0.04em'
												}}
											>
												<span
													className="inline-flex items-center justify-center rounded-sm h-4 w-4"
													style={{
														background: meta.accentBg,
														color: meta.accent
													}}
												>
													<Icon name={meta.icon} size={11} />
												</span>
												{meta.title.split('—')[0].trim()}
											</div>
											<div
												className="text-[22px] font-semibold tabular-nums mt-1"
												style={{ color: 'var(--n-fg)' }}
											>
												{payload.counts[key]}
											</div>
										</button>
									);
								})}
							</div>

							{totalCount === 0 ? (
								<div
									className="rounded p-8 text-center text-[14px]"
									style={{
										border: '1px dashed var(--n-border)',
										color: 'var(--n-fg-subtle)'
									}}
								>
									No alerts — every threshold is clean.
								</div>
							) : (
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
									{ORDER.map((key) => {
										const meta = SECTION_META[key];
										const items = listFor(key);
										if (!shouldShow(key)) return null;
										return (
											<article
												key={key}
												className="rounded-md border bg-[var(--n-bg)] shadow-[0_1px_2px_rgba(15,15,15,0.04)] overflow-hidden"
												style={{ borderColor: 'var(--n-border)' }}
											>
												<header
													className="flex items-center justify-between gap-3 px-4 py-3"
													style={{
														borderBottom: '1px solid var(--n-border)',
														background: meta.accentBg
													}}
												>
													<div className="flex items-center gap-2 min-w-0">
														<span
															className="inline-flex items-center justify-center h-6 w-6 rounded"
															style={{
																background: 'rgba(255,255,255,0.6)',
																color: meta.accent
															}}
														>
															<Icon name={meta.icon} size={14} />
														</span>
														<div className="min-w-0">
															<div
																className="text-[14px] font-semibold leading-tight"
																style={{ color: meta.accent }}
															>
																{meta.title}
															</div>
															<div
																className="text-[11.5px] mt-0.5"
																style={{ color: 'var(--n-fg-muted)' }}
															>
																{meta.subtitle}
															</div>
														</div>
													</div>
													<div
														className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded"
														style={{
															background: 'rgba(255,255,255,0.7)',
															color: meta.accent
														}}
													>
														{items.length} {items.length === 1 ? 'alert' : 'alerts'}
													</div>
												</header>

												{items.length === 0 ? (
													<div
														className="px-4 py-6 text-center text-[13px]"
														style={{ color: 'var(--n-fg-subtle)' }}
													>
														None.
													</div>
												) : (
													<ul
														className="divide-y"
														style={{ borderColor: 'var(--n-border)' }}
													>
														{items.map((it) => (
															<li
																key={it.kind + '|' + it.title}
																className="px-4 py-3 hover:bg-[var(--n-bg-soft)] transition-colors"
															>
																<div className="flex items-start gap-2.5">
																	<span
																		className="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
																		style={{
																			background:
																				it.severity === 'high'
																					? '#c0432e'
																					: it.severity === 'med'
																						? '#b8801b'
																						: '#7a7468'
																		}}
																	/>
																	<div className="min-w-0 flex-1">
																		<div className="flex items-start gap-2 flex-wrap">
																			<div
																				className="text-[13.5px] font-medium leading-snug"
																				style={{ color: 'var(--n-fg)' }}
																			>
																				{it.title}
																			</div>
																			{key !== 'seasonal' && (
																				<Tag tone={sevTone(it.severity)}>
																					{sevLabel(it.severity)}
																				</Tag>
																			)}
																		</div>
																		<div
																			className="text-[12.5px] mt-1 leading-snug"
																			style={{ color: 'var(--n-fg-muted)' }}
																		>
																			{it.detail}
																		</div>
																		<div
																			className="text-[12px] mt-1.5 font-medium inline-flex items-center gap-1"
																			style={{ color: meta.accent }}
																		>
																			<Icon name="arrow-right" size={11} />
																			{it.action}
																		</div>
																	</div>
																</div>
															</li>
														))}
													</ul>
												)}
											</article>
										);
									})}
								</div>
							)}

							<footer
								className="text-[11.5px] pt-4 leading-relaxed"
								style={{
									color: 'var(--n-fg-subtle)',
									borderTop: '1px solid var(--n-border)'
								}}
							>
								<strong style={{ color: 'var(--n-fg-muted)', fontWeight: 500 }}>
									Thresholds:
								</strong>{' '}
								Inactive creator ≥ {payload.thresholds.inactive_creator_days}d · Invoice overdue
								≥ {payload.thresholds.invoice_overdue_days}d · Payment overdue ≥{' '}
								{payload.thresholds.payment_overdue_days}d · Brand dormant ≥{' '}
								{payload.thresholds.brand_dormant_days}d · Brand hot ≥ 3 deals/
								{payload.thresholds.brand_hot_window_days}d · Renewal ≤{' '}
								{payload.thresholds.renewal_due_days}d · QoQ drop ≥{' '}
								{Math.round(payload.thresholds.qoq_drop_pct * 100)}%.
							</footer>
						</>
					);
				})()
			)}
		</section>
	);
}
