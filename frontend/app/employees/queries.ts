'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type EmployeeReport } from '@/lib/api';

export const EMPLOYEE_REPORTS_QUERY_KEY = ['employee-reports'] as const;

export function useEmployeeReportsQuery() {
	return useQuery<EmployeeReport[]>({
		queryKey: EMPLOYEE_REPORTS_QUERY_KEY,
		queryFn: () => api.get<EmployeeReport[]>('/employee-reports/')
	});
}

export function useCreateEmployeeReportMutation() {
	const queryClient = useQueryClient();
	return useMutation<unknown, Error, unknown>({
		mutationFn: (payload) => api.post('/employee-reports/', payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: EMPLOYEE_REPORTS_QUERY_KEY });
		}
	});
}

export function useUpdateEmployeeReportMutation() {
	const queryClient = useQueryClient();
	return useMutation<unknown, Error, { id: number; version: number; payload: unknown }>({
		mutationFn: ({ id, version, payload }) =>
			api.patch(`/employee-reports/${id}/`, {
				...(payload as Record<string, unknown>),
				version
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: EMPLOYEE_REPORTS_QUERY_KEY });
		}
	});
}

export function useDeleteEmployeeReportMutation() {
	const queryClient = useQueryClient();
	return useMutation<void, Error, number>({
		mutationFn: (id) => api.del(`/employee-reports/${id}/`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: EMPLOYEE_REPORTS_QUERY_KEY });
		}
	});
}
