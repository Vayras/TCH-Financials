import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { type Deal } from '@/lib/api';
import { inr } from '@/lib/utils';
import styles from '../payments.module.css';
import Icon from '@/components/ui/Icon';
import DataTable from '@/components/DataTable';
import QueryErrorState from '@/components/QueryErrorState';
import { type PaymentStatus } from '@/lib/payments';

type StatusFilter = 'all' | PaymentStatus;

interface InvoicesTabProps {
	activeTab: 'receivables' | 'payables';
	statusFilter: StatusFilter;
	setStatusFilter: (s: StatusFilter) => void;
	filtered: Deal[];
	columns: ColumnDef<Deal, unknown>[];
	loading: boolean;
	error: string | null;
	refetchDeals: () => void;
	metrics: {
		dueCount: number;
		dueTotal: number;
		overdueCount: number;
		overdueTotal: number;
		awaitingCount: number;
		clearedCount: number;
	};
}

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'awaiting_invoices', label: 'Awaiting Invoices' },
	{ key: 'due_soon', label: 'Due Soon' },
	{ key: 'overdue', label: 'Overdue' },
	{ key: 'upcoming', label: 'Upcoming' },
	{ key: 'cleared', label: 'Cleared' }
];

export function InvoicesTab({
	statusFilter,
	setStatusFilter,
	filtered,
	columns,
	loading,
	error,
	refetchDeals,
	metrics
}: InvoicesTabProps) {
	return (
		<>
			<div className={styles.metrics}>
                {[
                    {label:'Due soon', value:`₹${inr(metrics.dueTotal) || '0'}`, note:`${metrics.dueCount} payments`, alert:false},
                    {label:'Overdue', value:`₹${inr(metrics.overdueTotal) || '0'}`, note:`${metrics.overdueCount} payments`, alert:metrics.overdueCount > 0},
                    {label:'Awaiting invoices', value:metrics.awaitingCount, note:'Completed campaigns', alert:false},
                    {label:'Cleared', value:metrics.clearedCount, note:'Payments settled', alert:false}
                ].map(metric => <div key={metric.label} className={styles.metric} data-alert={metric.alert}>
                    <span>{metric.label}</span><strong>{loading ? '—' : metric.value}</strong><small>{metric.note}</small>
                </div>)}
            </div>
            <div className={styles.panel}>
                <div className={styles.filterBar}>
                    <div className={styles.filters} aria-label="Payment status">
                        {FILTER_OPTIONS.map(f => <button key={f.key} type="button" aria-pressed={statusFilter === f.key} onClick={() => setStatusFilter(f.key)}>{f.label}</button>)}
                    </div>
                    <span className={styles.count}>{loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'payment' : 'payments'}`}</span>
                </div>

			{error ? (
				<QueryErrorState description="Payment information is temporarily unavailable." onRetry={refetchDeals} />
			) : !loading && filtered.length === 0 ? (
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}><Icon name="credit-card" size={22} /></span>
                    <h2>{statusFilter === 'all' ? 'No payments to show yet' : 'No matching payments'}</h2>
                    <p>{statusFilter === 'all' ? 'Payments appear here once a campaign is completed.' : 'There are no completed campaigns with this payment status.'}</p>
                    {statusFilter !== 'all' && <button type="button" onClick={() => setStatusFilter('all')}>Show all payments</button>}
                </div>
            ) : (
				<DataTable
					data={filtered}
					columns={columns}
					loading={loading}
					emptyMessage="No completed campaigns match."
				/>
			)}
            </div>
		</>
	);
}
