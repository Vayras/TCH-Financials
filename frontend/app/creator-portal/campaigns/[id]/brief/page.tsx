'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBriefQuery } from '@/features/campaign-content/queries';
import BriefView from '@/features/campaign-content/BriefView';
import ConceptWorkspace from '@/features/campaign-content/ConceptWorkspace';
import type { SharedBrief } from '@/features/campaign-content/types';

export default function CreatorBrief() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'brief' | 'ideas' | 'feedback'>('brief');
  const query = useBriefQuery<SharedBrief>(`/creator-portal/campaign-briefs/${encodeURIComponent(id)}`);

  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get('view');
    if (view === 'ideas' || view === 'feedback') setTab(view);
  }, []);

  const selectTab = (next: 'brief' | 'ideas' | 'feedback') => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'brief') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.replaceState(null, '', url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
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
      ) : (
        <>
          {/* Campaign Header Banner */}
          <header className="rounded-2xl border border-[var(--n-border)] bg-white p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                {query.data.brand || 'Brand Campaign'}
              </span>
              <h1 className="mt-2 text-2xl font-bold text-gray-900">{query.data.name}</h1>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p className="font-medium text-gray-700">Shared Version {query.data.shared_version}</p>
              <p className="mt-0.5">Updated {query.data.shared_at.slice(0, 10)}</p>
            </div>
          </header>

          <div className="creator-campaign-tabs" role="tablist" aria-label="Campaign workspace">
            {([
              ['brief', 'Brief'],
              ['ideas', 'Ideas'],
              ['feedback', 'Feedback'],
            ] as const).map(([value, label]) => (
              <button key={value} id={`campaign-tab-${value}`} type="button" role="tab" aria-selected={tab === value} aria-controls={`campaign-panel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => selectTab(value)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'brief' && (
            <div id="campaign-panel-brief" role="tabpanel" aria-labelledby="campaign-tab-brief" className="max-w-5xl">
              <BriefView content={query.data.content} />
            </div>
          )}

          {tab === 'ideas' && <div id="campaign-panel-ideas" role="tabpanel" aria-labelledby="campaign-tab-ideas"><ConceptWorkspace campaignId={id} displayedBriefId={query.data.shared_revision_id} mode="ideas" /></div>}
          {tab === 'feedback' && <div id="campaign-panel-feedback" role="tabpanel" aria-labelledby="campaign-tab-feedback"><ConceptWorkspace campaignId={id} displayedBriefId={query.data.shared_revision_id} mode="feedback" onGoToIdeas={() => selectTab('ideas')} /></div>}
        </>
      )}
    </div>
  );
}
