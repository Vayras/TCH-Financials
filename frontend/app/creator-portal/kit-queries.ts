'use client';
import { useEffect } from 'react';
import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { activeImport, type SocialAccount, type SocialSnapshot, type KitRecord, type KitDraft } from '@/lib/creator-kit';

export function useSocialAccounts() {
  const { creatorId } = useAuth();
  const client = useQueryClient();
  const result = useQuery({ queryKey: ['creator-social-accounts', creatorId], enabled: !!creatorId,
    queryFn: () => api.get<SocialAccount[]>('/creator-portal/social-accounts'), retry: 1,
    refetchInterval: query => query.state.error ? false : query.state.data?.some(a => activeImport(a.latest_job_state)) ? 4000 : false,
    refetchIntervalInBackground: false,
  });
  const completed = result.data?.map(a=>`${a.id}:${a.snapshot_id}`).join('|');
  useEffect(()=>{ if(completed)client.invalidateQueries({queryKey:['creator-brand-kit',creatorId]}); },[completed,creatorId,client]);
  return result;
}
export function useKit() {
  const { creatorId } = useAuth();
  return useQuery({ queryKey: ['creator-brand-kit', creatorId], enabled: !!creatorId, retry: 1, queryFn: () => api.get<KitRecord>('/creator-portal/brand-kit') });
}
export function useSavedSnapshots(accounts: SocialAccount[]) {
  const { creatorId } = useAuth();
  return useQueries({ queries: accounts.filter(a => a.snapshot_id).map(a => ({
    queryKey: ['creator-snapshot', creatorId, a.id, a.snapshot_id],
    queryFn: () => api.get<SocialSnapshot>(`/creator-portal/social-accounts/${a.id}/snapshot?snapshot_id=${a.snapshot_id}`),
    enabled: !!creatorId, staleTime: Infinity, retry: 1,
  })) });
}
export function useKitActions() {
  const client = useQueryClient();
  const { creatorId } = useAuth();
  const update = (data: KitRecord) => client.setQueryData(['creator-brand-kit', creatorId], data);
  const save = useMutation({ mutationFn: (body: { version: number; draft: KitDraft }) => api.put<KitRecord>('/creator-portal/brand-kit', body), onSuccess: update });
  const publish = useMutation({ mutationFn: (version: number) => api.post<KitRecord>('/creator-portal/brand-kit/publish', { version }), onSuccess: update });
  const unpublish = useMutation({ mutationFn: (version: number) => api.post<KitRecord>('/creator-portal/brand-kit/unpublish', { version }), onSuccess: update });
  return { save, publish, unpublish };
}
