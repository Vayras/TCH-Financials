import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Deal, type CreatorInvoice } from '@/lib/api';
import { type TdsEntryItem } from '../payments/queries';

export function useCreatorPortalDealsQuery() {
	return useQuery<Deal[]>({
		queryKey: ['creator-portal-deals'],
		queryFn: () => api.get<Deal[]>('/deals/creator-portal')
	});
}

export function useCreatorPortalInvoicesQuery() {
	return useQuery<CreatorInvoice[]>({
		queryKey: ['creator-portal-invoices'],
		queryFn: () => api.get<CreatorInvoice[]>('/creator-invoices/creator-portal')
	});
}

export function useCreatorPortalTdsQuery() {
	return useQuery<TdsEntryItem[]>({
		queryKey: ['creator-portal-tds'],
		queryFn: () => api.get<TdsEntryItem[]>('/tds/creator-portal')
	});
}

export function useSubmitCreatorInvoiceMutation() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ dealId, invoiceNumber, invoiceDate, invoiceAmount, file }: {
			dealId: string;
			invoiceNumber: string;
			invoiceDate: string;
			invoiceAmount: number;
			file: File;
		}) => {
			const formData = new FormData();
			formData.append('deal', dealId);
			formData.append('invoice_number', invoiceNumber);
			formData.append('invoice_date', invoiceDate);
			formData.append('invoice_amount', String(invoiceAmount));
			formData.append('file', file);
			return api.upload<CreatorInvoice>('/creator-invoices/creator-portal', formData);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['creator-portal-invoices'] });
		}
	});
}
