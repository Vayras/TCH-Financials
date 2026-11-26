'use client';
import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useBriefQuery } from '@/features/campaign-content/queries';
import type { CreatorCampaignSummary } from '@/features/campaign-content/types';
export default function CreatorCampaigns() {
  const [page, setPage] = useState(1);
  const query = useBriefQuery<{ items: CreatorCampaignSummary[]; has_more: boolean }>(
    `/creator-portal/campaign-briefs?page=${page}`,
  );
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-normal">Campaigns</h1>
        <p className="mt-2 text-sm">Your briefs, deliverables and deadlines in one place.</p>
      </header>
      {query.isError ? (
        <p role="alert">
          Campaigns are unavailable.{' '}
          <button className="underline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      ) : !query.data ? (
        <p>Loading campaigns…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {query.data.items.map((c) => (
              <article
                key={c.id}
                className="rounded-2xl border border-[var(--n-border)] bg-[var(--n-bg)] p-6"
              >
                <p className="text-sm">{c.brand}</p>
                <h2 className="mt-2 text-xl font-medium">{c.name}</h2>
                {c.brief_shared ? (
                  <p className="my-3 text-xs">
                    Brief version {c.shared_version} · Updated{' '}
                    {c.shared_at ? c.shared_at.slice(0, 10) : 'recently'}
                  </p>
                ) : (
                  <div className="mt-4 rounded-xl bg-[var(--n-accent-soft)] p-4 text-sm">
                    <p className="font-medium">
                      {c.brief_assigned ? 'Brief coming soon' : 'Part of your deal'}
                    </p>
                    <p className="mt-1 text-[var(--n-fg-muted)]">
                      {c.brief_assigned
                        ? 'This campaign is assigned to you. Your agency will share the brief here.'
                        : 'You’re on this campaign through a deal. Its brief hasn’t been assigned to you; ask your agency if you need it.'}
                    </p>
                  </div>
                )}
                <Link
                  href={`/creator-portal/campaigns/${c.id}/brief`}
                  className="mt-4 inline-block text-sm underline"
                >
                  Open campaign →
                </Link>
              </article>
            ))}
          </div>
          {!query.data.items.length && (
            <p className="rounded-2xl border p-6">
              No campaigns assigned yet. Assigned campaign work will appear here, with its brief
              when your agency shares it.
            </p>
          )}
          {(page > 1 || query.data.has_more) && (
            <div className="flex gap-3">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!query.data.has_more}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
