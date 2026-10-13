'use client';

import * as React from 'react';
import { toast } from 'sonner';
import styles from './alerts.module.css';
import { type AlertItem } from '@/lib/api';
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


	function listFor(key: AlertSectionKey): AlertItem[] {
		if (!alerts) return [];
		return alerts[key] ?? [];
	}
	function shouldShow(key: AlertSectionKey): boolean {
		if (activeSection === 'all') return true;
		return activeSection === key;
	}

	return (
		<section className={styles.workspace}>
			<header className={styles.header}><h1>Alerts & reminders</h1><p>Resolve outstanding issues and plan your next campaigns.</p></header>

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
							disabled={busy || !ORDER.filter(k => (k === 'bd' || k === 'seasonal') && shouldShow(k)).some(k => listFor(k).length)}
							onClick={() =>
								dismiss(
									ORDER.filter((k) => (k === 'bd' || k === 'seasonal') && shouldShow(k))
										.flatMap((k) => listFor(k))
										.map((it) => it.key)
								)
							}
						>
							<Icon name="x" size={14} /> Dismiss opportunities
						</Button>
					)}
					<Button variant="outline" disabled={isLoading||busy} onClick={() => refetch()}>
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
					activeSection={activeSection}
					setActiveSection={setActiveSection}
					busy={busy}
					dismiss={dismiss}
				/>
			)}
		</section>
	);
}
