'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Creator, type CreatorPage } from '@/lib/api';

export const CREATORS_QUERY_KEY = ['creators'] as const;

export function useCreatorsQuery() {
	return useQuery<Creator[]>({
		queryKey: CREATORS_QUERY_KEY,
		queryFn: () => api.get<Creator[]>('/creators/')
	});
}

export interface CreatorPageParams {
	page: number;
	pageSize: number;
	search?: string;
	relationship?: string;
	status?: string;
}

export function useCreatorsPageQuery(params: CreatorPageParams) {
	return useQuery<CreatorPage>({
		queryKey: ['creators-page', params],
		queryFn: () => {
			const query = new URLSearchParams({
				page: String(params.page), page_size: String(params.pageSize),
				sort_by: 'name', sort_order: 'asc'
			});
			if (params.search) query.set('search', params.search);
			if (params.relationship) query.set('relationship', params.relationship);
			if (params.status) query.set('status', params.status);
			return api.get<CreatorPage>(`/creators/?${query}`);
		},
		placeholderData: (previous) => previous
	});
}

export function useCreateCreatorMutation() {
	const queryClient = useQueryClient();
	return useMutation<Creator, Error, unknown>({
		mutationFn: (payload) => api.post<Creator>('/creators/', payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CREATORS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ['creators-page'] });
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}

export function useUpdateCreatorMutation() {
	const queryClient = useQueryClient();
	return useMutation<unknown, Error, { id: number; payload: unknown }>({
		mutationFn: ({ id, payload }) => api.patch(`/creators/${id}/`, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CREATORS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ['creators-page'] });
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}

export function useDeleteCreatorMutation() {
	const queryClient = useQueryClient();
	return useMutation<void, Error, number>({
		mutationFn: (id) => api.del(`/creators/${id}/`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CREATORS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ['creators-page'] });
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}
