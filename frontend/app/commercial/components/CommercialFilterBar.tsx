import * as React from 'react';
import Icon from '@/components/ui/Icon';
import type { CardGroupBy, DirFilter } from '@/types/deal';
import { MONTH_NAMES } from '@/lib/deals';

interface CommercialFilterBarProps {
	statusFilter: string;
	setStatusFilter: (s: string) => void;
	q: string;
	setQ: (s: string) => void;
	viewMode: 'cards' | 'table';
	groupBy: CardGroupBy;
	setGroupBy: (g: CardGroupBy) => void;
	dirFilter: DirFilter;
	setDirFilter: (d: DirFilter) => void;
	creatorFilter: string;
	setCreatorFilter: (c: string) => void;
	months: string[];
	setMonths: (m: string[]) => void;
	creatorNames: string[];
	availMonths: string[];
	resetFilters: () => void;
}

export function CommercialFilterBar({
	statusFilter,
	setStatusFilter,
	q,
	setQ,
	viewMode,
	groupBy,
	setGroupBy,
	dirFilter,
	setDirFilter,
	creatorFilter,
	setCreatorFilter,
	months,
	setMonths,
	creatorNames,
	availMonths,
	resetFilters,
}: CommercialFilterBarProps) {
	const [showFilters, setShowFilters] = React.useState(false);
	const popoverRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
				setShowFilters(false);
			}
		}
		if (showFilters) document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [showFilters]);

	const filtersActive =
		creatorFilter !== 'All' || months.length > 0 || dirFilter !== 'All' || statusFilter !== 'All' || q.trim() !== '';

	return (
		<div className="flex flex-col gap-4 mb-4">
			{/* Row 1: Status Tabs */}
			<div className="flex items-center gap-2 border-b" style={{ borderColor: 'var(--n-border)' }}>
				{['All', 'Awaiting Invoices', 'Pending Payment', 'Completed'].map((status) => {
					const isActive = statusFilter === status;
					return (
						<button
							key={status}
							onClick={() => setStatusFilter(status)}
							className={`px-4 py-2.5 font-medium transition-colors relative`}
							style={{
								fontSize: '12px',
								color: isActive ? 'var(--n-fg)' : 'var(--n-fg-subtle)',
							}}
						>
							{status === 'All' ? 'All Campaigns' : status}
							{isActive && (
								<div className="absolute bottom-0 left-0 right-0 h-[2px] bg-current rounded-t-sm" />
							)}
						</button>
					);
				})}
			</div>

			{/* Row 2: Search, View Toggles, Secondary Filters */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				{/* Left: Search */}
				<div className="relative flex-1 min-w-[240px] max-w-[600px]">
					<span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--n-fg-subtle)' }}>
						<Icon name="search" size={13} />
					</span>
					<input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search creator, brand, campaign…"
						className="h-9 w-full rounded-lg pl-9 pr-3 transition-colors focus:outline-none focus:ring-1 focus:ring-black/5"
						style={{ fontSize: '12px', background: 'var(--n-bg)', color: 'var(--n-fg)', border: '1px solid var(--n-border)' }}
					/>
				</div>

				{/* Right: Actions */}
				<div className="flex items-center gap-2">
					{viewMode === 'cards' && (
						<div className="flex items-center p-1 rounded-lg border" style={{ background: 'var(--n-bg-soft)', borderColor: 'var(--n-border)' }}>
							<button
								onClick={() => setGroupBy('campaign')}
								className={`px-3 py-1 font-medium rounded-md transition-all ${groupBy === 'campaign' ? 'shadow-sm' : ''}`}
								style={{
									fontSize: '12px',
									background: groupBy === 'campaign' ? 'var(--n-bg)' : 'transparent',
									color: groupBy === 'campaign' ? 'var(--n-fg)' : 'var(--n-fg-subtle)'
								}}
							>
								By Campaign
							</button>
							<button
								onClick={() => setGroupBy('creator')}
								className={`px-3 py-1 font-medium rounded-md transition-all ${groupBy === 'creator' ? 'shadow-sm' : ''}`}
								style={{
									fontSize: '12px',
									background: groupBy === 'creator' ? 'var(--n-bg)' : 'transparent',
									color: groupBy === 'creator' ? 'var(--n-fg)' : 'var(--n-fg-subtle)'
								}}
							>
								By Creator
							</button>
						</div>
					)}

					<div className="relative" ref={popoverRef}>
						<button
							onClick={() => setShowFilters(!showFilters)}
							className="h-9 px-3 rounded-lg font-medium flex items-center gap-2 transition-colors border hover:opacity-80"
							style={{ fontSize: '12px', background: showFilters ? 'var(--n-bg-hover)' : 'var(--n-bg)', color: 'var(--n-fg)', borderColor: 'var(--n-border)' }}
						>
							<Icon name="filter" size={14} />
							Filters
							{(() => {
								const count = (dirFilter !== 'All' ? 1 : 0) + (creatorFilter !== 'All' ? 1 : 0) + (months.length > 0 ? 1 : 0);
								return count > 0 ? (
									<span className="flex items-center justify-center bg-black text-white text-[10px] rounded-full h-4 min-w-[16px] px-1 font-bold">
										{count}
									</span>
								) : null;
							})()}
						</button>

						{showFilters && (
							<div className="filter-popover absolute right-0 top-[calc(100%+8px)] w-[260px] rounded-xl z-50 p-4 anim-fade-up">
								<div className="flex flex-col gap-4">
									<div className="flex items-center justify-between">
										<h4 className="text-[12px] font-bold" style={{ color: 'var(--n-fg)' }}>Filters</h4>
										{filtersActive && (
											<button onClick={resetFilters} className="text-[12px] font-medium transition-opacity hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
												<Icon name="x" size={12} />
												Clear All
											</button>
										)}
									</div>

									<div className="flex flex-col gap-1.5">
										<label className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Direction</label>
										<select
											value={dirFilter}
											onChange={(e) => setDirFilter(e.target.value as DirFilter)}
											className="h-8 rounded-md px-2 text-[12px] focus:outline-none border w-full"
											style={{ background: 'var(--n-bg-soft)', color: 'var(--n-fg)', borderColor: 'var(--n-border)' }}
										>
											{(['All', 'Inbound', 'Outbound'] as DirFilter[]).map((d) => <option key={d} value={d}>{d === 'All' ? 'All Types' : d}</option>)}
										</select>
									</div>

									<div className="flex flex-col gap-1.5">
										<label className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Creator</label>
										<select
											value={creatorFilter}
											onChange={(e) => setCreatorFilter(e.target.value)}
											className="h-8 rounded-md px-2 text-[12px] focus:outline-none border w-full"
											style={{ background: 'var(--n-bg-soft)', color: 'var(--n-fg)', borderColor: 'var(--n-border)' }}
										>
											<option value="All">All Creators</option>
											{creatorNames.map((n) => <option key={n} value={n}>{n}</option>)}
										</select>
									</div>

									<div className="flex flex-col gap-1.5">
										<label className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Month</label>
										<select
											value={months[0] ?? ''}
											onChange={(e) => setMonths(e.target.value ? [e.target.value] : [])}
											className="h-8 rounded-md px-2 text-[12px] focus:outline-none border w-full"
											style={{ background: 'var(--n-bg-soft)', color: 'var(--n-fg)', borderColor: 'var(--n-border)' }}
										>
											<option value="">All Months</option>
											{availMonths.map((mm) => <option key={mm} value={mm}>{MONTH_NAMES[Number(mm)]}</option>)}
										</select>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
