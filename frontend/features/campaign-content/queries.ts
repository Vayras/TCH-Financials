'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthGuard';
import { api } from '@/lib/api';

export function useBriefQuery<T>(path: string, enabled = true) {
  const { email, role, creatorId } = useAuth();
  return useQuery<T>({
    queryKey: ['campaign-content', email, role, creatorId, path],
    queryFn: () => api.get<T>(path),
    enabled: enabled && Boolean(email),
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
  return useMutation({
    mutationFn: async () => {
      return api.post<{ job_id: string; status: string; ideas: any[] }>(
        `/campaigns/${encodeURIComponent(campaignId)}/ai-ideas/generate`,
        {}
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-content'] });
    },
  });
}

export function useExpandAiIdeaMutation(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ideaId: string) => {
      return api.post<{ concept_id: string; revision_id: string; version: number }>(
        `/campaigns/${encodeURIComponent(campaignId)}/ai-ideas/${encodeURIComponent(ideaId)}/expand`,
        {}
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-content'] });
    },
  });
}


