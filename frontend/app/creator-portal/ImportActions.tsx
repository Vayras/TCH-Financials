'use client';
import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import { activeImport, type SocialAccount } from '@/lib/creator-kit';
import { toast } from 'sonner';
import { useSocialImportStatus } from './kit-queries';

type ImportInput = { action: 'create-kit' | 'refresh'; accountId?: string; username?: string };
export function useCreatorImport() {
  const { creatorId } = useAuth(),
    client = useQueryClient();
  const keys = React.useRef<Record<string, string>>({});
  return useMutation({
    mutationFn: async (input: ImportInput) => {
      const storageKey = `creator-request:${creatorId}:${input.action}:${input.accountId ?? input.username?.trim().toLowerCase()}`;
      let key = keys.current[storageKey];
      if (!key) {
        try {
          key = sessionStorage.getItem(storageKey) ?? '';
        } catch {}
      }
      if (!key) key = crypto.randomUUID();
      keys.current[storageKey] = key;
      try {
        sessionStorage.setItem(storageKey, key);
      } catch {}
      const path = input.action === 'create-kit' ? 'create-kit' : `${input.accountId}/refresh`;
      const result = await api.post<{ id: string; state: string }>(
        `/creator-portal/social-accounts/${path}`,
        input.action === 'create-kit' ? { username: input.username } : undefined,
        { 'Idempotency-Key': key },
      );
      delete keys.current[storageKey];
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      return result;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['creator-social-accounts', creatorId] });
      toast.success('On it! Your content will appear here shortly.');
    },
    onError: () => client.invalidateQueries({ queryKey: ['creator-social-accounts', creatorId] }),
  });
}
export function CreateKitForm({ className }: { className?: string } = {}) {
  const [username, setUsername] = React.useState('');
  const request = useCreatorImport();
  const status = useSocialImportStatus();
  if (status.isLoading || status.isError || status.data?.paused)
    return (
      <section className={`creator-onboarding ${className || ''}`.trim()} role="status">
        <div className="creator-onboarding-icon" aria-hidden="true">
          ✳
        </div>
        <div>
          <p className="cf-step">YOUR CONTENT</p>
          <h2>
            {status.isLoading
              ? 'Checking import availability…'
              : status.isError
                ? 'Instagram imports are unavailable'
                : 'Instagram imports are paused'}
          </h2>
          <p className="cf-muted">
            {status.isLoading
              ? ''
              : status.isError
                ? 'We couldn’t check import availability. Try again shortly.'
                : 'We’re updating this integration. Your saved content and published kit are still available.'}
          </p>
          {status.isError && (
            <Button variant="outline" onClick={() => void status.refetch()}>
              Try again
            </Button>
          )}
        </div>
      </section>
    );
  return (
    <form
      className={`creator-onboarding ${className || ''}`.trim()}
      onSubmit={(e) => {
        e.preventDefault();
        request.mutate({ action: 'create-kit', username });
      }}
    >
      <div className="creator-onboarding-icon" aria-hidden="true">
        ✳
      </div>
      <div>
        <p className="cf-step">YOUR NEXT CHAPTER</p>
        <h2>Your work deserves a great introduction.</h2>
        <p className="cf-muted">
          Add your Instagram. We’ll bring together your profile and 12 recent posts.
        </p>
      </div>
      <div className="creator-connect-field">
        <label className="sr-only" htmlFor="creator-username">
          Instagram username
        </label>
        <span aria-hidden="true">@</span>
        <input
          id="creator-username"
          placeholder="yourhandle"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={300}
          required
        />
        <Button type="submit" variant="primary" disabled={request.isPending || !username.trim()}>
          {request.isPending ? 'Getting started…' : 'Create my kit ↗'}
        </Button>
      </div>
      {request.error && (
        <p className="cf-error" role="alert">
          {request.error.message}
        </p>
      )}
    </form>
  );
}
export function ImportProgress({ account }: { account: SocialAccount }) {
  const request = useCreatorImport();
  const status = useSocialImportStatus();
  if (status.data?.paused)
    return (
      <p className="cf-banner" role="status">
        Instagram imports are paused while we update the integration. Your saved content is still
        available.
      </p>
    );
  if (activeImport(account.latest_job_state))
    return (
      <div className="creator-progress" role="status">
        <span className="creator-pulse" />
        <div>
          <h3>
            {account.latest_job_stage === 'posts'
              ? 'Finding your content’s numbers'
              : 'Getting to know your profile'}
          </h3>
          <p className="cf-muted">You can keep exploring. We’ll save everything when it’s ready.</p>
        </div>
      </div>
    );
  if (account.latest_job_state === 'needs_review' || account.latest_job_state === 'failed')
    return (
      <div className="cf-banner" role="status">
        We couldn’t finish this update. Your previous content is safe.
        {account.latest_job_state === 'needs_review' ? (
          ' Please contact your agency for help.'
        ) : (
          <>
            {' '}
            You can try again.
            <Button
              variant="outline"
              disabled={request.isPending}
              onClick={() => request.mutate({ action: 'create-kit', username: account.username })}
            >
              {request.isPending ? 'Retrying…' : 'Try again'}
            </Button>
          </>
        )}
      </div>
    );
  return null;
}
export function InsightActions({ account }: { account: SocialAccount }) {
  const request = useCreatorImport();
  const status = useSocialImportStatus();
  const busy =
    request.isPending ||
    activeImport(account.latest_job_state) ||
    account.latest_job_state === 'needs_review';
  const paused = status.data?.paused === true;
  return (
    <div>
      <div className="cf-actions">
        <Button
          variant="primary"
          disabled={busy || status.isLoading || paused}
          onClick={() => request.mutate({ action: 'refresh', accountId: account.id })}
        >
          {busy ? 'Refreshing…' : paused ? 'Updates paused' : 'Update insights ↗'}
        </Button>
      </div>
      {paused && (
        <p className="cf-muted" role="status" style={{ marginTop: 8 }}>
          New Instagram updates are paused; saved insights remain available.
        </p>
      )}
      {status.isError && (
        <p className="cf-muted" role="status" style={{ marginTop: 8 }}>
          Update availability couldn’t be checked. You can still try again.
        </p>
      )}
      {request.error && (
        <p role="alert" className="cf-error" style={{ marginTop: 10 }}>
          {request.error.message}
        </p>
      )}
    </div>
  );
}
