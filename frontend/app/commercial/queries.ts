import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Deal, type DealPage, type CommercialGroupPage, type Creator, type DealDocument, type Campaign } from '@/lib/api';
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

export interface DealPageParams {
	fyStart: number | null;
	page: number;
	pageSize: number;
	search?: string;
	direction?: string;
	creator?: number;
	months?: number[];
	sortBy?: 'billing_period' | 'confirmation_date' | 'total_fee' | 'brand' | 'created_at';
	sortOrder?: 'asc' | 'desc';
	groupBy?: 'campaign' | 'creator';
	enabled?: boolean;
	periodOnly?: boolean;
}

function dealPageQuery(params: DealPageParams): URLSearchParams {
	const query = new URLSearchParams({
		fy: String(params.fyStart), page: String(params.page), page_size: String(params.pageSize)
	});
	if (params.search) query.set('search', params.search);
	if (params.direction) query.set('direction', params.direction);
	if (params.creator) query.set('creator', String(params.creator));
	if (params.months?.length) query.set('months', params.months.join(','));
	if (params.sortBy) query.set('sort_by', params.sortBy);
	if (params.sortOrder) query.set('sort_order', params.sortOrder);
	if (params.groupBy) query.set('group_by', params.groupBy);
	if (params.periodOnly) query.set('period_only', '1');
	return query;
}

// Ready for server-driven tables. Campaign cards intentionally use the full
// FY query for now because their 12-item pages are grouped campaigns, not deals.
export function useCommercialDealsPageQuery(params: DealPageParams) {
	return useQuery<DealPage>({
		queryKey: ['deals-page', params],
		enabled: params.fyStart !== null && (params.enabled ?? true),
		queryFn: () => api.get<DealPage>(`/deals/?${dealPageQuery(params)}`)
	});
}

export function useCommercialGroupPageQuery(params: DealPageParams) {
	return useQuery<CommercialGroupPage>({
		queryKey: ['deal-groups-page', params],
		enabled: params.fyStart !== null && !!params.groupBy && (params.enabled ?? true),
		queryFn: () => api.get<CommercialGroupPage>(`/deals/?${dealPageQuery(params)}`),
		placeholderData: (previous) => previous
	});
}

export function useCommercialDealQuery(id: number | null) {
	return useQuery<Deal>({
		queryKey: ['deal', id],
		queryFn: () => api.get<Deal>(`/deals/${id}/`),
		enabled: id !== null
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
				await Promise.all(
					uploads.map(async ([file, docType]) => {
						if (!file) return;
						try {
							await uploadDealInvoice(deal.id, docType, file);
						} catch {
							alert(`Campaign saved, but "${docType === 'ClientInvoice' ? 'Client' : 'Creator'} Invoice" failed to upload.`);
						}
					})
				);
			}
			return deal;
		},
		onSuccess: (updatedDeal) => {
			if (fyStart !== null) {
				queryClient.setQueryData<Deal[]>(COMMERCIAL_DEALS_KEY(fyStart), (old) => {
					if (!old) return old;
					const exists = old.some((d) => d.id === updatedDeal.id);
					if (exists) {
						return old.map((d) => (d.id === updatedDeal.id ? updatedDeal : d));
					}
					return [updatedDeal, ...old];
				});
			}
			queryClient.invalidateQueries({ queryKey: ['deals'] });
			queryClient.invalidateQueries({ queryKey: COMMERCIAL_CREATORS_KEY });
			queryClient.invalidateQueries({ queryKey: ['deals-page'] });
			queryClient.invalidateQueries({ queryKey: ['deal-groups-page'] });
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
			queryClient.invalidateQueries({ queryKey: ['deals-page'] });
			queryClient.invalidateQueries({ queryKey: ['deal-groups-page'] });
			queryClient.invalidateQueries({ queryKey: ['overview'] });
		}
	});
}
