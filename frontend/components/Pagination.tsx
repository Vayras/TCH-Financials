import * as React from 'react';
import Button from '@/components/ui/Button';

export interface PaginationProps {
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
	onPageSizeChange?: (pageSize: number) => void;
	pageSizeOptions?: number[];
}

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [25, 50, 100] }: PaginationProps) {
	const pages = Math.max(1, Math.ceil(total / pageSize));
	const safePage = Math.min(Math.max(page, 1), pages);
	const first = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
	const last = Math.min(safePage * pageSize, total);

	return (
		<nav className="table-pagination" aria-label="Table pagination">
			<div className="table-pagination-range">{first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}</div>
			<div className="table-pagination-controls">
				{onPageSizeChange && (
					<label className="table-page-size">
						<span>Rows</span>
						<select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
							{pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
						</select>
					</label>
				)}
				<span className="table-page-label">Page {safePage} of {pages}</span>
				<Button variant="outline" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} aria-label="Previous page">Previous</Button>
				<Button variant="outline" disabled={safePage >= pages} onClick={() => onPageChange(safePage + 1)} aria-label="Next page">Next</Button>
			</div>
		</nav>
	);
}
