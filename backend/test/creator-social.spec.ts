import assert from 'node:assert/strict';
import test from 'node:test';
import { TrioSphereClient, ProviderFailure } from '../src/creator-social/triosphere.client';
import {
  instagramIdentity,
  normalizeTrioSphere,
  InvalidSocialPayload,
} from '../src/creator-social/instagram-normalizer';
import { CreatorSocialService, creatorScope } from '../src/creator-social/creator-social.service';
import { socialConfig, socialImportsEnabled } from '../src/creator-social/social.config';

test('TrioSphere imports require only a token', () => {
  assert.equal(
    socialImportsEnabled({ TRIOSPHERE_API_TOKEN: 'secret' }),
    true,
  );
  assert.equal(
    socialImportsEnabled({
      TRIOSPHERE_API_TOKEN: '',
    }),
    false,
  );
  assert.equal(
    socialImportsEnabled({
      TRIOSPHERE_API_TOKEN: '  ',
    }),
    false,
  );
});

test('paused social imports reject refresh before creating database work', async () => {
  const paused = socialConfig.paused;
  socialConfig.paused = true;
  let transactions = 0;
  try {
    const db = {
      transaction: async () => {
        transactions++;
        return undefined;
      },
    } as never;
    const service = new CreatorSocialService(db);
    assert.deepEqual(service.importStatus(), { paused: true });
    await assert.rejects(
      service.connect({ id: 'creator-user', role: 'creator', creatorId: '7' }, 'creator_test'),
      /temporarily paused/,
    );
    await assert.rejects(
      service.refresh(
        { id: 'creator-user', role: 'creator', creatorId: '7' },
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ),
      /temporarily paused/,
    );
    assert.equal(transactions, 0);
  } finally {
    socialConfig.paused = paused;
  }
});

test('create-kit performs account creation and import admission in the same transaction', async () => {
  const saved = { ...socialConfig };
  Object.assign(socialConfig, {
    paused: false,
    enabled: true,
    apiToken: 'test',
    globalDailyLimit: 100,
    globalHourlyLimit: 20,
  });
  const sqls: string[] = [];
  const query = async (sql: string) => {
    sqls.push(sql);
    if (sql.includes('FROM tch_creator WHERE id')) return [{ id: '7' }];
    if (sql.includes('FROM tch_creator_social_account WHERE creator_id=$1 AND username=$2'))
      return [];
    if (sql.includes('count(*)::int AS count')) return [{ count: 0 }];
    if (sql.includes('INSERT INTO tch_creator_social_account'))
      return [{ id: '00000000-0000-4000-8000-000000000001' }];
    if (sql.includes('FROM tch_creator_social_account WHERE id = $1 AND creator_id = $2'))
      return [{ id: '00000000-0000-4000-8000-000000000001' }];
    if (sql.includes("date_trunc('day'")) return [{ total: 100 }];
    return [];
  };
  const db = {
    transaction: (work: (manager: { query: typeof query }) => Promise<unknown>) => work({ query }),
  };
  try {
    const service = new CreatorSocialService(db as never);
    await assert.rejects(
      service.createKit(
        { id: 'creator-user', role: 'creator', creatorId: '7' },
        'new_creator',
        '00000000-0000-4000-8000-000000000002',
      ),
      { status: 429 },
    );
    assert.ok(sqls.some((sql) => sql.includes('INSERT INTO tch_creator_social_account')));
    assert.ok(!sqls.some((sql) => sql.includes('INSERT INTO tch_creator_social_import')));
  } finally {
    Object.assign(socialConfig, saved);
  }
});

test('global hourly import cap rejects admission before queue insertion', async () => {
  const saved = { ...socialConfig };
  Object.assign(socialConfig, {
    paused: false,
    enabled: true,
    apiToken: 'test',
    globalHourlyLimit: 20,
  });
  const queries: string[] = [];
  const query = async (sql: string) => {
    queries.push(sql);
    if (sql.includes("date_trunc('day'")) return [{ total: 0 }];
    if (sql.includes("now() - interval '1 hour'")) return [{ total: 20 }];
    if (sql.includes('FROM tch_creator_social_account WHERE id'))
      return [{ id: '00000000-0000-4000-8000-000000000001' }];
    return [];
  };
  try {
    const service = new CreatorSocialService({
      transaction: (fn: (manager: { query: typeof query }) => Promise<unknown>) => fn({ query }),
    } as never);
    await assert.rejects(
      service.refresh(
        { id: 'creator-user', role: 'creator', creatorId: '7' },
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
      ),
      (error: unknown) => (error as { status?: number }).status === 429,
    );
    assert.ok(!queries.some((sql) => sql.includes('INSERT INTO tch_creator_social_import')));
  } finally {
    Object.assign(socialConfig, saved);
  }
});

test('manual refresh is allowed within an hour and active imports still prevent duplicates', async () => {
  const saved = { ...socialConfig };
  Object.assign(socialConfig, {
    paused: false,
    enabled: true,
    apiToken: 'test',
    globalDailyLimit: 100,
    globalHourlyLimit: 20,
  });
  const queries: string[] = [];
  let active = false;
  const query = async (sql: string) => {
    queries.push(sql);
    if (sql.includes('FROM tch_creator_social_account WHERE id'))
      return [{ id: '00000000-0000-4000-8000-000000000001' }];
    if (sql.includes('state IN')) return active ? [{ id: 'active-job', state: 'queued' }] : [];
    if (sql.includes("date_trunc('day'")) return [{ total: 1 }];
    if (sql.includes("now() - interval '1 hour'")) return [{ total: 1 }];
    if (sql.includes('INSERT INTO tch_creator_social_import')) return [{ id: 'queued-refresh' }];
    if (sql.includes('requested_at +')) return [{ next_refresh_at: new Date(Date.now() + 60_000) }];
    return [];
  };
  try {
    const service = new CreatorSocialService({
      transaction: (fn: (manager: { query: typeof query }) => Promise<unknown>) => fn({ query }),
    } as never);
    const result = await service.refresh(
      { id: 'creator-user', role: 'creator', creatorId: '7' },
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    );
    assert.equal((result as { id: string }).id, 'queued-refresh');
    active = true;
    await assert.rejects(
      service.refresh(
        { id: 'creator-user', role: 'creator', creatorId: '7' },
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000003',
      ),
      { status: 409 },
    );
    assert.ok(!queries.some((sql) => sql.includes('requested_at +')));
  } finally {
    Object.assign(socialConfig, saved);
  }
});

test('Instagram input canonicalization rejects non-profile URLs and masked identities', () => {
  assert.deepEqual(instagramIdentity(' @Creator_Test '), {
    username: 'creator_test',
    profile_url: 'https://www.instagram.com/creator_test/',
  });
  assert.equal(
    instagramIdentity('https://instagram.com/Creator_Test/?igsh=abc').username,
    'creator_test',
  );
  for (const value of [
    'https://evil.test/me',
    'https://instagram.com.evil.test/me',
    'http://instagram.com/me',
    'https://user:password@instagram.com/me',
    'https://instagram.com:444/me',
    'https://instagram.com/p/abc/',
    'https://instagram.com/reels/',
    'name..name',
    'jen***ell***72',
    null,
    42,
  ]) {
    assert.throws(() => instagramIdentity(value));
  }
});

test('TrioSphere profile and media normalize to TCH snapshot fields with 12-post limit', () => {
  const media = Array.from({ length: 14 }, (_, i) => ({
    id: String(14 - i),
    caption: `post ${i}`,
    mediaType: 'IMAGE',
    permalink: `https://www.instagram.com/p/post${i}/`,
    mediaUrl: 'https://scontent.cdninstagram.com/image.jpg',
    likeCount: i,
    commentsCount: 0,
    timestamp: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
  }));
  const result = normalizeTrioSphere(
    {
      username: 'creator_test',
      name: 'Creator Test',
      biography: 'hello',
      followersCount: 7938,
      followsCount: 22,
      mediaCount: 835,
      profilePictureUrl: 'https://scontent.fbcdn.net/p.jpg',
      media,
      source: 'meta',
      fetchedAt: '2026-03-12T11:52:08Z',
    },
    'creator_test',
  );
  assert.equal(result.posts.length, 12);
  assert.equal(result.posts[0].platform_post_id, '1');
  assert.equal(result.posts[0].content_type, 'Image');
  assert.equal(result.posts[0].likes, 13);
  assert.equal(result.profile.display_name, 'Creator Test');
  assert.equal(result.profile.following, 22);
  assert.equal(result.coverage.provider_source, 'meta');
  assert.equal(result.coverage.provider_fetched_at, '2026-03-12T11:52:08.000Z');
});

test('TrioSphere rejects identity mismatch, unsafe media, and duplicate or malformed IDs', () => {
  assert.throws(
    () => normalizeTrioSphere({ username: 'someone_else', media: [] }, 'creator_test'),
    InvalidSocialPayload,
  );
  const result = normalizeTrioSphere(
    {
      username: 'creator_test',
      media: [
        { id: '7', permalink: 'https://evil.test/p/abc', mediaUrl: 'https://127.0.0.1/private' },
        {
          id: '7',
          permalink: 'https://www.instagram.com/p/valid/',
          mediaUrl: 'https://scontent.cdninstagram.com/image.jpg',
        },
        { id: 'not-numeric' },
      ],
    },
    'creator_test',
  );
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].url, null);
  assert.equal(result.posts[0].image_url, null);
});

test('TrioSphere null media marks post coverage unavailable for preservation', () => {
  const result = normalizeTrioSphere({ username: 'creator_test', media: null }, 'creator_test');
  assert.deepEqual(result.posts, []);
  assert.equal(result.coverage.posts_available, false);
});

test('creator scope is derived from the authenticated actor', () => {
  assert.equal(creatorScope({ id: 'actor', role: 'creator', creatorId: '7' }), '7');
  for (const actor of [
    undefined,
    { id: 'actor', role: 'creator' },
    { id: 'actor', role: 'accounts', creatorId: '7' },
  ]) {
    assert.throws(() => creatorScope(actor));
  }
});

test('TrioSphere lookup uses a fixed origin, bearer token, query params and rejects redirects', async () => {
  const client = new TrioSphereClient('cico_test_token');
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  client.transport = (async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ username: 'creator_test', media: [] }));
  }) as typeof fetch;
  await client.lookup('creator_test');
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    'https://api.triosphere.site/v1/profile-lookup?username=creator_test&posts=true',
  );
  assert.equal(requests[0].init?.redirect, 'error');
  assert.ok(requests[0].init?.signal instanceof AbortSignal);
  assert.equal(
    (requests[0].init?.headers as Record<string, string>).Authorization,
    'Bearer cico_test_token',
  );
  assert.equal(requests[0].init?.method, 'GET');
});

test('TrioSphere adapter bounds payloads and maps rate limits and credentials safely', async () => {
  const client = new TrioSphereClient('cico_secret');
  client.transport = (async () =>
    new Response('secret upstream details', {
      status: 429,
      headers: { 'Retry-After': '17' },
    })) as typeof fetch;
  await assert.rejects(
    client.lookup('creator_test'),
    (error: unknown) =>
      error instanceof ProviderFailure &&
      error.retryable &&
      error.retryAfterMs === 17000 &&
      !error.message.includes('secret'),
  );
  client.transport = (async () => new Response('private details', { status: 401 })) as typeof fetch;
  await assert.rejects(
    client.lookup('creator_test'),
    (error: unknown) =>
      error instanceof ProviderFailure && !error.retryable && error.code === 'provider_auth_failed',
  );
  client.transport = (async () => new Response('', { status: 400 })) as typeof fetch;
  await assert.rejects(
    client.lookup('creator_test'),
    (error: unknown) => error instanceof ProviderFailure && error.code === 'invalid_username',
  );
  client.transport = (async () => new Response('', { status: 404 })) as typeof fetch;
  await assert.rejects(
    client.lookup('creator_test'),
    (error: unknown) => error instanceof ProviderFailure && error.code === 'profile_unavailable',
  );
  client.transport = (async () => new Response('', { status: 502 })) as typeof fetch;
  await assert.rejects(
    client.lookup('creator_test'),
    (error: unknown) => error instanceof ProviderFailure && error.retryable,
  );
  client.transport = (async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))) as typeof fetch;
  await assert.rejects(
    client.lookup('creator_test'),
    (error: unknown) =>
      error instanceof ProviderFailure && error.code === 'provider_response_too_large',
  );
  client.transport = (async () => {
    throw new Error('redirect blocked');
  }) as typeof fetch;
  await assert.rejects(
    client.lookup('creator_test'),
    (error: unknown) =>
      error instanceof ProviderFailure &&
      error.code === 'provider_network_error' &&
      error.retryable,
  );
});
