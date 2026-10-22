'use client';
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthGuard';
import { api } from '@/lib/api';

export function useBriefQuery<T>(
  path: string,
  enabled = true,
  refetchInterval: number | false = false,
) {
  const { email, role, creatorId } = useAuth();
  return useQuery<T>({
    queryKey: ['campaign-content', email, role, creatorId, path],
    queryFn: () => api.get<T>(path),
    enabled: enabled && Boolean(email),
    refetchInterval,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export const briefPath = (id: string) => `/campaigns/${encodeURIComponent(id)}/brief`;

export function useGenerateAiIdeasMutation(campaignId: string) {
  const queryClient = useQueryClient();
  const requestKey = React.useRef<string | null>(null);
  return useMutation({
    mutationFn: async (reference_ids: string[] = []) => {
      if (!requestKey.current) {
        const storageKey = `campaign-ai:${campaignId}`;
        try {
          requestKey.current = sessionStorage.getItem(storageKey);
        } catch {
          /* storage can be disabled */
        }
        requestKey.current ||= crypto.randomUUID();
        try {
          sessionStorage.setItem(storageKey, requestKey.current);
        } catch {
          /* key still survives in memory */
        }
      }
      return api.post<{ job_id: string; status: string; ideas: any[] }>(
        `/campaigns/${encodeURIComponent(campaignId)}/ai-ideas/generate`,
        { reference_ids },
        { 'Idempotency-Key': requestKey.current },
      );
    },
    onSuccess: () => {
      requestKey.current = null;
      try {
        sessionStorage.removeItem(`campaign-ai:${campaignId}`);
      } catch {
        /* ignore unavailable storage */
      }
      queryClient.invalidateQueries({ queryKey: ['campaign-content'] });
    },
  });
}

export function useCampaignReferences(campaignId: string) {
  const client = useQueryClient();
  const query = useBriefQuery<{ items: any[] }>(
    `/creator-portal/campaign-briefs/${encodeURIComponent(campaignId)}/content-references`,
  );
  const toggle = async (snapshotId: string, postId: string, referenceId?: string) => {
    if (referenceId)
      await api.del(
        `/creator-portal/campaign-briefs/${encodeURIComponent(campaignId)}/content-references/${referenceId}`,
      );
    else
      await api.post(
        `/creator-portal/campaign-briefs/${encodeURIComponent(campaignId)}/content-references`,
        { snapshot_id: snapshotId, post_id: postId },
      );
    await client.invalidateQueries({ queryKey: ['campaign-content'] });
  };
  return { ...query, toggle };
}

export function useExpandAiIdeaMutation(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ideaId: string) => {
      return api.post<{ concept_id: string; revision_id: string; version: number }>(
        `/campaigns/${encodeURIComponent(campaignId)}/ai-ideas/${encodeURIComponent(ideaId)}/expand`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-content'] });
    },
  });
}
