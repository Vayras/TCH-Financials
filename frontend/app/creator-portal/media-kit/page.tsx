'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import CreatorKitView, { CreatorImage } from '@/components/CreatorKitView';
import {
  starterDraft,
  MAX_KIT_ACCOUNTS,
  importedDate,
  type KitRecord,
  type SocialAccount,
  type SocialSnapshot,
  type KitContent,
} from '@/lib/creator-kit';
import { useKit, useKitActions, useSavedSnapshots, useSocialAccounts } from '../kit-queries';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

export default function CreatorMediaKitPage() {
  const kit = useKit(),
    accounts = useSocialAccounts();
  const snapshots = useSavedSnapshots(accounts.data ?? []);
  if (kit.isLoading || accounts.isLoading || snapshots.some((s) => s.isLoading))
    return (
      <div className="creator-flow">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-80" />
        <div className="creator-kit-layout">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-[520px]" />
        </div>
      </div>
    );
  const error = kit.error || accounts.error || snapshots.find((s) => s.error)?.error;
  if (error)
    return (
      <div className="creator-flow">
        <EmptyState
          title="Your brand kit could not load"
          description={error.message}
          action={
            <Button
              onClick={() => {
                kit.refetch();
                accounts.refetch();
                snapshots.forEach((s) => s.refetch());
              }}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  if (!kit.data)
    return (
      <div className="creator-flow">
        <EmptyState
          title="Your brand kit is ready to set up"
          description="Add your profile and choose the work you want brands to see."
        />
      </div>
    );
  return (
    <KitStudio
      key={kit.data.version}
      kit={kit.data}
      accounts={accounts.data ?? []}
      latest={snapshots.flatMap((s) => (s.data ? [s.data] : []))}
    />
  );
}

function KitStudio({
  kit,
  accounts,
  latest,
}: {
  kit: KitRecord;
  accounts: SocialAccount[];
  latest: SocialSnapshot[];
}) {
  const [draft, setDraft] = React.useState(() => starterDraft(kit, accounts));
  const [error, setError] = React.useState('');
  const actions = useKitActions();
  const all = [
    ...kit.saved_snapshots,
    ...latest.filter((s) => !kit.saved_snapshots.some((old) => old.id === s.id)),
  ];
  const selected = all.filter((s) => draft.snapshot_ids.includes(s.id));
  const content: KitContent = {
    profile: draft.profile,
    socials: selected.map((s) => {
      const a = accounts.find((a) => a.id === s.account_id);
      return {
        username: a?.username ?? '',
        url: a?.profile_url ?? null,
        followers: s.profile.followers,
        posts_count: s.profile.posts_count,
        imported_at: s.collected_at,
        image_url: s.profile.image_url,
      };
    }),
    posts: draft.featured_posts.flatMap((ref) => {
      const s = all.find((s) => s.id === ref.snapshot_id);
      const p = s?.posts.find((p) => p.platform_post_id === ref.post_id);
      return p
        ? [
            {
              id: p.platform_post_id,
              username: accounts.find((a) => a.id === s?.account_id)?.username ?? '',
              caption: p.caption ?? '',
              format: p.content_type ?? 'Post',
              published_at: p.published_at,
              likes: p.likes,
              comments: p.comments,
              url: p.url,
              image_url: p.image_url,
            },
          ]
        : [];
    }),
  };
  const busy = actions.save.isPending || actions.publish.isPending || actions.unpublish.isPending;
  const dirty = JSON.stringify(draft) !== JSON.stringify(kit.draft);
  const atAccountLimit = draft.snapshot_ids.length >= MAX_KIT_ACCOUNTS;
  async function saveOrPublish(publish: boolean) {
    try {
      setError('');
      const saved =
        dirty || kit.version === 0
          ? await actions.save.mutateAsync({ version: kit.version, draft })
          : kit;
      if (publish) await actions.publish.mutateAsync(saved.version);
      toast.success(publish ? 'Your brand kit is published' : 'Draft saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your kit');
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/k/${kit.slug}/`);
      toast.success('Published link copied');
    } catch {
      toast.error('Could not copy. Open the published kit and copy its address.');
    }
  }
  function applyLatest(account: SocialAccount) {
    const latestId = account.snapshot_id;
    if (!latestId) return;
    const latestPosts = new Set(
      latest.find((s) => s.id === latestId)?.posts.map((p) => p.platform_post_id) ?? [],
    );
    const oldIds = all.filter((s) => s.account_id === account.id).map((s) => s.id);
    const featured = draft.featured_posts.flatMap((p) =>
      !oldIds.includes(p.snapshot_id)
        ? [p]
        : latestPosts.has(p.post_id)
          ? [{ ...p, snapshot_id: latestId }]
          : [],
    );
    setDraft({
      ...draft,
      snapshot_ids: [...draft.snapshot_ids.filter((id) => !oldIds.includes(id)), latestId],
      featured_posts: featured,
    });
    const dropped = draft.featured_posts.length - featured.length;
    toast.message(
      dropped
        ? `Latest insights applied. ${dropped} featured post${dropped === 1 ? ' is' : 's are'} no longer in this import and ${dropped === 1 ? 'was' : 'were'} removed. Save to keep these changes.`
        : 'Latest insights applied. Save to keep these changes.',
    );
  }
  async function addProfile(account: SocialAccount) {
    if (!account.snapshot_id) return;
    // Build on the last saved draft, not the on-screen one, so unrelated unsaved
    // edits aren't stored behind the creator's back. The screen only changes
    // once the server accepts the save.
    const saved = starterDraft(kit, accounts);
    const next = { ...saved, snapshot_ids: [...saved.snapshot_ids, account.snapshot_id] };
    try {
      setError('');
      await actions.save.mutateAsync({ version: kit.version, draft: next });
      toast.success('Profile added to your kit');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your kit');
    }
  }
  async function removeFeatured(snapshotId: string, postId: string) {
    const next = {
      ...draft,
      featured_posts: draft.featured_posts.filter(
        (p) => !(p.snapshot_id === snapshotId && p.post_id === postId),
      ),
    };
    try {
      setDraft(next);
      await actions.save.mutateAsync({ version: kit.version, draft: next });
      toast.success('Removed from your kit');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your kit');
    }
  }
  return (
    <div className="creator-flow">
      <div className="cf-top">
        <div>
          <div className="cf-step">MADE TO BE SHARED</div>
          <h1>Your work. Beautifully introduced.</h1>
          <p className="cf-muted">Bring your story, your audience and your best work together.</p>
        </div>
        <div className="cf-actions">
          <Button variant="outline" disabled={busy || !dirty} onClick={() => saveOrPublish(false)}>
            Save draft
          </Button>
          <Button
            variant="primary"
            disabled={
              busy ||
              !draft.profile.display_name ||
              !draft.profile.biography ||
              !draft.snapshot_ids.length
            }
            onClick={() => saveOrPublish(true)}
          >
            {busy ? 'Saving…' : kit.published_revision ? 'Publish updated kit' : 'Publish kit'}
          </Button>
        </div>
      </div>
      {error && (
        <p className="cf-banner cf-error" role="alert">
          {error}
        </p>
      )}
      <div className="cf-kit-layout">
        <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className="cf-panel">
            <h2>{kit.published_revision ? 'Published' : 'Private draft'}</h2>
            <p className="cf-muted" style={{ marginTop: 10 }}>
              {kit.published_revision
                ? `Published ${importedDate(kit.published_at)}. Edits stay private until you publish again.`
                : 'Review your profile and featured posts. Only the information shown here will be shared.'}
            </p>
            {kit.published_revision && (
              <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                <Link className="cf-link" href={`/k/${kit.slug}/`} target="_blank">
                  Open published kit ↗
                </Link>
                <Button variant="outline" onClick={copyLink}>
                  Copy share link
                </Button>
                <Link className="cf-link" href={`/k/${kit.slug}/`} target="_blank">
                  Open kit to save as PDF ↗
                </Link>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    actions.unpublish.mutate(kit.version, {
                      onSuccess: () => toast.success('Public link disabled'),
                      onError: (e) => setError(e.message),
                    })
                  }
                >
                  Unpublish
                </Button>
              </div>
            )}
          </section>
          <section className="cf-panel">
            <h2>Your content</h2>
            <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              <Link className="cf-link" href="/creator-portal/profile">
                Edit profile & services →
              </Link>
              <Link className="cf-link" href="/creator-portal/portfolio">
                Choose featured posts ({draft.featured_posts.length}/6) →
              </Link>
            </div>
            {draft.featured_posts.length > 0 && (
              <div className="creator-kit-featured-list">
                <h3>Featured posts</h3>
                {draft.featured_posts.map((ref) => {
                  const snapshot = all.find((s) => s.id === ref.snapshot_id);
                  const post = snapshot?.posts.find((p) => p.platform_post_id === ref.post_id);
                  return (
                    <div
                      className="creator-kit-featured-item"
                      key={`${ref.snapshot_id}:${ref.post_id}`}
                    >
                      <CreatorImage
                        src={post?.image_url ?? null}
                        alt=""
                        className="creator-kit-featured-thumb"
                      />
                      <span title={post?.caption || 'Featured post'}>
                        {post?.caption || 'Featured post'}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove featured post: ${post?.caption?.slice(0, 60) || 'Featured post'}`}
                        onClick={() => void removeFeatured(ref.snapshot_id, ref.post_id)}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section className="cf-panel">
            <h2>Included accounts</h2>
            {atAccountLimit &&
              accounts.some(
                (a) => a.snapshot_id && !selected.some((s) => s.account_id === a.id),
              ) && (
                <p className="cf-muted" style={{ marginTop: 10 }}>
                  Your kit can include up to {MAX_KIT_ACCOUNTS} accounts.
                </p>
              )}
            {accounts
              .filter((a) => a.snapshot_id)
              .map((a) => {
                const current = selected.find((s) => s.account_id === a.id);
                return (
                  <div key={a.id} style={{ marginTop: 16 }}>
                    <p>@{a.username}</p>
                    <p className="cf-muted">
                      {current ? `Updated ${importedDate(current.collected_at)}` : 'Not included'}
                    </p>
                    {current && current.id !== a.snapshot_id && (
                      <button
                        className="cf-link"
                        style={{ textAlign: 'left', marginTop: 8 }}
                        onClick={() => applyLatest(a)}
                        disabled={busy}
                      >
                        Use latest insights
                      </button>
                    )}
                    {!current && (
                      <button
                        className="cf-link"
                        style={{ textAlign: 'left', marginTop: 8 }}
                        onClick={() => void addProfile(a)}
                        disabled={busy || atAccountLimit}
                        title={
                          atAccountLimit
                            ? `Your kit can include up to ${MAX_KIT_ACCOUNTS} accounts.`
                            : undefined
                        }
                      >
                        Add this profile
                      </button>
                    )}
                  </div>
                );
              })}
            <p className="cf-muted" style={{ marginTop: 14 }}>
              When an account has newer insights, choose <strong>Use latest insights</strong> and
              save to keep your featured work up to date.
            </p>
          </section>
        </aside>
        <div>
          <CreatorKitView content={content} />
        </div>
      </div>
    </div>
  );
}
