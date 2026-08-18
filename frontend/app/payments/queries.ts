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

export function useMarkClientPaidMutation() {
	const queryClient = useQueryClient();
	return useMutation<unknown, Error, { id: number; version: number }>({
		mutationFn: ({ id, version }) =>
			api.patch(`/deals/${id}/`, {
				payment_cleared: 'Y',
				client_payment_date: new Date().toISOString().slice(0, 10),
				version
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['deals'] });
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}

export function useMarkCreatorPaidMutation() {
	const queryClient = useQueryClient();
	return useMutation<unknown, Error, { id: number; version: number }>({
		mutationFn: ({ id, version }) =>
			api.patch(`/deals/${id}/`, {
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

export function useUploadInvoiceMutation() {
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

export interface PaymentTransactionItem {
	id: string;
	transactionDate: string;
	vendorName: string;
	utrOrRef: string;
	debitAmount: string;
	creditAmount: string;
	notes: string;
	createdAt: string;
	deal?: Deal;
	creator?: { id: string; name: string };
}

export interface PaymentTransactionResponse {
	items: PaymentTransactionItem[];
	page: number;
	page_size: number;
	total: number;
	total_pages: number;
	summary: {
		total_debit: string;
		total_credit: string;
	};
}

export const PAYMENT_TRANSACTIONS_QUERY_KEY = (page: number, search: string) =>
	['payment-transactions', { page, search }] as const;

export function usePaymentTransactionsQuery(page: number, search: string) {
	return useQuery<PaymentTransactionResponse>({
		queryKey: PAYMENT_TRANSACTIONS_QUERY_KEY(page, search),
		queryFn: () => {
			const params = new URLSearchParams({ page: String(page) });
			if (search.trim()) params.set('search', search.trim());
			return api.get<PaymentTransactionResponse>(`/payment-transactions?${params.toString()}`);
		}
	});
}

export function useAddPaymentTransactionMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			transactionDate: string;
			vendorName: string;
			utrOrRef: string;
			debitAmount?: number;
			creditAmount?: number;
			notes?: string;
		}) => api.post('/payment-transactions', body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['payment-transactions'] });
		}
	});
}

export function useImportPaymentTransactionsMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (file: File) => {
			const formData = new FormData();
			formData.append('file', file);
			return api.upload<{ success: boolean; imported_count: number; skipped: Array<{ row: number; reason: string }> }>('/payment-transactions/import', formData);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['payment-transactions'] });
		}
	});
}

export interface TdsEntryItem {
	id: string;
	creatorId: string;
	dealId: string | null;
	quarter: string;
	tdsRate: string;
	grossAmount: string;
	tdsAmount: string;
	netPayable: string;
	remittanceDate: string | null;
	challanNumber: string;
	status: 'Pending' | 'Remitted';
	notes: string;
	createdAt: string;
	creator: {
		id: string;
		name: string;
	};
}

export function useTdsEntriesQuery(creatorId?: string, status?: string) {
	return useQuery<TdsEntryItem[]>({
		queryKey: ['tds-entries', { creatorId, status }],
		queryFn: () => {
			const params = new URLSearchParams();
			if (creatorId) params.set('creatorId', creatorId);
			if (status) params.set('status', status);
			return api.get<TdsEntryItem[]>(`/tds?${params.toString()}`);
		}
	});
}

export function useAddTdsEntryMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			creatorId: string;
			dealId?: string | null;
			quarter: string;
			tdsRate: number;
			grossAmount: number;
			notes?: string;
		}) => api.post('/tds', body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tds-entries'] });
		}
	});
}

export function useUpdateTdsRemittanceMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, remittanceDate, challanNumber, notes }: {
			id: string;
			remittanceDate: string;
			challanNumber: string;
			notes?: string;
		}) => api.patch(`/tds/${id}`, { remittanceDate, challanNumber, notes }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['tds-entries'] });
		}
	});
}
