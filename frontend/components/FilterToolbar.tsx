import * as React from 'react';
import Icon from '@/components/ui/Icon';

export interface FilterToolbarProps {
	search?: { value: string; onChange: (value: string) => void; placeholder?: string };
	children?: React.ReactNode;
	resultCount?: number;
	resultLabel?: string;
	actions?: React.ReactNode;
}

export default function FilterToolbar({ search, children, resultCount, resultLabel = 'results', actions }: FilterToolbarProps) {
	return (
		<div className="filter-toolbar">
			<div className="filter-toolbar-controls">
				{search && (
					<label className="filter-search">
						<span className="sr-only">Search</span>
						<Icon name="search" size={14} />
						<input
							value={search.value}
							onChange={(e) => search.onChange(e.target.value)}
							placeholder={search.placeholder ?? 'Search…'}
						/>
					</label>
				)}
				{children}
			</div>
			{(resultCount !== undefined || actions) && (
				<div className="filter-toolbar-meta">
					{resultCount !== undefined && <span>{resultCount.toLocaleString()} {resultLabel}</span>}
					{actions}
				</div>
			)}
		</div>
	);
}
