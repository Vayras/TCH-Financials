import { BadRequestException } from '@nestjs/common';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
const text = (value: unknown, limit: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
const externalId = (value: unknown): string | null =>
  typeof value === 'string' && /^\d{1,40}$/.test(value) ? value : null;

export function instagramIdentity(input: unknown) {
  if (typeof input !== 'string' || input.length > 300)
    throw new BadRequestException('Provide an Instagram username or profile URL.');
  let username = input.trim().replace(/^@/, '');
  if (/^https?:\/\//i.test(username)) {
    let url: URL;
    try {
      url = new URL(username);
    } catch {
      throw new BadRequestException('Invalid profile URL.');
    }
    if (
      url.protocol !== 'https:' ||
      !['instagram.com', 'www.instagram.com'].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password
    ) {
      throw new BadRequestException('Use an https://www.instagram.com/ profile URL.');
    }
    username = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  }
  username = username.toLowerCase();
  if (
    !/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(username) ||
    username.includes('..') ||
    ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct'].includes(username)
  ) {
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
    return allowed && url.protocol === 'https:' && !url.username && !url.password && !url.port
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export class InvalidSocialPayload extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export function normalizeTrioSphere(payload: unknown, expectedUsername: string) {
  const row = record(payload);
  const username = text(row.username, 30)?.toLowerCase();
  if (!username || username !== expectedUsername)
    throw new InvalidSocialPayload('profile_identity_mismatch');
  if (row.error || (row.media !== undefined && row.media !== null && !Array.isArray(row.media))) {
    throw new InvalidSocialPayload('invalid_profile_response');
  }
  const returned = Array.isArray(row.media) ? row.media : [];
  const seen = new Set<string>();
  const posts = returned
    .flatMap((value) => {
      const post = record(value);
      const id = externalId(post.id);
      if (!id || seen.has(id)) return [];
      seen.add(id);
      const permalink = safeUrl(post.permalink);
      const path = permalink ? new URL(permalink).pathname : '';
      const date = typeof post.timestamp === 'string' ? Date.parse(post.timestamp) : NaN;
      const mediaType = String(post.mediaType ?? '').toUpperCase();
      const content_type =
        mediaType === 'IMAGE'
          ? 'Image'
          : mediaType === 'VIDEO'
            ? 'Video'
            : mediaType === 'CAROUSEL_ALBUM'
              ? 'Carousel'
              : null;
      return [
        {
          platform_post_id: id,
          caption: text(post.caption, 5000),
          content_type,
          published_at: Number.isFinite(date) ? new Date(date).toISOString() : null,
          likes: count(post.likeCount),
          comments: count(post.commentsCount),
          url: permalink && /^\/(p|reel|reels)\/[A-Za-z0-9_-]+\/?$/.test(path) ? permalink : null,
          image_url: safeUrl(post.thumbnailUrl, true) ?? safeUrl(post.mediaUrl, true),
          is_pinned: null,
          hashtags: [],
        },
      ];
    })
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .slice(0, 12);
  const fetched = typeof row.fetchedAt === 'string' ? Date.parse(row.fetchedAt) : NaN;
  const fetchedAt = Number.isFinite(fetched)
    ? new Date(fetched).toISOString()
    : new Date().toISOString();
  const profileId = externalId(row.id);
  const datedPosts = posts.filter((post) => post.published_at !== null);
  return {
    schema_version: 1,
    profile: {
      platform_account_id: profileId,
      username,
      display_name: text(row.name, 200),
      biography: text(row.biography, 5000),
      followers: count(row.followersCount),
      following: count(row.followsCount),
      posts_count: count(row.mediaCount),
      is_verified: null,
      is_business_account: null,
      is_professional_account: null,
      category: null,
      image_url: safeUrl(row.profilePictureUrl, true),
      provider_avg_engagement: null,
      engagement_rate: null,
      reach: null,
      impressions: null,
      audience_demographics: null,
    },
    posts,
    coverage: {
      kind: 'sample',
      returned_posts: returned.length,
      stored_posts: posts.length,
      oldest_post_at: datedPosts.at(-1)?.published_at ?? null,
      newest_post_at: datedPosts[0]?.published_at ?? null,
      truncated: returned.length > posts.length,
      posts_available: Array.isArray(row.media),
      provider_source: ['meta', 'cache', 'catalog'].includes(String(row.source))
        ? row.source
        : null,
      provider_fetched_at: fetchedAt,
    },
  };
}
