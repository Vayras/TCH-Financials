import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { type Deal } from '@/lib/api';
import { inr } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
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
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 anim-fade-up">
				<MetricCard
					label="Due Soon"
					value={`${metrics.dueCount} · ₹${inr(metrics.dueTotal) || '0'}`}
				/>
				<div className="rounded-xl p-4 border" style={{ background: metrics.overdueCount > 0 ? 'var(--color-danger-bg)' : 'var(--n-bg)', borderColor: metrics.overdueCount > 0 ? 'var(--color-danger-border)' : 'var(--n-border)' }}>
					<p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: metrics.overdueCount > 0 ? 'var(--color-danger)' : 'var(--n-fg-subtle)' }}>Overdue</p>
					<p className="text-[24px] font-bold tracking-tight tabular-nums" style={{ color: metrics.overdueCount > 0 ? 'var(--color-danger-muted)' : 'var(--n-fg)' }}>
						{metrics.overdueCount} · ₹{inr(metrics.overdueTotal) || '0'}
					</p>
				</div>
				<MetricCard label="Awaiting Invoices" value={metrics.awaitingCount} />
				<MetricCard label="Cleared" value={metrics.clearedCount} />
			</div>

			<div className="flex items-center gap-2 border-b mb-4" style={{ borderColor: 'var(--n-border)' }}>
				<div className="flex-1 flex items-center gap-2">
					{FILTER_OPTIONS.map((f) => {
						const isActive = statusFilter === f.key;
						return (
							<button
								key={f.key}
								onClick={() => setStatusFilter(f.key)}
								className={`px-4 py-2.5  font-medium transition-colors relative`}
								style={{
									color: isActive ? 'var(--n-fg)' : 'var(--n-fg-subtle)',
									fontSize: 12
								}}
							>
								{f.label}
								{isActive && (
									<div className="absolute bottom-0 left-0 right-0 h-[2px] bg-current rounded-t-sm" />
								)}
							</button>
						);
					})}
				</div>
				<div className="text-[12px] pr-2" style={{ color: 'var(--n-fg-muted)' }}>
					{filtered.length} {filtered.length === 1 ? 'payment' : 'payments'}
				</div>
			</div>

			{error ? (
				<QueryErrorState description="Payment information is temporarily unavailable." onRetry={refetchDeals} />
			) : (
				<DataTable
					data={filtered}
					columns={columns}
					loading={loading}
					emptyMessage="No completed campaigns match."
				/>
			)}
		</>
	);
}
