import * as React from 'react';
import type { CardGroupBy, DirFilter } from '@/types/deal';

export function useCommercialFilters() {
	const [q, setQ] = React.useState('');
	const [dirFilter, setDirFilter] = React.useState<DirFilter>('All');
	const [statusFilter, setStatusFilter] = React.useState('All');
	const [months, setMonths] = React.useState<string[]>([]);
	const [creatorFilter, setCreatorFilter] = React.useState('All');
	
	const [groupBy, setGroupBy] = React.useState<CardGroupBy>(() => {
		if (typeof window === 'undefined') return 'campaign';
		const saved = window.localStorage.getItem('commercial-card-group');
		return saved === 'campaign' || saved === 'creator' ? saved : 'campaign';
	});
	
	const [viewMode, setViewMode] = React.useState<'cards' | 'table'>(() => {
		if (typeof window === 'undefined') return 'cards';
		const saved = window.localStorage.getItem('commercial-view-mode');
		return saved === 'cards' || saved === 'table' ? saved : 'cards';
	});
	
	const [page, setPage] = React.useState(1);
	const [urlHydrated, setUrlHydrated] = React.useState(false);
	
	React.useEffect(() => {
		window.localStorage.setItem('commercial-card-group', groupBy);
	}, [groupBy]);

	React.useEffect(() => {
		window.localStorage.setItem('commercial-view-mode', viewMode);
	}, [viewMode]);

	React.useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		setQ(params.get('search') ?? '');
		const direction = params.get('direction');
		if (direction === 'Inbound' || direction === 'Outbound') setDirFilter(direction);
		const status = params.get('status');
		if (status) setStatusFilter(status);
		setCreatorFilter(params.get('creator') ?? 'All');
		setMonths(params.get('month') ? [params.get('month')!] : []);
		const urlGroup = params.get('group');
		if (urlGroup === 'campaign' || urlGroup === 'creator') setGroupBy(urlGroup as CardGroupBy);
		const urlView = params.get('view');
		if (urlView === 'cards' || urlView === 'table') setViewMode(urlView as 'cards' | 'table');
		const urlPage = Number(params.get('page'));
		if (Number.isInteger(urlPage) && urlPage > 0) setPage(urlPage);
		setUrlHydrated(true);
	}, []);

	React.useEffect(() => {
		if (!urlHydrated) return;
		const params = new URLSearchParams();
		if (q.trim()) params.set('search', q.trim());
		if (dirFilter !== 'All') params.set('direction', dirFilter);
		if (statusFilter !== 'All') params.set('status', statusFilter);
		if (creatorFilter !== 'All') params.set('creator', creatorFilter);
		if (months[0]) params.set('month', months[0]);
		if (viewMode !== 'cards') params.set('view', viewMode);
		if (groupBy !== 'campaign') params.set('group', groupBy);
		if (page > 1) params.set('page', String(page));
		const query = params.toString();
		window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
	}, [urlHydrated, q, dirFilter, statusFilter, creatorFilter, months, viewMode, groupBy, page]);

	function resetFilters() {
		setCreatorFilter('All');
		setMonths([]);
		setDirFilter('All');
		setStatusFilter('All');
		setQ('');
	}

	return {
		q, setQ,
		dirFilter, setDirFilter,
		statusFilter, setStatusFilter,
		months, setMonths,
		creatorFilter, setCreatorFilter,
		groupBy, setGroupBy,
		viewMode, setViewMode,
		page, setPage,
		urlHydrated,
		resetFilters,
	};
}
