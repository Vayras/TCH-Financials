export type SocialProfile = { display_name: string | null; biography: string | null; image_url: string | null; followers: number | null; following: number | null; posts_count: number | null };
export type SocialAccount = { id: string; username: string; profile_url: string; snapshot_id: string | null; collected_at: string | null; profile: SocialProfile | null; latest_job_id: string | null; latest_job_state: string | null; latest_job_stage?: string; latest_job_purpose?: string; coverage?: { stored_posts?: number; new_posts?: number; last_action?: string }; latest_error_code: string | null };
export type SocialPost = { platform_post_id: string; caption: string | null; content_type: string | null; published_at: string | null; likes: number | null; comments: number | null; views?: number | null; plays?: number | null; metrics_updated_at?: string; image_url: string | null; url: string | null };
export type SocialSnapshot = { id: string; account_id: string; collected_at: string; profile: SocialProfile; posts: SocialPost[]; coverage: { kind: 'sample'; stored_posts: number; returned_posts: number; oldest_post_at: string | null; newest_post_at: string | null } };
export type KitProfile = { display_name: string; headline: string; biography: string; niche: string; location: string; languages: string; services: string; contact_email: string };
export type KitDraft = { profile: KitProfile; snapshot_ids: string[]; featured_posts: { snapshot_id: string; post_id: string }[] };
export type KitRecord = { version: number; draft: KitDraft; slug: string | null; published_revision: string | null; published_at: string | null; published_draft_version: number | null; saved_snapshots: SocialSnapshot[] };
export type KitContent = { profile: KitProfile; socials: { username: string; url: string | null; followers: number | null; posts_count: number | null; imported_at: string; image_url: string | null }[]; posts: { id: string; username: string; caption: string; format: string; published_at: string | null; likes: number | null; comments: number | null; url: string | null; image_url: string | null }[] };
export type PublishedKit = { slug: string; revision: string; published_at: string; content: KitContent };
export const activeImport = (state?: string | null) => ['queued', 'triggering', 'collecting'].includes(state ?? '');
export function metric(value: number | null | undefined) { return value == null ? '—' : new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value); }
export function importedDate(value?: string | null) { return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—'; }
export function starterDraft(kit: KitRecord, accounts: SocialAccount[]): KitDraft {
  if (kit.version > 0) return kit.draft;
  const account = accounts.find(a => a.snapshot_id && a.profile);
  return { ...kit.draft, profile: { ...kit.draft.profile, display_name: account?.profile?.display_name ?? '', biography: account?.profile?.biography ?? '' }, snapshot_ids: account?.snapshot_id ? [account.snapshot_id] : [] };
}
export function sampleInsights(posts: SocialPost[]) {
  const likes = posts.map(p => p.likes).filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  const comments = posts.map(p => p.comments).filter((n): n is number => n !== null);
  const average = (values: number[]) => values.length ? Math.round(values.reduce((a,b) => a+b,0) / values.length * 10) / 10 : null;
  const sorted = [...likes].sort((a,b) => a-b);
  const median = sorted.length ? sorted.length % 2 ? sorted[Math.floor(sorted.length/2)] : (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2 : null;
  return { averageLikes: average(likes), medianLikes: median, averageComments: average(comments), likesSample: likes.length, commentsSample: comments.length };
}
