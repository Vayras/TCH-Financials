'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type AlertsPayload } from '@/lib/api';

export const ALERTS_QUERY_KEY = ['alerts'] as const;

export function useAlertsQuery() {
	return useQuery<AlertsPayload>({
		queryKey: ALERTS_QUERY_KEY,
		queryFn: () => api.get<AlertsPayload>('/alerts/')
	});
}

export function useDismissAlertsMutation() {
	const queryClient = useQueryClient();
	return useMutation<void, Error, string[]>({
		mutationFn: async (keys) => {
			if (keys.length === 0) return;
			await api.post('/alerts/dismiss/', { keys });
		},
		onSuccess: (_, keys) => {
			queryClient.setQueryData<AlertsPayload>(ALERTS_QUERY_KEY, (oldData) => {
				if (!oldData) return oldData;
				const gone = new Set(keys);
				const sections = ['urgent', 'payments', 'bd', 'health', 'docs', 'seasonal'] as const;
				const next = { ...oldData, dismissed_count: oldData.dismissed_count + keys.length };
				for (const k of sections) {
					const items = oldData[k].filter((it) => !gone.has(it.key));
					next[k] = items;
					next.counts = { ...next.counts, [k]: items.length };
				}
				return next;
			});
		}
	});
}

export function useRestoreAllAlertsMutation() {
	const queryClient = useQueryClient();
	return useMutation<void, Error, void>({
		mutationFn: () => api.post('/alerts/restore/', {}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ALERTS_QUERY_KEY });
		}
	});
}
