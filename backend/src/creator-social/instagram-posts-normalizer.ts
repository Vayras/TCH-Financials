import { InvalidSocialPayload, normalizeInstagram, safeUrl } from './instagram-normalizer';

type ProfileData = ReturnType<typeof normalizeInstagram>;
export type CreatorPost = ProfileData['posts'][number] & { views?: number | null; plays?: number | null; metrics_updated_at?: string };
export const MAX_LIBRARY_POSTS = 300;
const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
const text = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : null;

export function normalizeInstagramPosts(payload: unknown, username: string, limit = 30): CreatorPost[] {
  if (!Array.isArray(payload) || payload.length > limit) throw new InvalidSocialPayload('invalid_posts_response');
  const posts = new Map<string, CreatorPost>();
  for (const value of payload) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidSocialPayload('invalid_post');
    const row = value as Record<string, unknown>;
    if (row.error || row.error_code) throw new InvalidSocialPayload('post_collection_failed');
    if (typeof row.user_posted !== 'string' || row.user_posted.toLowerCase() !== username) throw new InvalidSocialPayload('post_identity_mismatch');
    // Composite provider IDs contain an owner suffix. Store the canonical media ID as a string.
    const id = typeof row.post_id === 'string' && /^\d{1,40}(?:_\d{1,40})?$/.test(row.post_id) ? row.post_id.split('_')[0] : null;
    const url = safeUrl(row.url);
    if (!id || !url || !/^\/(p|reel|reels)\/[A-Za-z0-9_-]+\/?$/.test(new URL(url).pathname)) throw new InvalidSocialPayload('invalid_post_identity');
    const date = typeof row.date_posted === 'string' ? Date.parse(row.date_posted) : NaN;
    const format = String(row.content_type ?? '').toLowerCase();
    posts.set(id, {
      platform_post_id: id, caption: text(row.description, 5000), url,
      content_type: format === 'video' || row.product_type === 'clips' ? 'Video' : format === 'carousel' || (Array.isArray(row.photos) && row.photos.length > 1) ? 'Carousel' : format === 'image' || format === 'photo' ? 'Image' : null,
      published_at: Number.isFinite(date) ? new Date(date).toISOString() : null,
      likes: count(row.likes), comments: count(row.num_comments), views: count(row.video_view_count ?? row.views), plays: count(row.video_play_count),
      image_url: safeUrl(row.thumbnail, true) ?? safeUrl(Array.isArray(row.photos) ? row.photos[0] : null, true),
      is_pinned: typeof row.is_pinned === 'boolean' ? row.is_pinned : null,
      hashtags: Array.isArray(row.hashtags) ? row.hashtags.filter((v): v is string => typeof v === 'string').slice(0,30).map(v => v.slice(0,100)) : [],
      metrics_updated_at: new Date().toISOString(),
    });
  }
  return [...posts.values()].sort((a,b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
}

export function mergePostLibrary(existing: CreatorPost[], incoming: CreatorPost[]) {
  const byId = new Map(existing.map(p => [p.platform_post_id,p]));
  for (const post of incoming) byId.set(post.platform_post_id, post);
  if (byId.size > MAX_LIBRARY_POSTS) throw new InvalidSocialPayload('library_limit_reached');
  return [...byId.values()].sort((a,b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
}

export function discoveryEndDate(posts: CreatorPost[]) {
  const oldest = posts.map(p => p.published_at).filter((d): d is string => !!d).sort()[0];
  if (!oldest) return null;
  const date = new Date(oldest);
  return `${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}-${date.getUTCFullYear()}`;
}
