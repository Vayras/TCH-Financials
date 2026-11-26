'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBriefQuery } from '@/features/campaign-content/queries';
import BriefView from '@/features/campaign-content/BriefView';
import ConceptWorkspace from '@/features/campaign-content/ConceptWorkspace';
import type { CreatorBriefView } from '@/features/campaign-content/types';
import StudioWorkspace from '@/features/studio/StudioWorkspace';

export default function CreatorBrief() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'brief' | 'ideas' | 'feedback' | 'studio'>('brief');
  const query = useBriefQuery<CreatorBriefView>(
    `/creator-portal/campaign-briefs/${encodeURIComponent(id)}`,
  );

  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get('view');
    if (view === 'ideas' || view === 'feedback' || view === 'studio') setTab(view);
  }, []);

  const selectTab = (next: 'brief' | 'ideas' | 'feedback' | 'studio') => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'brief') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="creator-campaign-workspace mx-auto max-w-7xl space-y-4">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/creator-portal/campaigns"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to Campaign Briefs
        </Link>
      </div>

      {query.isError ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          This brief is no longer available or has not been shared with you.
        </div>
      ) : !query.data ? (
        <div className="py-12 text-center text-sm text-gray-500">Loading campaign brief…</div>
      ) : !query.data.brief_shared ? (
        <section className="rounded-2xl border border-[var(--n-border)] bg-[var(--n-bg)] p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--n-accent)]">
            {query.data.brand || 'Campaign'}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{query.data.name}</h1>
          <h2 className="mt-6 text-lg font-medium">Your brief is coming soon</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--n-fg-muted)]">
            This campaign is assigned to you. Your agency will share the brief before you can work
            on concepts or feedback.
          </p>
          <Link href="/creator-portal/campaigns" className="mt-5 inline-block text-sm underline">
            View all campaigns →
          </Link>
        </section>
      ) : (
        <>
          {/* Campaign Header Banner */}
          <header className="creator-campaign-heading rounded-2xl border border-[var(--n-border)] bg-white p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--n-accent)] bg-[var(--n-accent-soft)] px-2.5 py-1 rounded-full">
                {query.data.brand || 'Brand Campaign'}
              </span>
              <h1 className="mt-2 text-2xl font-bold text-gray-900">{query.data.name}</h1>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p className="font-medium text-gray-700">
                Shared Version {query.data.shared_version}
              </p>
              <p className="mt-0.5">Updated {query.data.shared_at.slice(0, 10)}</p>
            </div>
          </header>

          <div className="creator-campaign-tabs" role="tablist" aria-label="Campaign workspace">
            {(
              [
                ['brief', 'Brief'],
                ['ideas', 'Ideas'],
                ['feedback', 'Feedback'],
                ['studio', 'AI Studio'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                id={`campaign-tab-${value}`}
                type="button"
                role="tab"
                aria-selected={tab === value}
                aria-controls={`campaign-panel-${value}`}
                onClick={() => selectTab(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'brief' && (
            <div id="campaign-panel-brief" role="tabpanel" aria-labelledby="campaign-tab-brief">
              <BriefView content={query.data.content} />
            </div>
          )}

          {tab === 'studio' && (
            <div id="campaign-panel-studio" role="tabpanel" aria-labelledby="campaign-tab-studio">
              <StudioWorkspace
                campaign={{
                  id,
                  name: query.data.name,
                  brand: query.data.brand,
                  objective: query.data.content.objective,
                }}
              />
            </div>
          )}

          {tab === 'ideas' && (
            <div id="campaign-panel-ideas" role="tabpanel" aria-labelledby="campaign-tab-ideas">
              <ConceptWorkspace
                campaignId={id}
                displayedBriefId={query.data.shared_revision_id}
                mode="ideas"
              />
            </div>
          )}
          {tab === 'feedback' && (
            <div
              id="campaign-panel-feedback"
              role="tabpanel"
              aria-labelledby="campaign-tab-feedback"
            >
              <ConceptWorkspace
                campaignId={id}
                displayedBriefId={query.data.shared_revision_id}
                mode="feedback"
                onGoToIdeas={() => selectTab('ideas')}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
