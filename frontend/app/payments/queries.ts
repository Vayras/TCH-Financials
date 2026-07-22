'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Deal, type DealDocument, type CreatorInvoice } from '@/lib/api';
import { uploadDealInvoice } from '@/lib/payments';

export const DEALS_QUERY_KEY = (fyStart: number) => ['deals', { fy: fyStart }] as const;
export const DEAL_DOCUMENTS_QUERY_KEY = ['deal-documents'] as const;
export const CREATOR_INVOICES_QUERY_KEY = ['creator-invoices'] as const;

export function useDealsQuery(fyStart: number | null) {
	return useQuery<Deal[]>({
		queryKey: DEALS_QUERY_KEY(fyStart ?? 0),
		enabled: fyStart !== null,
		queryFn: () => api.get<Deal[]>(`/deals/?fy=${fyStart!}`)
	});
}

export function useDealDocumentsQuery() {
	return useQuery<DealDocument[]>({
		queryKey: DEAL_DOCUMENTS_QUERY_KEY,
		queryFn: () => api.get<DealDocument[]>('/deal-documents/')
	});
}

export function useCreatorInvoicesQuery() {
	return useQuery<CreatorInvoice[]>({
		queryKey: CREATOR_INVOICES_QUERY_KEY,
		queryFn: () => api.get<CreatorInvoice[]>('/creator-invoices/')
	});
}

export function useMarkPaidMutation(fyStart: number | null) {
	const queryClient = useQueryClient();
	return useMutation<unknown, Error, { id: number; version: number }>({
		mutationFn: ({ id, version }) =>
			api.patch(`/deals/${id}/`, {
				payment_cleared: 'Y',
				creator_payment_status: 'Paid',
				creator_payment_date: new Date().toISOString().slice(0, 10),
				version
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['deals'] });
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}

interface UploadInvoiceParams {
	dealId: number;
	clientFile: File | null;
	creatorFile: File | null;
}

export function useUploadInvoiceMutation(fyStart: number | null) {
	const queryClient = useQueryClient();
	return useMutation<void, Error, UploadInvoiceParams>({
		mutationFn: async ({ dealId, clientFile, creatorFile }) => {
			if (clientFile) {
				await uploadDealInvoice(dealId, 'ClientInvoice', clientFile);
			}
			if (creatorFile) {
				await uploadDealInvoice(dealId, 'CreatorInvoice', creatorFile);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['deals'] });
			queryClient.invalidateQueries({ queryKey: DEAL_DOCUMENTS_QUERY_KEY });
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}
