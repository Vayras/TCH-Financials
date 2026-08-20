import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import DataTable from '@/components/DataTable';
import { type TdsEntryItem } from '../queries';

interface TdsTabProps {
	tdsStatusFilter: 'All' | 'Pending' | 'Remitted';
	setTdsStatusFilter: (s: 'All' | 'Pending' | 'Remitted') => void;
	setTdsOpen: (open: boolean) => void;
	tdsData: TdsEntryItem[];
	tdsColumns: ColumnDef<TdsEntryItem, unknown>[];
	loading: boolean;
}

export function TdsTab({
	tdsStatusFilter,
	setTdsStatusFilter,
	setTdsOpen,
	tdsData,
	tdsColumns,
	loading
}: TdsTabProps) {
	return (
		<div className="space-y-4 anim-fade-up">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex bg-[var(--n-bg-soft)] p-1 rounded-lg border border-[var(--n-border)]">
					{(['All', 'Pending', 'Remitted'] as const).map((statusOption) => (
						<button
							key={statusOption}
							onClick={() => setTdsStatusFilter(statusOption)}
							className={`px-3 py-1 text-[12px] font-medium rounded-md transition-colors duration-100 ${tdsStatusFilter === statusOption ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
						>
							{statusOption}
						</button>
					))}
				</div>

				<Button variant="primary" onClick={() => setTdsOpen(true)}>
					<Icon name="plus" size={14} /> Add TDS Entry
				</Button>
			</div>

			<DataTable
				data={tdsData}
				columns={tdsColumns}
				loading={loading}
				emptyMessage="No TDS records recorded."
			/>
		</div>
	);
}
