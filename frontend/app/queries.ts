'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type Overview, type Creator } from '@/lib/api';

export const OVERVIEW_QUERY_KEY = (fyStart: number, creatorFilter: string) =>
	['overview', { fy: fyStart, creator: creatorFilter }] as const;

export const OVERVIEW_CREATORS_QUERY_KEY = ['creators'] as const;

export function useOverviewQuery(fyStart: number | null, creatorFilter: string) {
	return useQuery<Overview>({
		queryKey: OVERVIEW_QUERY_KEY(fyStart ?? 0, creatorFilter),
		enabled: fyStart !== null,
		queryFn: () => {
			const params = new URLSearchParams({ fy: String(fyStart!) });
			if (creatorFilter !== 'All') params.set('creator', creatorFilter);
			return api.get<Overview>(`/overview/?${params}`);
		}
	});
}

export function useOverviewCreatorsQuery() {
	return useQuery<Creator[]>({
		queryKey: OVERVIEW_CREATORS_QUERY_KEY,
		queryFn: () => api.get<Creator[]>('/creators/')
	});
}
