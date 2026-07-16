'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Creator } from '@/lib/api';

export const CREATORS_QUERY_KEY = ['creators'] as const;

export function useCreatorsQuery() {
	return useQuery<Creator[]>({
		queryKey: CREATORS_QUERY_KEY,
		queryFn: () => api.get<Creator[]>('/creators/')
	});
}

export function useCreateCreatorMutation() {
	const queryClient = useQueryClient();
	return useMutation<Creator, Error, unknown>({
		mutationFn: (payload) => api.post<Creator>('/creators/', payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CREATORS_QUERY_KEY });
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
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}
