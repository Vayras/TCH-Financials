import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ProviderFailure, TrioSphereClient } from '../src/creator-social/triosphere.client';
import { SocialImportProcessor } from '../src/creator-social/social-import.processor';
import { socialConfig } from '../src/creator-social/social.config';

function harness(prepared_data: unknown = null) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const job = {
    id: randomUUID(),
    account_id: randomUUID(),
    state: 'queued',
    username: 'creator_test',
    attempts: 0,
    prepared_data,
  };
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT j.*, a.username')) return [job];
    if (sql.startsWith('SELECT id FROM tch_creator_social_import')) return [{ id: job.id }];
    return [];
  };
  const db = {
    query,
    transaction: async (fn: (manager: { query: typeof query }) => Promise<unknown>) =>
      fn({ query }),
  } as unknown as DataSource;
  return { calls, job, db };
}

const response = (username = 'creator_test', media: unknown = []) => ({
  username,
  name: 'Creator',
  followersCount: 7,
  media,
});

test('one queued job makes one TrioSphere lookup and writes a TrioSphere snapshot', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = true;
  try {
    const { db, calls } = harness();
    const provider = new TrioSphereClient('test');
    let lookups = 0;
    provider.lookup = async (username) => {
      lookups++;
      assert.equal(username, 'creator_test');
      return response();
    };
    await new SocialImportProcessor(db, provider).runOnce();
    assert.equal(lookups, 1);
    assert.equal(
      calls.filter((call) => call.sql.includes('INSERT INTO tch_creator_social_snapshot')).length,
      1,
    );
    assert.match(
      calls.find((call) => call.sql.includes('INSERT INTO tch_creator_social_snapshot'))!.sql,
      /'triosphere'/,
    );
    assert.ok(calls.some((call) => call.sql.includes("state = 'succeeded'")));
  } finally {
    socialConfig.enabled = enabled;
  }
});

test('a safe GET can retry network failures without requiring provider reconciliation', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = true;
  try {
    const { db, calls } = harness();
    const provider = new TrioSphereClient('test');
    provider.lookup = async () => {
      throw new ProviderFailure('provider_network_error', true);
    };
    await new SocialImportProcessor(db, provider).runOnce();
    assert.ok(
      calls.some(
        (call) =>
          call.sql.includes('next_attempt_at = now() +') &&
          call.params.includes('provider_network_error'),
      ),
    );
    assert.ok(!calls.some((call) => call.sql.includes('state = $3::text')));
  } finally {
    socialConfig.enabled = enabled;
  }
});

test('wrong account data cannot write or delete snapshots', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = true;
  try {
    const { db, calls } = harness();
    const provider = new TrioSphereClient('test');
    provider.lookup = async () => response('wrong_account');
    await new SocialImportProcessor(db, provider).runOnce();
    assert.ok(calls.some((call) => call.params.includes('profile_identity_mismatch')));
    assert.ok(
      !calls.some((call) =>
        /INSERT INTO tch_creator_social_snapshot|DELETE FROM tch_creator_social_snapshot/.test(
          call.sql,
        ),
      ),
    );
  } finally {
    socialConfig.enabled = enabled;
  }
});

test('catalog lookup with omitted media preserves the previously saved posts', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = true;
  try {
    const oldPosts = [{ platform_post_id: '22', caption: 'existing' }];
    const { db, calls } = harness({ posts: oldPosts });
    const provider = new TrioSphereClient('test');
    provider.lookup = async () => response('creator_test', null);
    await new SocialImportProcessor(db, provider).runOnce();
    const insert = calls.find((call) =>
      call.sql.includes('INSERT INTO tch_creator_social_snapshot'),
    )!;
    assert.deepEqual(JSON.parse(String(insert.params[5])), oldPosts);
  } finally {
    socialConfig.enabled = enabled;
  }
});

test('disabled processor does no database or provider work', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = false;
  try {
    const { db, calls } = harness();
    assert.equal(
      await new SocialImportProcessor(db, new TrioSphereClient('test')).runOnce(),
      false,
    );
    assert.equal(calls.length, 0);
  } finally {
    socialConfig.enabled = enabled;
  }
});
