import { BadRequestException } from '@nestjs/common';

export const MAX_SAMPLE_POSTS = 50;
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown, limit: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const flag = (value: unknown): boolean | null => typeof value === 'boolean' ? value : null;
const externalId = (value: unknown): string | null =>
  typeof value === 'string' && /^\d{1,40}$/.test(value) ? value : null;

export function instagramIdentity(input: unknown) {
  if (typeof input !== 'string' || input.length > 300) throw new BadRequestException('Provide an Instagram username or profile URL.');
  let username = input.trim().replace(/^@/, '');
  if (/^https?:\/\//i.test(username)) {
    let url: URL;
    try { url = new URL(username); } catch { throw new BadRequestException('Invalid profile URL.'); }
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) || url.port || url.username || url.password) {
      throw new BadRequestException('Use an https://www.instagram.com/ profile URL.');
    }
    username = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  }
  username = username.toLowerCase();
  if (!/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(username) || username.includes('..') ||
      ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct'].includes(username)) {
    throw new BadRequestException('Provide a valid Instagram profile username, not a post URL.');
  }
  return { username, profile_url: `https://www.instagram.com/${username}/` };
}

// URLs are references only. This module never downloads arbitrary media URLs.
export function safeUrl(value: unknown, media = false): string | null {
  if (typeof value !== 'string' || value.length > 8000 || value.includes('*')) return null;
  try {
    const url = new URL(value);
    const host = url.hostname;
    const allowed = media
      ? host.endsWith('.cdninstagram.com') || host.endsWith('.fbcdn.net')
      : host === 'www.instagram.com' || host === 'instagram.com';
    return allowed && url.protocol === 'https:' && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

export class InvalidSocialPayload extends Error {
  constructor(public readonly code: string) { super(code); }
}

export function normalizeInstagram(payload: unknown, expectedUsername: string) {
  if (!Array.isArray(payload) || payload.length !== 1) throw new InvalidSocialPayload('invalid_profile_response');
  const row = record(payload[0]);
  if (row.error || row.error_code || row.is_private === true) throw new InvalidSocialPayload('profile_unavailable');
  // A link is not proof of ownership. Masked documentation samples must never become live observations.
  const account = text(row.account, 100);
  if (!account || account.toLowerCase() !== expectedUsername) throw new InvalidSocialPayload('profile_identity_mismatch');
  const id = externalId(row.id);
  if (!id || count(row.followers) === null) throw new InvalidSocialPayload('invalid_profile_response');
  const sourcePosts = Array.isArray(row.posts) ? row.posts : [];
  const seen = new Set<string>();
  const posts = sourcePosts.slice(0, 500).flatMap((input) => {
    const post = record(input);
    const postId = externalId(post.id);
    if (!postId || seen.has(postId)) return [];
    seen.add(postId);
    const date = typeof post.datetime === 'string' ? Date.parse(post.datetime) : NaN;
    return [{
      platform_post_id: postId, caption: text(post.caption, 5000),
      content_type: ['Video', 'Image', 'Carousel'].includes(String(post.content_type)) ? post.content_type : null,
      published_at: Number.isFinite(date) ? new Date(date).toISOString() : null,
      likes: count(post.likes), comments: count(post.comments),
      url: safeUrl(post.url), image_url: safeUrl(post.image_url, true),
      // Video URLs are large, expire, and are not needed for a brand-kit preview.
      is_pinned: flag(post.is_pinned),
      hashtags: Array.isArray(post.post_hashtags)
        ? post.post_hashtags.filter((v): v is string => typeof v === 'string').slice(0, 30).map(v => v.slice(0, 100)) : [],
    }];
  }).sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '')).slice(0, MAX_SAMPLE_POSTS);
  const datedPosts = posts.filter(post => post.published_at !== null);
  return {
    schema_version: 1,
    profile: {
      platform_account_id: id, username: account.toLowerCase(),
      display_name: text(row.profile_name ?? row.full_name, 200), biography: text(row.biography, 5000),
      followers: count(row.followers), following: count(row.following), posts_count: count(row.posts_count),
      is_verified: flag(row.is_verified), is_business_account: flag(row.is_business_account),
      is_professional_account: flag(row.is_professional_account),
      category: text(row.category_name ?? row.business_category_name, 200),
      image_url: safeUrl(row.profile_image_link, true),
      // Provider value retained without inventing percentage units or a calculation window.
      provider_avg_engagement: typeof row.avg_engagement === 'number' && Number.isFinite(row.avg_engagement) && row.avg_engagement >= 0
        ? row.avg_engagement : null,
      engagement_rate: null, reach: null, impressions: null, audience_demographics: null,
    },
    posts,
    coverage: {
      kind: 'sample', returned_posts: sourcePosts.length, stored_posts: posts.length,
      oldest_post_at: datedPosts.at(-1)?.published_at ?? null, newest_post_at: datedPosts[0]?.published_at ?? null,
      truncated: sourcePosts.length > posts.length,
    },
  };
}
