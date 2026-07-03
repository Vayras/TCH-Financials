'use client';

import * as React from 'react';
import {
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	type ColumnDef,
	type RowData,
	type SortingState
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface ColumnMeta<TData extends RowData, TValue> {
		/** Extra class for every <td> in this column. */
		tdClassName?: string;
		/** Inline style for every <td> in this column (e.g. muted text color). */
		tdStyle?: React.CSSProperties;
		/** Extra class for the <th> (e.g. width, numeric alignment). */
		thClassName?: string;
	}
}

export interface DataTableProps<T> {
	data: T[];
	columns: ColumnDef<T, unknown>[];
	/** Prepend a "#" column numbered by display order (follows sorting). */
	numbered?: boolean;
	emptyMessage?: string;
}

export function DataTable<T>({
	data,
	columns,
	numbered = false,
	emptyMessage = 'No rows.'
}: DataTableProps<T>) {
	const [sorting, setSorting] = React.useState<SortingState>([]);

	const table = useReactTable({
		data,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	});

	const rows = table.getRowModel().rows;
	const colCount = table.getVisibleLeafColumns().length + (numbered ? 1 : 0);

	return (
		<div className="tbl-card">
			<div className="scroll-x">
				<table className="grid-table">
					<thead>
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id}>
								{numbered && <th className="w-8 num">#</th>}
								{hg.headers.map((header) => {
									const canSort = header.column.getCanSort();
									const dir = header.column.getIsSorted();
									return (
										<th
											key={header.id}
											className={cn(
												header.column.columnDef.meta?.thClassName,
												canSort && 'cursor-pointer select-none'
											)}
											onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
											title={canSort ? 'Click to sort' : undefined}
										>
											{flexRender(header.column.columnDef.header, header.getContext())}
											{dir === 'asc' && ' ▲'}
											{dir === 'desc' && ' ▼'}
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody>
						{rows.map((row, i) => (
							<tr key={row.id}>
								{numbered && (
									<td className="num" style={{ color: 'var(--n-fg-subtle)' }}>
										{i + 1}
									</td>
								)}
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										className={cell.column.columnDef.meta?.tdClassName}
										style={cell.column.columnDef.meta?.tdStyle}
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
						{rows.length === 0 && (
							<tr>
								<td
									colSpan={colCount}
									className="text-center py-8"
									style={{ color: 'var(--n-fg-subtle)' }}
								>
									{emptyMessage}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default DataTable;
