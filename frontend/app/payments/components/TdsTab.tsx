import React from 'react';
import styles from '../payments.module.css';
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
				<div className={styles.filters}>
					{(['All', 'Pending', 'Remitted'] as const).map((statusOption) => (
						<button
							key={statusOption}
							onClick={() => setTdsStatusFilter(statusOption)}
							aria-pressed={tdsStatusFilter === statusOption}
						>
							{statusOption}
						</button>
					))}
				</div>

				<Button className={styles.actionButton} variant="primary" onClick={() => setTdsOpen(true)}>
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
