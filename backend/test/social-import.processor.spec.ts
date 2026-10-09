import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { BrightDataClient, ProviderFailure } from '../src/creator-social/brightdata.client';
import { SocialImportProcessor } from '../src/creator-social/social-import.processor';
import { socialConfig } from '../src/creator-social/social.config';

// These tests exercise external-call decisions and failed refresh behavior.
// They do not replace the opt-in PostgreSQL tests for locks and constraints.
function harness(state: 'queued' | 'collecting', attempts = 0) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const job = { id: randomUUID(), account_id: randomUUID(), state, dataset_id: 'gd_test',
    provider_snapshot_id: state === 'collecting' ? 's_existing' : null,
    attempts, username: 'creator_test', profile_url: 'https://www.instagram.com/creator_test/' };
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT j.*, a.username')) return [job];
    if (sql.startsWith('SELECT id FROM tch_creator_social_import')) return [{ id: job.id }];
    return [];
  };
  const db = { query, transaction: async (fn: (manager: { query: typeof query }) => Promise<unknown>) => fn({ query }) } as unknown as DataSource;
  return { calls, job, db };
}

test('processor never redispatches a collecting job and saves only validated data', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = true;
  try {
    const { db, calls } = harness('collecting');
    const provider = new BrightDataClient();
    provider.trigger = async () => { assert.fail('An existing collection must not trigger again'); };
    provider.progress = async (id, dataset) => { assert.equal(id, 's_existing'); assert.equal(dataset, 'gd_test'); return 'ready'; };
    provider.download = async () => [{ account: 'creator_test', id: '123', followers: 7, posts: [] }];
    await new SocialImportProcessor(db, provider).runOnce();
    assert.equal(calls.filter(call => call.sql.includes('INSERT INTO tch_creator_social_snapshot')).length, 1);
    assert.equal(calls.filter(call => call.sql.includes("state = 'succeeded'")).length, 1);
  } finally { socialConfig.enabled = enabled; }
});

test('an uncertain dispatch gets review instead of automatic trigger retry', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = true;
  try {
    const { db, calls } = harness('queued');
    const provider = new BrightDataClient();
    let triggers = 0;
    provider.trigger = async () => { triggers++; throw new ProviderFailure('provider_network_error', true); };
    await new SocialImportProcessor(db, provider).runOnce();
    assert.equal(triggers, 1);
    const finish = calls.find(call => call.params.includes('dispatch_outcome_unknown'));
    assert.equal(finish?.params[2], 'needs_review');
    assert.ok(!calls.some(call => call.sql.includes('INSERT INTO tch_creator_social_snapshot')));
  } finally { socialConfig.enabled = enabled; }
});

test('wrong account data never writes a snapshot or deletes existing observations', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = true;
  try {
    const { db, calls } = harness('collecting');
    const provider = new BrightDataClient();
    provider.progress = async () => 'ready';
    provider.download = async () => [{ account: 'wrong_account', id: '123', followers: 7 }];
    await new SocialImportProcessor(db, provider).runOnce();
    assert.ok(calls.some(call => call.params.includes('profile_identity_mismatch')));
    assert.ok(!calls.some(call => /INSERT INTO tch_creator_social_snapshot|DELETE FROM tch_creator_social_snapshot/.test(call.sql)));
  } finally { socialConfig.enabled = enabled; }
});

test('polling exhaustion requires review and never dispatches a replacement job', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = true;
  try {
    const { db, calls } = harness('collecting', 19);
    const provider = new BrightDataClient();
    provider.trigger = async () => { assert.fail('No new collection on polling timeout'); };
    provider.progress = async () => 'running';
    await new SocialImportProcessor(db, provider).runOnce();
    assert.ok(calls.some(call => call.params.includes('polling_exhausted') && call.params.includes('needs_review')));
  } finally { socialConfig.enabled = enabled; }
});

test('disabled processor does no database or provider work', async () => {
  const enabled = socialConfig.enabled;
  socialConfig.enabled = false;
  try {
    const { db, calls } = harness('queued');
    assert.equal(await new SocialImportProcessor(db, new BrightDataClient()).runOnce(), false);
    assert.equal(calls.length, 0);
  } finally { socialConfig.enabled = enabled; }
});
