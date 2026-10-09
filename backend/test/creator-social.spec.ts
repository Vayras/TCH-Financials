import assert from 'node:assert/strict';
import test from 'node:test';
import { BrightDataClient, ProviderFailure } from '../src/creator-social/brightdata.client';
import { instagramIdentity, normalizeInstagram, InvalidSocialPayload } from '../src/creator-social/instagram-normalizer';
import { creatorScope } from '../src/creator-social/creator-social.service';

const profile = () => [{ account: 'creator_test', id: '5087052934', followers: 7938, posts_count: 835,
  avg_engagement: 0.0582, is_verified: false, posts: [
    { id: '3851176228498036124', datetime: '2026-03-12T11:52:08Z', likes: 36, comments: null, content_type: 'Video' },
    { id: '3848412628930911784', datetime: '2026-03-08T16:21:04Z', likes: 0, comments: 0, content_type: 'Video' },
  ] }];

test('Instagram input canonicalization rejects non-profile URLs and masked identities', () => {
  assert.deepEqual(instagramIdentity(' @Creator_Test '), { username: 'creator_test', profile_url: 'https://www.instagram.com/creator_test/' });
  assert.equal(instagramIdentity('https://instagram.com/Creator_Test/?igsh=abc').username, 'creator_test');
  for (const value of ['https://evil.test/me', 'https://instagram.com.evil.test/me', 'http://instagram.com/me',
    'https://user:password@instagram.com/me', 'https://instagram.com:444/me', 'https://instagram.com/p/abc/',
    'https://instagram.com/reels/', 'name..name', 'jen***ell***72', null, 42]) {
    assert.throws(() => instagramIdentity(value));
  }
});

test('normalization preserves unavailable versus zero metrics and precise string IDs', () => {
  const result = normalizeInstagram(profile(), 'creator_test');
  assert.equal(result.posts[0].platform_post_id, '3851176228498036124');
  assert.equal(result.posts[0].comments, null);
  assert.equal(result.posts[1].comments, 0);
  assert.equal(result.posts[1].likes, 0);
  assert.equal(result.profile.following, null);
  assert.equal(result.profile.is_verified, false);
  assert.equal(result.profile.provider_avg_engagement, 0.0582);
  assert.equal(result.profile.engagement_rate, null);
  assert.equal(result.profile.reach, null);
  assert.equal(result.coverage.kind, 'sample');
  assert.equal(result.coverage.stored_posts, 2);
  assert.equal(result.profile.posts_count, 835);
});

test('invalid, private, masked and mismatched profiles cannot replace saved data', () => {
  for (const input of [[], {}, [{ error: 'private account' }], [{ ...profile()[0], is_private: true }],
    [{ ...profile()[0], account: 'someone_else' }], [{ ...profile()[0], account: 'cre***test' }],
    [{ ...profile()[0], id: 5087052934 }], [{ ...profile()[0], followers: -5 }]]) {
    assert.throws(() => normalizeInstagram(input, 'creator_test'), InvalidSocialPayload);
  }
});

test('post samples are bounded, deduplicated and strip unrelated personal fields and unsafe URLs', () => {
  const row = { ...profile()[0], email_address: 'private@example.test', related_accounts: ['other'],
    posts: Array.from({ length: 70 }, (_, i) => ({ id: String(i + 1), likes: i, comments: null,
      datetime: '2026-03-12T11:52:08Z', image_url: 'https://127.0.0.1/private', video_url: 'https://evil.test/v.mp4' })) };
  row.posts.push(row.posts[0]);
  const normalized = normalizeInstagram([row], 'creator_test');
  assert.equal(normalized.posts.length, 50);
  assert.equal(normalized.coverage.returned_posts, 71);
  assert.equal(normalized.coverage.truncated, true);
  assert.equal(normalized.posts[0].image_url, null);
  assert.ok(!JSON.stringify(normalized).includes('private@example'));
  assert.ok(!JSON.stringify(normalized).includes('video_url'));
});

test('creator scope is derived from the authenticated actor', () => {
  assert.equal(creatorScope({ id: 'actor', role: 'creator', creatorId: '7' }), '7');
  for (const actor of [undefined, { id: 'actor', role: 'creator' }, { id: 'actor', role: 'accounts', creatorId: '7' }]) {
    assert.throws(() => creatorScope(actor));
  }
});

test('Bright Data adapter sends one canonical URL, disables redirects and uses async trigger', async () => {
  const client = new BrightDataClient();
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  client.transport = (async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ snapshot_id: 's_existing' }));
  }) as typeof fetch;
  assert.equal(await client.trigger('https://www.instagram.com/creator_test/', 'gd_profiles'), 's_existing');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_profiles&include_errors=true');
  assert.equal(requests[0].init?.redirect, 'error');
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), [{ url: 'https://www.instagram.com/creator_test/' }]);
});

test('adapter bounds payload size and classifies pending responses without leaking upstream errors', async () => {
  const client = new BrightDataClient();
  client.transport = (async () => new Response('secret upstream details', { status: 429 })) as typeof fetch;
  await assert.rejects(client.progress('s_test'), (error: unknown) => error instanceof ProviderFailure && error.retryable && !error.message.includes('secret'));
  client.transport = (async () => new Response('{}', { status: 202 })) as typeof fetch;
  await assert.rejects(client.download('s_test'), (error: unknown) => error instanceof ProviderFailure && error.code === 'provider_not_ready');
  client.transport = (async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))) as typeof fetch;
  await assert.rejects(client.download('s_test'), (error: unknown) => error instanceof ProviderFailure && error.code === 'provider_response_too_large');
});

test('reconciled snapshots must match the expected provider dataset and snapshot ID', async () => {
  const client = new BrightDataClient();
  client.transport = (async () => new Response(JSON.stringify({ snapshot_id: 's_test', dataset_id: 'wrong_dataset', status: 'ready' }))) as typeof fetch;
  await assert.rejects(client.progress('s_test', 'gd_expected'), (error: unknown) => error instanceof ProviderFailure && error.code === 'provider_snapshot_mismatch');
  client.transport = (async () => new Response(JSON.stringify({ snapshot_id: 's_test', dataset_id: 'gd_expected', status: 'canceled' }))) as typeof fetch;
  assert.equal(await client.progress('s_test', 'gd_expected'), 'canceled');
});
