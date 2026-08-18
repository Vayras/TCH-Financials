import * as React from 'react';
import { type AlertItem, type AlertSeverity, type AlertsPayload } from '@/lib/api';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';
import { type AlertSectionKey, type AlertFilterKey } from '@/lib/types';

export function sevTone(s: AlertSeverity): 'no' | 'markup' | 'neutral' {
	if (s === 'high') return 'no';
	if (s === 'med') return 'markup';
	return 'neutral';
}

export function sevLabel(s: AlertSeverity): string {
	return s === 'high' ? 'High' : s === 'med' ? 'Med' : 'Low';
}

export const SECTION_META: Record<
	AlertSectionKey,
	{ title: string; subtitle: string; icon: string; accent: string; accentBg: string }
> = {
	urgent: {
		title: 'Urgent — Action Today',
		subtitle: 'Inactive creators, overdue invoices/payments, renewals due',
		icon: 'alert-triangle',
		accent: '#c0432e',
		accentBg: '#fbe9e4'
	},
	payments: {
		title: 'Payments',
		subtitle: 'Creator invoices to collect and Wednesday payment-cycle dues',
		icon: 'credit-card',
		accent: '#1f6f43',
		accentBg: '#dcedda'
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
	docs: {
		title: 'Documents Missing',
		subtitle: 'Active creators with no agreement / KYC document on file',
		icon: 'file-signature',
		accent: '#9b3b6a',
		accentBg: '#f7e1ec'
	},
	seasonal: {
		title: 'Upcoming Seasonal Moments',
		subtitle: 'Cultural / retail moments to plan campaigns around',
		icon: 'calendar-clock',
		accent: '#52298f',
		accentBg: '#e6dbf6'
	}
};

export const ORDER: AlertSectionKey[] = ['urgent', 'payments', 'bd', 'health', 'docs', 'seasonal'];
export const FILTERS: AlertFilterKey[] = ['all', 'urgent', 'payments', 'bd', 'health', 'docs', 'seasonal'];

export function filterLabel(f: AlertFilterKey): string {
	if (f === 'all') return 'All';
	if (f === 'bd') return 'BD';
	if (f === 'urgent') return 'Urgent';
	if (f === 'payments') return 'Payments';
	if (f === 'health') return 'Health';
	if (f === 'docs') return 'Docs';
	return 'Seasonal';
}

export function AlertSummaryCard({
	sectionKey,
	count,
	isActive,
	setActiveSection
}: {
	sectionKey: AlertFilterKey;
	count: number;
	isActive: boolean;
	setActiveSection: (key: AlertFilterKey) => void;
}) {
	const meta = sectionKey === 'all' 
		? { title: 'All Alerts', icon: 'inbox', accent: '#4b5563', accentBg: '#f3f4f6' }
		: SECTION_META[sectionKey as AlertSectionKey];

	const isZero = count === 0;

	return (
		<button
			type="button"
			className={`rounded-xl p-3.5 text-left transition-all duration-200 flex flex-col justify-between ${
				isZero && !isActive ? 'opacity-50 hover:opacity-100 grayscale hover:grayscale-0' : ''
			}`}
			style={{
				border: `1px solid ${isActive ? meta.accent : 'var(--n-border)'}`,
				background: isActive ? meta.accentBg : 'var(--n-bg)',
				boxShadow: isActive ? `0 0 0 1px ${meta.accent} inset` : '0 1px 2px rgba(0,0,0,0.02)',
				minHeight: '100px'
			}}
			onClick={() => setActiveSection(sectionKey)}
			onMouseEnter={(e) => {
				if (!isActive) {
					e.currentTarget.style.borderColor = meta.accent;
					e.currentTarget.style.background = meta.accentBg;
				}
			}}
			onMouseLeave={(e) => {
				if (!isActive) {
					e.currentTarget.style.borderColor = 'var(--n-border)';
					e.currentTarget.style.background = 'var(--n-bg)';
				}
			}}
		>
			<div className="flex items-start justify-between w-full">
				<span
					className="inline-flex items-center justify-center rounded-lg h-7 w-7 transition-colors"
					style={{
						background: isActive ? 'rgba(255,255,255,0.6)' : meta.accentBg,
						color: meta.accent
					}}
				>
					<Icon name={meta.icon} size={15} />
				</span>
				<div
					className="text-[26px] font-semibold tabular-nums leading-none tracking-tight"
					style={{ color: isActive ? meta.accent : 'var(--n-fg)' }}
				>
					{count}
				</div>
			</div>
			
			<div
				className="text-[12px] font-medium mt-4 leading-tight"
				style={{
					color: isActive ? meta.accent : 'var(--n-fg-subtle)'
				}}
			>
				{meta.title.split('—')[0].trim()}
			</div>
		</button>
	);
}

export function AlertSectionCard({
	sectionKey,
	items,
	busy,
	dismiss
}: {
	sectionKey: AlertSectionKey;
	items: AlertItem[];
	busy: boolean;
	dismiss: (keys: string[]) => void;
}) {
	const meta = SECTION_META[sectionKey];
	return (
		<article
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
							key={it.key}
							className="group px-4 py-3 hover:bg-[var(--n-bg-soft)] transition-colors"
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
										{sectionKey !== 'seasonal' && (
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
								<button
									type="button"
									title="Dismiss this alert"
									disabled={busy}
									onClick={() => dismiss([it.key])}
									className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--n-bg)]"
									style={{ color: 'var(--n-fg-subtle)' }}
								>
									<Icon name="x" size={13} />
								</button>
							</div>
						</li>
					))}
				</ul>
			)}
		</article>
	);
}

export function AlertsDashboardView({
	payload,
	totalCount,
	activeSection,
	setActiveSection,
	busy,
	dismiss,
	listFor,
	shouldShow
}: {
	payload: AlertsPayload;
	totalCount: number;
	activeSection: AlertFilterKey;
	setActiveSection: (key: AlertFilterKey) => void;
	busy: boolean;
	dismiss: (keys: string[]) => void;
	listFor: (key: AlertSectionKey) => AlertItem[];
	shouldShow: (key: AlertSectionKey) => boolean;
}) {
	return (
		<>
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-2">
				<AlertSummaryCard
					sectionKey="all"
					count={totalCount}
					isActive={activeSection === 'all'}
					setActiveSection={setActiveSection}
				/>
				{ORDER.map((key) => (
					<AlertSummaryCard
						key={key}
						sectionKey={key}
						count={payload.counts[key]}
						isActive={activeSection === key}
						setActiveSection={setActiveSection}
					/>
				))}
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
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
					{ORDER.map((key) => {
						if (!shouldShow(key)) return null;
						return (
							<AlertSectionCard
								key={key}
								sectionKey={key}
								items={listFor(key)}
								busy={busy}
								dismiss={dismiss}
							/>
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
}
