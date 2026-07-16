import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Deal, type Creator, type DealDocument, type Campaign } from '@/lib/api';
import { uploadDealInvoice } from '@/lib/payments';

export const COMMERCIAL_DEALS_KEY = (fyStart: number) => ['deals', { fy: fyStart }] as const;
export const COMMERCIAL_CREATORS_KEY = ['creators'] as const;
export const COMMERCIAL_CAMPAIGNS_KEY = ['campaigns'] as const;
export const COMMERCIAL_DOCS_KEY = ['deal-documents'] as const;

export function useCommercialDealsQuery(fyStart: number | null) {
	return useQuery<Deal[]>({
		queryKey: COMMERCIAL_DEALS_KEY(fyStart ?? 0),
		enabled: fyStart !== null,
		queryFn: () => api.get<Deal[]>(`/deals/?fy=${fyStart!}`)
	});
}

export function useCommercialCreatorsQuery() {
	return useQuery<Creator[]>({
		queryKey: COMMERCIAL_CREATORS_KEY,
		queryFn: () => api.get<Creator[]>('/creators/')
	});
}

export function useCommercialCampaignsQuery() {
	return useQuery<Campaign[]>({
		queryKey: COMMERCIAL_CAMPAIGNS_KEY,
		queryFn: () => api.get<Campaign[]>('/campaigns/')
	});
}

export function useCommercialDocsQuery() {
	return useQuery<DealDocument[]>({
		queryKey: COMMERCIAL_DOCS_KEY,
		queryFn: () => api.get<DealDocument[]>('/deal-documents/')
	});
}

interface SaveDealParams {
	editingId?: number;
	editingVersion?: number;
	payload: unknown;
	clientInvoiceFile: File | null;
	creatorInvoiceFile: File | null;
}

export function useSaveDealMutation(fyStart: number | null) {
	const queryClient = useQueryClient();
	return useMutation<Deal, Error, SaveDealParams>({
		mutationFn: async ({ editingId, editingVersion, payload, clientInvoiceFile, creatorInvoiceFile }) => {
			let deal: Deal;
			if (editingId && editingVersion !== undefined) {
				deal = await api.patch<Deal>(`/deals/${editingId}/`, {
					...(payload as Record<string, unknown>),
					version: editingVersion
				});
			} else {
				deal = await api.post<Deal>('/deals/', payload);
			}

			if (deal && deal.id) {
				const uploads: [File | null, 'ClientInvoice' | 'CreatorInvoice'][] = [
					[clientInvoiceFile, 'ClientInvoice'],
					[creatorInvoiceFile, 'CreatorInvoice']
				];
				for (const [file, docType] of uploads) {
					if (!file) continue;
					try {
						await uploadDealInvoice(deal.id, docType, file);
					} catch {
						alert(`Campaign saved, but "${docType === 'ClientInvoice' ? 'Client' : 'Creator'} Invoice" failed to upload.`);
					}
				}
			}
			return deal;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['deals'] });
			queryClient.invalidateQueries({ queryKey: COMMERCIAL_CREATORS_KEY });
			queryClient.invalidateQueries({ queryKey: COMMERCIAL_CAMPAIGNS_KEY });
			queryClient.invalidateQueries({ queryKey: COMMERCIAL_DOCS_KEY });
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}

export function useDeleteDealMutation(fyStart: number | null) {
	const queryClient = useQueryClient();
	return useMutation<void, Error, number>({
		mutationFn: (id) => api.del(`/deals/${id}/`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['deals'] });
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}
