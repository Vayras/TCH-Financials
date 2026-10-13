import { BadRequestException } from '@nestjs/common';
import { uuid } from './creator-social.service';

export type KitProfile = { display_name: string; headline: string; biography: string; niche: string; location: string; languages: string; services: string; contact_email: string };
export type KitDraft = { profile: KitProfile; snapshot_ids: string[]; featured_posts: { snapshot_id: string; post_id: string }[] };
export const blankDraft = (): KitDraft => ({ profile: { display_name: '', headline: '', biography: '', niche: '', location: '', languages: '', services: '', contact_email: '' }, snapshot_ids: [], featured_posts: [] });

export function validateDraft(value: unknown): KitDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('A draft is required.');
  const draft = value as Record<string, unknown>;
  const profile = draft.profile as Record<string, unknown> | undefined;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new BadRequestException('A profile is required.');
  const limits: Record<keyof KitProfile, number> = { display_name: 120, headline: 200, biography: 5000, niche: 200, location: 120, languages: 200, services: 2000, contact_email: 254 };
  const result = blankDraft();
  for (const key of Object.keys(limits) as Array<keyof KitProfile>) {
    if (typeof profile[key] !== 'string' || (profile[key] as string).length > limits[key]) throw new BadRequestException(`Invalid ${key}.`);
    result.profile[key] = (profile[key] as string).trim();
  }
  if (result.profile.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.profile.contact_email)) throw new BadRequestException('Enter a valid business email.');
  if (!Array.isArray(draft.snapshot_ids) || draft.snapshot_ids.length > 3) throw new BadRequestException('Choose up to three social snapshots.');
  result.snapshot_ids = [...new Set(draft.snapshot_ids.map(uuid))];
  if (!Array.isArray(draft.featured_posts) || draft.featured_posts.length > 6) throw new BadRequestException('Choose up to six featured posts.');
  result.featured_posts = draft.featured_posts.map(value => {
    if (!value || typeof value !== 'object' || typeof value.post_id !== 'string' || !/^\d{1,40}$/.test(value.post_id)) throw new BadRequestException('Invalid featured post.');
    const snapshot_id = uuid(value.snapshot_id);
    if (!result.snapshot_ids.includes(snapshot_id)) throw new BadRequestException('Featured posts must belong to a selected snapshot.');
    return { snapshot_id, post_id: value.post_id };
  });
  if (new Set(result.featured_posts.map(p => `${p.snapshot_id}:${p.post_id}`)).size !== result.featured_posts.length) throw new BadRequestException('Duplicate featured post.');
  return result;
}

export function expectedVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new BadRequestException('A valid version is required.');
  return value;
}

function instagramUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && ['instagram.com','www.instagram.com'].includes(url.hostname) && !url.username && !url.password && !url.port ? url.href : null; } catch { return null; }
}
function thumbnail(value: unknown) {
  if (typeof value !== 'string' || value.length > 8000) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname.endsWith('.cdninstagram.com') || url.hostname.endsWith('.fbcdn.net')) && !url.username && !url.password && !url.port ? url.href : null; } catch { return null; }
}
const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
type Observation = { id: string; account_id: string; username: string; profile_url: string; collected_at: Date | string; profile: Record<string, unknown>; posts: Array<Record<string, unknown>> };

// The public document is an allowlist, not a serialized creator/account/database record.
export function publicContent(draft: KitDraft, snapshots: Observation[]) {
  const posts = draft.featured_posts.map(ref => {
    const source = snapshots.find(s => s.id === ref.snapshot_id);
    const post = source?.posts.find(p => p.platform_post_id === ref.post_id);
    if (!source || !post) throw new BadRequestException('A selected post is unavailable. Review your selections.');
    return { id: ref.post_id, username: source.username, caption: String(post.caption ?? '').slice(0, 5000),
      format: String(post.content_type ?? 'Post'), published_at: post.published_at ?? null,
      likes: count(post.likes), comments: count(post.comments), url: instagramUrl(post.url), image_url: thumbnail(post.image_url) };
  });
  return { profile: draft.profile, socials: snapshots.map(s => ({ username: s.username, url: instagramUrl(s.profile_url),
    followers: count(s.profile.followers), posts_count: count(s.profile.posts_count), imported_at: s.collected_at,
    image_url: thumbnail(s.profile.image_url) })), posts };
}
