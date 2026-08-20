import React, { type Dispatch, type SetStateAction } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import MetricCard from '@/components/MetricCard';
import DataTable from '@/components/DataTable';
import { inr } from '@/lib/utils';
import { type PaymentTransactionItem } from '../queries';

interface UtrTabProps {
	utrSearch: string;
	setUtrSearch: (s: string) => void;
	setUtrPage: Dispatch<SetStateAction<number>>;
	setImportOpen: (open: boolean) => void;
	setManualOpen: (open: boolean) => void;
	utrData: {
		summary: { total_debit: number | string; total_credit: number | string };
		items: PaymentTransactionItem[];
		total_pages: number;
	} | undefined;
	utrColumns: ColumnDef<PaymentTransactionItem, unknown>[];
	loading: boolean;
	utrPage: number;
}

export function UtrTab({
	utrSearch,
	setUtrSearch,
	setUtrPage,
	setImportOpen,
	setManualOpen,
	utrData,
	utrColumns,
	loading,
	utrPage
}: UtrTabProps) {
	return (
		<div className="space-y-4 anim-fade-up">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="relative flex-1 max-w-md">
					<span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
						<Icon name="search" size={13} />
					</span>
					<input
						value={utrSearch}
						onChange={(e) => { setUtrSearch(e.target.value); setUtrPage(1); }}
						placeholder="Search by vendor, UTR, or notes…"
						className="h-9 w-full rounded-lg pl-9 pr-3 text-[12px] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)]"
						style={{ background: 'var(--n-bg)', color: 'var(--n-fg)' }}
					/>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={() => setImportOpen(true)}>
						<Icon name="upload" size={14} /> Import Excel
					</Button>
					<Button variant="primary" onClick={() => setManualOpen(true)}>
						<Icon name="plus" size={14} /> Add Transaction
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 mb-2">
				<MetricCard label="Total Outflows (Debits)" value={`₹${inr(Number(utrData?.summary.total_debit || 0))}`} />
				<MetricCard label="Total Inflows (Credits)" value={`₹${inr(Number(utrData?.summary.total_credit || 0))}`} />
			</div>

			<DataTable
				data={utrData?.items ?? []}
				columns={utrColumns}
				loading={loading}
				emptyMessage="No payment transactions logged yet."
			/>

			{utrData && utrData.total_pages > 1 && (
				<div className="flex items-center justify-end gap-2 pt-4">
					<Button
						variant="outline"
						size="sm"
						disabled={utrPage === 1}
						onClick={() => setUtrPage((p) => p - 1)}
					>
						Previous
					</Button>
					<span className="text-[12px] text-gray-500">
						Page {utrPage} of {utrData.total_pages}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={utrPage === utrData.total_pages}
						onClick={() => setUtrPage((p) => p + 1)}
					>
						Next
					</Button>
				</div>
			)}
		</div>
	);
}
