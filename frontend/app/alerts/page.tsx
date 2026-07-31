'use client';

import * as React from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { type AlertItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import {
	useAlertsQuery,
	useDismissAlertsMutation,
	useRestoreAllAlertsMutation
} from './queries';
import { type AlertsState, type AlertSectionKey, type AlertFilterKey } from '@/lib/types';
import {
	ORDER,
	FILTERS,
	filterLabel,
	AlertsDashboardView
} from './components';

export default function AlertsPage() {
	const { data: alertsData, isLoading, error: queryError, refetch } = useAlertsQuery();
	const dismissMutation = useDismissAlertsMutation();
	const restoreAllMutation = useRestoreAllAlertsMutation();

	const [activeSection, setActiveSection] = React.useState<AlertFilterKey>('all');
	const [busy, setBusy] = React.useState(false);

	const pageState = React.useMemo<AlertsState>(() => {
		if (isLoading) return { kind: 'loading' };
		if (queryError) return { kind: 'error', message: queryError.message };
		if (alertsData) return { kind: 'ok', data: alertsData };
		return { kind: 'loading' };
	}, [isLoading, queryError, alertsData]);

	// Dismiss alerts by key: persist server-side, drop from local state without
	// a full reload (alerts are recomputed on every GET, so the next load stays
	// consistent with what we removed here).
	const dismiss = React.useCallback(async (keys: string[]) => {
		if (keys.length === 0) return;
		setBusy(true);
		try {
			await dismissMutation.mutateAsync(keys);
			toast.success(keys.length === 1 ? 'Alert dismissed.' : `${keys.length} alerts dismissed.`);
		} catch (e) {
			toast.error('Alerts could not be dismissed.', { description: (e as Error).message });
		} finally {
			setBusy(false);
		}
	}, [dismissMutation]);

	const restoreAll = React.useCallback(async () => {
		setBusy(true);
		try {
			await restoreAllMutation.mutateAsync();
			toast.success('Dismissed alerts restored.');
		} catch (e) {
			toast.error('Alerts could not be restored.', { description: (e as Error).message });
		} finally {
			setBusy(false);
		}
	}, [restoreAllMutation]);

	const alerts = pageState.kind === 'ok' ? pageState.data : null;

	const totalCount = React.useMemo(() => {
		if (!alerts) return 0;
		return (
			alerts.counts.urgent +
			alerts.counts.payments +
			alerts.counts.bd +
			alerts.counts.health +
			alerts.counts.docs +
			alerts.counts.seasonal
		);
	}, [alerts]);

	function listFor(key: AlertSectionKey): AlertItem[] {
		if (!alerts) return [];
		return alerts[key] ?? [];
	}
	function shouldShow(key: AlertSectionKey): boolean {
		if (activeSection === 'all') return true;
		return activeSection === key;
	}

	return (
		<section className="space-y-6">
			<PageHeader eyebrow="Workspace · Alerts" title="Intelligence Alerts" description={<span className="block max-w-2xl">
					Formula-derived signals from Commercial Tracking, Creators, and Documents. No AI — just
					thresholds applied to the live database, recomputed on every load.
				</span>} />

			<div
				className="flex flex-wrap items-center gap-2 pb-3"
				style={{ borderBottom: '1px solid var(--n-border)' }}
			>
				<div className="ml-auto flex items-center gap-2">
					{alerts && (
						<span className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
							Generated {alerts.generated_at}
						</span>
					)}
					{alerts && alerts.dismissed_count > 0 && (
						<Button variant="ghost" disabled={busy} onClick={restoreAll}>
							Restore {alerts.dismissed_count} dismissed
						</Button>
					)}
					{alerts && (
						<Button
							variant="ghost"
							disabled={busy}
							onClick={() =>
								dismiss(
									ORDER.filter((k) => shouldShow(k))
										.flatMap((k) => listFor(k))
										.map((it) => it.key)
								)
							}
						>
							<Icon name="x" size={14} /> Clear {activeSection === 'all' ? 'all' : filterLabel(activeSection)}
						</Button>
					)}
					<Button variant="ghost" onClick={() => refetch()}>
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
				<AlertsDashboardView
					payload={pageState.data}
					totalCount={totalCount}
					activeSection={activeSection}
					setActiveSection={setActiveSection}
					busy={busy}
					dismiss={dismiss}
					listFor={listFor}
					shouldShow={shouldShow}
				/>
			)}
		</section>
	);
}
