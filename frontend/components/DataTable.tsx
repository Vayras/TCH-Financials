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
import Pagination from '@/components/Pagination';

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
	loading?: boolean;
	pageSize?: number;
	pagination?: boolean;
	rowOffset?: number;
}

export function DataTable<T>({
	data,
	columns,
	numbered = false,
	emptyMessage = 'No rows.',
	loading = false,
	pageSize: initialPageSize = 25,
	pagination = true,
	rowOffset = 0
}: DataTableProps<T>) {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(initialPageSize);

	const table = useReactTable({
		data,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
	});

	const allRows = table.getRowModel().rows;
	const pages = Math.max(1, Math.ceil(allRows.length / pageSize));
	React.useEffect(() => setPage(1), [data, sorting, pageSize]);
	React.useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
	const rows = pagination ? allRows.slice((page - 1) * pageSize, page * pageSize) : allRows;
	const colCount = table.getVisibleLeafColumns().length + (numbered ? 1 : 0);

	return (
		<div className="tbl-card" aria-busy={loading}>
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
						{loading ? Array.from({ length: 6 }).map((_, i) => (
							<tr key={`skeleton-${i}`} className="table-skeleton-row" aria-hidden="true">
								<td colSpan={colCount}><span /></td>
							</tr>
						)) : rows.map((row, i) => (
							<tr key={row.id}>
								{numbered && (
									<td className="num" style={{ color: 'var(--n-fg-subtle)' }}>
										{rowOffset + (page - 1) * pageSize + i + 1}
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
						{!loading && rows.length === 0 && (
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
			{!loading && pagination && allRows.length > 0 && (
				<Pagination page={page} pageSize={pageSize} total={allRows.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
			)}
		</div>
	);
}

export default DataTable;
