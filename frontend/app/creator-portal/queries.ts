import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Deal, type CreatorInvoice } from '@/lib/api';
import { type TdsEntryItem } from '../payments/queries';

export type CreatorPortalPage<T> = {
  items: T[];
  page: number;
  page_size: number;
  has_more: boolean;
};

function useCreatorPortalPages<T>(key: string, path: string) {
  return useInfiniteQuery<CreatorPortalPage<T>>({
    queryKey: ['creator-portal', key],
    queryFn: ({ pageParam }) =>
      api.get<CreatorPortalPage<T>>(`${path}?page=${pageParam}&page_size=50`),
    initialPageParam: 1,
    getNextPageParam: (page) => (page.has_more ? page.page + 1 : undefined),
  });
}

export function useCreatorPortalDealsQuery() {
  return useCreatorPortalPages<Deal>('deals', '/deals/creator-portal');
}

export function useCreatorFinanceSummaryQuery() {
  return useQuery({
    queryKey: ['creator-portal', 'finance-summary'],
    queryFn: () =>
      api.get<{ paid: string; pending: string; missing_invoice_count: number }>(
        '/deals/creator-portal/summary',
      ),
  });
}

export function useCreatorPortalInvoicesQuery() {
  return useCreatorPortalPages<CreatorInvoice>('invoices', '/creator-invoices/creator-portal');
}

export type EligibleInvoiceDeal = {
  id: number;
  brand: string;
  campaign: string | null;
  creator_fee: string;
};

export function useEligibleInvoiceDealsQuery() {
  return useCreatorPortalPages<EligibleInvoiceDeal>(
    'eligible-invoice-deals',
    '/creator-invoices/creator-portal/eligible-deals',
  );
}

export function useCreatorPortalTdsQuery() {
  return useCreatorPortalPages<TdsEntryItem>('tds', '/tds/creator-portal');
}

export function useSubmitCreatorInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dealId,
      invoiceNumber,
      invoiceDate,
      invoiceAmount,
      file,
    }: {
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
      queryClient.invalidateQueries({ queryKey: ['creator-portal', 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['creator-portal', 'eligible-invoice-deals'] });
    },
  });
}
